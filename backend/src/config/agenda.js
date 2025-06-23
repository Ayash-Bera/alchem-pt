// backend/src/config/agenda.js
const Agenda = require('agenda');
const { getDatabase } = require('./database');
const logger = require('../utils/logger');

let agenda = null;

const initializeAgenda = async () => {
    try {
        // Get MongoDB connection
        const db = getDatabase();

        // Initialize Agenda with MongoDB
        agenda = new Agenda({
            mongo: db,
            collection: 'agendajobs',
            processEvery: '10 seconds', // How often to check for jobs
            maxConcurrency: 10, // Maximum number of jobs to run concurrently
            defaultConcurrency: 5, // Default concurrency for job types
            defaultLockLifetime: 10 * 60 * 1000, // 10 minutes
            defaultLockLimit: 1 // Only one instance of each job type by default
        });

        // Set up event listeners for monitoring
        setupEventListeners();

        // Define job processors
        await defineJobProcessors();

        // Start the agenda
        await agenda.start();
        logger.info('AgendaJS initialized and started successfully with MongoDB');

        return agenda;
    } catch (error) {
        logger.error('Failed to initialize AgendaJS:', error);
        throw error;
    }
};

const setupEventListeners = () => {
    // Job lifecycle events
    agenda.on('ready', () => {
        logger.info('AgendaJS ready');
    });

    agenda.on('start', (job) => {
        logger.info(`Job ${job.attrs.name} starting:`, {
            jobId: job.attrs._id,
            data: job.attrs.data
        });
        updateJobMetrics(job.attrs._id, 'running', { started_at: new Date() });
    });

    agenda.on('complete', (job) => {
        const runTime = job.attrs.lastFinishedAt - job.attrs.lastRunAt;
        logger.info(`Job ${job.attrs.name} completed:`, {
            jobId: job.attrs._id,
            runTime
        });
        updateJobMetrics(job.attrs._id, 'completed', {
            completed_at: new Date(),
            duration_ms: runTime
        });
    });

    agenda.on('success', (job) => {
        logger.info(`Job ${job.attrs.name} succeeded:`, { jobId: job.attrs._id });
    });

    agenda.on('fail', (error, job) => {
        logger.error(`Job ${job.attrs.name} failed:`, {
            jobId: job.attrs._id,
            error: error.message
        });
        updateJobMetrics(job.attrs._id, 'failed', {
            completed_at: new Date(),
            error_message: error.message,
            duration_ms: job.attrs.lastFinishedAt - job.attrs.lastRunAt
        });
    });

    // Processing events
    agenda.on('processEvery', (interval) => {
        logger.debug(`Processing every ${interval}`);
    });

    agenda.on('maxConcurrency', (numJobsRunning) => {
        logger.warn(`Max concurrency reached: ${numJobsRunning} jobs running`);
    });
};

const defineJobProcessors = async () => {
    // Import job processors
    const githubAnalysisJob = require('../jobs/githubAnalysisJob');
    const documentSummaryJob = require('../jobs/documentSummaryJob');
    const deepResearchJob = require('../jobs/deepResearchJob');

    // Define job types with their processors
    agenda.define('github-analysis', {
        concurrency: 3,
        lockLifetime: 30 * 60 * 1000 // 30 minutes
    }, githubAnalysisJob);

    agenda.define('document-summary', {
        concurrency: 5,
        lockLifetime: 20 * 60 * 1000 // 20 minutes
    }, documentSummaryJob);

    agenda.define('deep-research', {
        concurrency: 2,
        lockLifetime: 60 * 60 * 1000 // 1 hour
    }, deepResearchJob);

    // Utility jobs
    agenda.define('cleanup-old-jobs', {
        concurrency: 1
    }, cleanupOldJobs);

    agenda.define('system-health-check', {
        concurrency: 1
    }, systemHealthCheck);

    // Schedule recurring jobs
    await scheduleRecurringJobs();

    logger.info('Job processors defined successfully');
};

const scheduleRecurringJobs = async () => {
    try {
        // Clean up old completed jobs every day at 2 AM
        await agenda.every('0 2 * * *', 'cleanup-old-jobs');

        // System health check every 5 minutes
        await agenda.every('5 minutes', 'system-health-check');

        logger.info('Recurring jobs scheduled');
    } catch (error) {
        logger.error('Error scheduling recurring jobs:', error);
    }
};

// Job creation helpers
const createJob = async (jobType, jobData, options = {}) => {
    try {
        if (!agenda) {
            throw new Error('AgendaJS not initialized');
        }

        const job = agenda.create(jobType, jobData);

        // Set job options
        if (options.priority) job.priority(options.priority);
        if (options.delay) job.schedule(new Date(Date.now() + options.delay));
        if (options.runAt) job.schedule(options.runAt);
        if (options.repeatEvery) job.repeatEvery(options.repeatEvery);
        if (options.unique) job.unique(options.unique);

        await job.save();

        // Create job metrics entry
        await createJobMetrics(job.attrs._id, jobType, jobData);

        logger.info(`Job created: ${jobType}`, {
            jobId: job.attrs._id,
            data: jobData
        });

        return job;
    } catch (error) {
        logger.error(`Error creating job ${jobType}:`, error);
        throw error;
    }
};

// Job management functions
const cancelJob = async (jobId) => {
    try {
        const numRemoved = await agenda.cancel({ _id: jobId });
        if (numRemoved > 0) {
            await updateJobMetrics(jobId, 'cancelled', { completed_at: new Date() });
            logger.info(`Job cancelled: ${jobId}`);
        }
        return numRemoved > 0;
    } catch (error) {
        logger.error(`Error cancelling job ${jobId}:`, error);
        throw error;
    }
};

const getJobStatus = async (jobId) => {
    try {
        // Convert string ID to ObjectId for MongoDB query
        const ObjectId = require('mongoose').Types.ObjectId;
        const jobs = await agenda.jobs({ _id: new ObjectId(jobId) });
        return jobs.length > 0 ? jobs[0] : null;
    } catch (error) {
        logger.error(`Error getting job status ${jobId}:`, error);
        throw error;
    }
};

const listJobs = async (query = {}, limit = 50, skip = 0) => {
    try {
        const jobs = await agenda.jobs(query, {}, limit, skip);
        return jobs;
    } catch (error) {
        logger.error('Error listing jobs:', error);
        throw error;
    }
};

// Database helper functions for job metrics using MongoDB
const createJobMetrics = async (jobId, jobType, jobData) => {
    try {
        const { insertJobMetric } = require('./database');
        await insertJobMetric({
            job_id: jobId,
            job_type: jobType,
            status: 'created',
            metadata: jobData
        });
    } catch (error) {
        logger.error('Error creating job metrics:', error);
    }
};

const updateJobMetrics = async (jobId, status, updates = {}) => {
    try {
        const { updateJobMetric } = require('./database');
        await updateJobMetric(jobId, {
            status,
            ...updates
        });
    } catch (error) {
        logger.error('Error updating job metrics:', error);
    }
};

// Utility job processors
const cleanupOldJobs = async (job) => {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

        // Remove old completed jobs
        const numRemoved = await agenda.cancel({
            $or: [
                { lastFinishedAt: { $lt: threeDaysAgo } },
                { failedAt: { $lt: threeDaysAgo } }
            ]
        });

        // Clean up old metrics
        const db = getDatabase();
        const result = await db.collection('job_metrics').deleteMany({
            started_at: { $lt: threeDaysAgo },
            status: { $in: ['completed', 'failed', 'cancelled'] }
        });

        logger.info(`Cleanup completed: ${numRemoved} jobs removed, ${result.deletedCount} metrics cleaned`);
    } catch (error) {
        logger.error('Error during cleanup:', error);
        throw error;
    }
};

const systemHealthCheck = async (job) => {
    try {
        const { checkDatabaseHealth } = require('./database');
        const { checkRabbitMQHealth } = require('./rabbitmq');

        const dbHealth = await checkDatabaseHealth();
        const mqHealth = await checkRabbitMQHealth();

        const healthStatus = {
            database: dbHealth,
            rabbitmq: mqHealth,
            agenda: { healthy: true, timestamp: new Date() }
        };

        logger.info('System health check completed:', healthStatus);

        // Store health metrics in MongoDB
        const db = getDatabase();
        await db.collection('health_checks').insertOne({
            ...healthStatus,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('System health check failed:', error);
        throw error;
    }
};

const getAgenda = () => {
    if (!agenda) {
        throw new Error('AgendaJS not initialized');
    }
    return agenda;
};

const gracefulShutdown = async () => {
    if (agenda) {
        logger.info('Shutting down AgendaJS...');
        await agenda.stop();
        logger.info('AgendaJS stopped');
    }
};

module.exports = {
    initializeAgenda,
    createJob,
    cancelJob,
    getJobStatus,
    listJobs,
    getAgenda,
    gracefulShutdown
};
