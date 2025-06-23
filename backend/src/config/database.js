// backend/src/config/database.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

let connection = null;

const connectDatabase = async () => {
    try {
        logger.info('Connecting to MongoDB...', {
            url: process.env.MONGODB_URL?.replace(/:[^:@]*@/, ':***@') // Hide password in logs
        });

        const mongoUrl = process.env.MONGODB_URL || 'mongodb://agendauser:agenda123@10.128.0.2:27017/alchemyst_platform?replicaSet=alchemyst-rs';

        // Updated options for modern Mongoose/MongoDB versions
        const options = {
            // Remove deprecated options that are causing the error
            maxPoolSize: 10, // Replaces maxPoolSize
            serverSelectionTimeoutMS: 5000, // Keep this
            socketTimeoutMS: 45000, // Keep this

            // These are the problematic deprecated options - REMOVED:
            // bufferMaxEntries: 0, 
            // bufferCommands: false,
            // useNewUrlParser: true,    // Default in Mongoose 6+
            // useUnifiedTopology: true, // Default in Mongoose 6+
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

        // Create indexes for better performance with proper error handling
        const jobMetricsCollection = db.collection('job_metrics');

        // Get existing indexes to avoid conflicts
        const existingIndexes = await jobMetricsCollection.indexes();
        const existingIndexNames = existingIndexes.map(idx => idx.name);

        // Helper function to create index safely
        const createIndexSafely = async (indexSpec, options) => {
            try {
                await jobMetricsCollection.createIndex(indexSpec, options);
                logger.info(`Created index: ${options.name || 'unnamed'}`);
            } catch (error) {
                if (error.message.includes('existing index')) {
                    logger.warn(`Index already exists: ${options.name || 'unnamed'}, skipping...`);
                } else {
                    logger.error(`Failed to create index ${options.name}:`, error.message);
                }
            }
        };

        // Create indexes with unique names to avoid conflicts
        const indexesToCreate = [
            { spec: { job_id: 1 }, options: { unique: true, name: "job_id_unique_idx" } },
            { spec: { job_type: 1 }, options: { name: "job_type_idx" } },
            { spec: { status: 1 }, options: { name: "status_idx" } },
            { spec: { started_at: 1 }, options: { name: "started_at_idx" } },
            { spec: { completed_at: 1 }, options: { name: "completed_at_idx" } },
            { spec: { job_type: 1, status: 1 }, options: { name: "job_type_status_idx" } },
            { spec: { started_at: 1, status: 1 }, options: { name: "started_at_status_idx" } }
        ];

        // Drop conflicting index if it exists
        if (existingIndexNames.includes('job_id_1')) {
            try {
                await jobMetricsCollection.dropIndex('job_id_1');
                logger.info('Dropped conflicting job_id_1 index');
            } catch (error) {
                logger.warn('Could not drop job_id_1 index:', error.message);
            }
        }

        // Create all indexes
        for (const { spec, options } of indexesToCreate) {
            await createIndexSafely(spec, options);
        }

        logger.info('Job metrics indexes created/verified');
    } catch (error) {
        logger.error('Error creating job metrics collection:', error);
        // Don't throw the error - let the app continue without perfect indexes
        logger.warn('Continuing without all indexes - some queries may be slower');
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
