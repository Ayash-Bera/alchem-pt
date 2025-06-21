// backend/src/config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

let connection = null;

const connectDatabase = async () => {
    try {
        logger.info('Connecting to MongoDB...', {
            url: process.env.MONGODB_URL?.replace(/:[^:@]*@/, ':***@') // Hide password in logs
        });

        const mongoUrl = process.env.MONGODB_URL || 'mongodb://agendauser:agenda123@localhost:27017/alchemyst_platform';

        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            bufferMaxEntries: 0, // Disable mongoose buffering
            bufferCommands: false, // Disable mongoose buffering
        };

        // Connect to MongoDB
        connection = await mongoose.connect(mongoUrl, options);

        logger.info('MongoDB connected successfully', {
            host: connection.connection.host,
            port: connection.connection.port,
            database: connection.connection.name
        });

        // Create job metrics collection with indexes
        await createJobMetricsCollection();

        return connection;
    } catch (error) {
        logger.error('MongoDB connection failed:', {
            error: error.message,
            code: error.code
        });

        // Provide helpful error messages
        if (error.message.includes('ECONNREFUSED')) {
            logger.error('Connection refused - check if MongoDB is running and accessible');
        } else if (error.message.includes('authentication failed')) {
            logger.error('Authentication failed - check username and password');
        } else if (error.message.includes('ENOTFOUND')) {
            logger.error('Host not found - check the MongoDB host address');
        }

        throw error;
    }
};

const createJobMetricsCollection = async () => {
    try {
        const db = mongoose.connection.db;

        // Create job_metrics collection
        const jobMetricsExists = await db.listCollections({ name: 'job_metrics' }).hasNext();

        if (!jobMetricsExists) {
            await db.createCollection('job_metrics');
            logger.info('Created job_metrics collection');
        }

        // Create indexes for better performance
        const jobMetricsCollection = db.collection('job_metrics');

        await jobMetricsCollection.createIndexes([
            { key: { job_id: 1 }, unique: true },
            { key: { job_type: 1 } },
            { key: { status: 1 } },
            { key: { started_at: 1 } },
            { key: { completed_at: 1 } },
            { key: { job_type: 1, status: 1 } },
            { key: { started_at: 1, status: 1 } }
        ]);

        logger.info('Job metrics indexes created');
    } catch (error) {
        logger.error('Error creating job metrics collection:', error);
        throw error;
    }
};

const getDatabase = () => {
    if (!connection) {
        throw new Error('Database not initialized. Call connectDatabase() first.');
    }
    return mongoose.connection.db;
};

const closeDatabase = async () => {
    if (connection) {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
    }
};

// Health check function
const checkDatabaseHealth = async () => {
    try {
        await mongoose.connection.db.admin().ping();
        return {
            healthy: true,
            timestamp: new Date(),
            database: mongoose.connection.name,
            host: mongoose.connection.host
        };
    } catch (error) {
        logger.error('MongoDB health check failed:', error);
        return { healthy: false, error: error.message, timestamp: new Date() };
    }
};

// Job metrics helper functions for backward compatibility
const insertJobMetric = async (jobData) => {
    try {
        const db = getDatabase();
        const result = await db.collection('job_metrics').insertOne({
            job_id: jobData.job_id,
            job_type: jobData.job_type,
            status: jobData.status,
            started_at: new Date(),
            metadata: jobData.metadata || {},
            created_at: new Date()
        });
        return result;
    } catch (error) {
        logger.error('Error inserting job metric:', error);
        throw error;
    }
};

const updateJobMetric = async (jobId, updates) => {
    try {
        const db = getDatabase();
        const result = await db.collection('job_metrics').updateOne(
            { job_id: jobId },
            {
                $set: {
                    ...updates,
                    updated_at: new Date()
                }
            }
        );
        return result;
    } catch (error) {
        logger.error('Error updating job metric:', error);
        throw error;
    }
};

const getJobMetrics = async (query = {}, options = {}) => {
    try {
        const db = getDatabase();
        const { limit = 50, skip = 0, sort = { started_at: -1 } } = options;

        const cursor = db.collection('job_metrics')
            .find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        return await cursor.toArray();
    } catch (error) {
        logger.error('Error getting job metrics:', error);
        throw error;
    }
};

module.exports = {
    connectDatabase,
    getDatabase,
    closeDatabase,
    checkDatabaseHealth,
    insertJobMetric,
    updateJobMetric,
    getJobMetrics
};