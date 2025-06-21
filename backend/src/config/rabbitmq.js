const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

const EXCHANGES = {
    RESEARCH_DIRECT: 'research.direct',
    RESEARCH_FANOUT: 'research.fanout',
    DEAD_LETTER: 'research.deadletter'
};

const QUEUES = {
    GITHUB_ANALYSIS: 'github.analysis.queue',
    DOCUMENT_SUMMARY: 'document.summary.queue',
    DEEP_RESEARCH: 'deep.research.queue',
    FAILED_JOBS: 'failed.jobs.queue'
};

const ROUTING_KEYS = {
    GITHUB_ANALYSIS: 'job.github.analysis',
    DOCUMENT_SUMMARY: 'job.document.summary',
    DEEP_RESEARCH: 'job.deep.research'
};

const connectRabbitMQ = async () => {
    try {
        // Establish connection with retry logic
        connection = await amqp.connect(process.env.RABBITMQ_URL);

        // Handle connection events
        connection.on('error', (err) => {
            logger.error('RabbitMQ connection error:', err);
        });

        connection.on('close', () => {
            logger.warn('RabbitMQ connection closed');
            // Implement reconnection logic here if needed
        });

        // Create channel
        channel = await connection.createChannel();

        // Set up dead letter exchange and queue
        await setupDeadLetterQueue();

        // Set up main exchanges
        await setupExchanges();

        // Set up queues
        await setupQueues();

        logger.info('RabbitMQ connected and configured successfully');
        return { connection, channel };
    } catch (error) {
        logger.error('RabbitMQ connection failed:', error);
        throw error;
    }
};

const setupDeadLetterQueue = async () => {
    // Create dead letter exchange
    await channel.assertExchange(EXCHANGES.DEAD_LETTER, 'direct', {
        durable: true
    });

    // Create dead letter queue
    await channel.assertQueue(QUEUES.FAILED_JOBS, {
        durable: true
    });

    // Bind dead letter queue to dead letter exchange
    await channel.bindQueue(QUEUES.FAILED_JOBS, EXCHANGES.DEAD_LETTER, 'failed');

    logger.info('Dead letter queue configured');
};

const setupExchanges = async () => {
    // Direct exchange for specific job routing
    await channel.assertExchange(EXCHANGES.RESEARCH_DIRECT, 'direct', {
        durable: true
    });

    // Fanout exchange for broadcasting (monitoring, logging)
    await channel.assertExchange(EXCHANGES.RESEARCH_FANOUT, 'fanout', {
        durable: true
    });

    logger.info('Exchanges configured');
};

const setupQueues = async () => {
    const queueOptions = {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER,
            'x-dead-letter-routing-key': 'failed',
            'x-message-ttl': 3600000, // 1 hour TTL
            'x-max-retries': 3
        }
    };

    // Create and bind queues
    await channel.assertQueue(QUEUES.GITHUB_ANALYSIS, queueOptions);
    await channel.bindQueue(QUEUES.GITHUB_ANALYSIS, EXCHANGES.RESEARCH_DIRECT, ROUTING_KEYS.GITHUB_ANALYSIS);

    await channel.assertQueue(QUEUES.DOCUMENT_SUMMARY, queueOptions);
    await channel.bindQueue(QUEUES.DOCUMENT_SUMMARY, EXCHANGES.RESEARCH_DIRECT, ROUTING_KEYS.DOCUMENT_SUMMARY);

    await channel.assertQueue(QUEUES.DEEP_RESEARCH, queueOptions);
    await channel.bindQueue(QUEUES.DEEP_RESEARCH, EXCHANGES.RESEARCH_DIRECT, ROUTING_KEYS.DEEP_RESEARCH);

    // Set prefetch count for fair distribution
    await channel.prefetch(1);

    logger.info('Queues configured');
};

const publishMessage = async (routingKey, message, options = {}) => {
    try {
        if (!channel) {
            throw new Error('RabbitMQ channel not available');
        }

        const messageBuffer = Buffer.from(JSON.stringify(message));

        const publishOptions = {
            persistent: true,
            timestamp: Date.now(),
            messageId: message.jobId || `msg_${Date.now()}`,
            ...options
        };

        const published = channel.publish(
            EXCHANGES.RESEARCH_DIRECT,
            routingKey,
            messageBuffer,
            publishOptions
        );

        // Also broadcast to fanout for monitoring
        channel.publish(
            EXCHANGES.RESEARCH_FANOUT,
            '',
            messageBuffer,
            publishOptions
        );

        if (published) {
            logger.info(`Message published to ${routingKey}:`, { messageId: publishOptions.messageId });
        } else {
            logger.warn(`Failed to publish message to ${routingKey}`);
        }

        return published;
    } catch (error) {
        logger.error('Error publishing message:', error);
        throw error;
    }
};

const consumeMessages = async (queueName, processorFunction) => {
    try {
        if (!channel) {
            throw new Error('RabbitMQ channel not available');
        }

        await channel.consume(queueName, async (message) => {
            if (message) {
                try {
                    const content = JSON.parse(message.content.toString());
                    logger.info(`Processing message from ${queueName}:`, { messageId: message.properties.messageId });

                    // Process the message
                    await processorFunction(content, message);

                    // Acknowledge successful processing
                    channel.ack(message);
                    logger.info(`Message processed successfully:`, { messageId: message.properties.messageId });
                } catch (error) {
                    logger.error(`Error processing message from ${queueName}:`, error);

                    // Check retry count
                    const retryCount = (message.properties.headers && message.properties.headers['x-retry-count']) || 0;

                    if (retryCount < 3) {
                        // Retry with delay
                        setTimeout(() => {
                            channel.nack(message, false, true);
                        }, Math.pow(2, retryCount) * 1000); // Exponential backoff
                    } else {
                        // Send to dead letter queue
                        channel.nack(message, false, false);
                    }
                }
            }
        });

        logger.info(`Consumer set up for queue: ${queueName}`);
    } catch (error) {
        logger.error(`Error setting up consumer for ${queueName}:`, error);
        throw error;
    }
};

const getChannel = () => {
    if (!channel) {
        throw new Error('RabbitMQ channel not available');
    }
    return channel;
};

const closeRabbitMQ = async () => {
    try {
        if (channel) {
            await channel.close();
        }
        if (connection) {
            await connection.close();
        }
        logger.info('RabbitMQ connection closed');
    } catch (error) {
        logger.error('Error closing RabbitMQ connection:', error);
    }
};

// Health check function
const checkRabbitMQHealth = async () => {
    try {
        if (!connection || !channel) {
            return { healthy: false, error: 'No connection or channel', timestamp: new Date() };
        }

        // Simple health check by asserting a temporary queue
        const tempQueue = await channel.assertQueue('health_check_queue', {
            exclusive: true,
            autoDelete: true
        });

        await channel.deleteQueue(tempQueue.queue);

        return { healthy: true, timestamp: new Date() };
    } catch (error) {
        logger.error('RabbitMQ health check failed:', error);
        return { healthy: false, error: error.message, timestamp: new Date() };
    }
};

module.exports = {
    connectRabbitMQ,
    publishMessage,
    consumeMessages,
    getChannel,
    closeRabbitMQ,
    checkRabbitMQHealth,
    EXCHANGES,
    QUEUES,
    ROUTING_KEYS
};