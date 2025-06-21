require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

// Import configurations
const { connectDatabase } = require('./config/database');
const { initializeAgenda, gracefulShutdown } = require('./config/agenda');
const { connectRabbitMQ, closeRabbitMQ } = require('./config/rabbitmq');

// Import routes
const jobRoutes = require('./routes/jobs');
const metricsRoutes = require('./routes/metrics');
const healthRoutes = require('./routes/health');

// Import middleware and services
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const socketService = require('./services/socketService');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Basic middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

// Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);

// Basic route for testing
app.get('/', (req, res) => {
    res.json({
        message: 'Alchemyst Platform API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
    });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
    logger.info('Client connected to socket', { socketId: socket.id });

    // Send current system status on connection
    socket.emit('system_status', {
        status: 'connected',
        timestamp: new Date(),
        message: 'Connected to Alchemyst Platform'
    });

    // Handle client requesting job updates
    socket.on('subscribe_job_updates', (jobId) => {
        if (jobId) {
            socket.join(`job_${jobId}`);
            logger.info(`Client subscribed to job updates: ${jobId}`, { socketId: socket.id });
        }
    });

    socket.on('unsubscribe_job_updates', (jobId) => {
        if (jobId) {
            socket.leave(`job_${jobId}`);
            logger.info(`Client unsubscribed from job updates: ${jobId}`, { socketId: socket.id });
        }
    });

    // Handle general metrics subscription
    socket.on('subscribe_metrics', () => {
        socket.join('metrics_updates');
        logger.info('Client subscribed to metrics updates', { socketId: socket.id });
    });

    socket.on('unsubscribe_metrics', () => {
        socket.leave('metrics_updates');
        logger.info('Client unsubscribed from metrics updates', { socketId: socket.id });
    });

    socket.on('disconnect', (reason) => {
        logger.info('Client disconnected from socket', {
            socketId: socket.id,
            reason
        });
    });

    socket.on('error', (error) => {
        logger.error('Socket error:', {
            socketId: socket.id,
            error: error.message
        });
    });
});

// Global error handlers
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown().then(() => process.exit(1));
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await shutdown();
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await shutdown();
});

const shutdown = async () => {
    try {
        // Close server
        server.close(() => {
            logger.info('HTTP server closed');
        });

        // Close socket connections
        io.close(() => {
            logger.info('Socket.io server closed');
        });

        // Shutdown AgendaJS
        await gracefulShutdown();

        // Close RabbitMQ connection
        await closeRabbitMQ();

        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};

// Initialize services and start server
async function initializeApp() {
    try {
        logger.info('Starting Alchemyst Platform...');

        // Initialize database connection
        logger.info('Connecting to database...');
        await connectDatabase();
        logger.info('Database connected successfully');

        // Initialize RabbitMQ connection
        logger.info('Connecting to RabbitMQ...');
        await connectRabbitMQ();
        logger.info('RabbitMQ connected successfully');

        // Initialize AgendaJS
        logger.info('Initializing AgendaJS...');
        await initializeAgenda();
        logger.info('AgendaJS initialized successfully');

        // Initialize socket service
        socketService.initialize(io);
        logger.info('Socket service initialized');

        // Start server
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 Alchemyst Platform API running on port ${PORT}`);
            logger.info(`📊 Health check available at http://localhost:${PORT}/api/health`);
            logger.info(`🔌 Socket.io ready for real-time connections`);

            // Also log external access info
            logger.info(`🌐 External access: http://35.209.5.151:${PORT}`);
        });

        // Emit server ready event
        io.emit('server_ready', {
            status: 'ready',
            port: PORT,
            timestamp: new Date(),
            services: {
                database: 'connected',
                rabbitmq: 'connected',
                agenda: 'initialized'
            }
        });

        // Set up periodic health broadcasts
        setInterval(() => {
            io.emit('health_update', {
                status: 'healthy',
                timestamp: new Date(),
                uptime: process.uptime(),
                memory: process.memoryUsage()
            });
        }, 30000); // Every 30 seconds

    } catch (error) {
        logger.error('Failed to initialize app:', error);
        process.exit(1);
    }
}

// Start the application
initializeApp();

// Export for testing
module.exports = { app, server };