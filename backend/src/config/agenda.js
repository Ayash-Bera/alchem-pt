const Agenda = require('agenda');
const { getDatabase } = require('./database');
const logger = require('../utils/logger');

let agenda = null;

const initializeAgenda = async () => {
    try {
        const db = getDatabase();
        
        // Create agenda with proper configuration
        agenda = new Agenda({
            mongo: db,
            collection: 'agendaJobs',
            processEvery: parseInt(process.env.AGENDA_PROCESS_EVERY) || 10000,
            maxConcurrency: parseInt(process.env.AGENDA_MAX_CONCURRENCY) || 10,
            defaultConcurrency: parseInt(process.env.DEFAULT_JOB_CONCURRENCY) || 5,
            defaultLockLifetime: parseInt(process.env.AGENDA_DEFAULT_LOCK_LIFETIME) || 600000,
            defaultLockLimit: 1
        });

        // Set up comprehensive event logging
        setupEventListeners();

        // Define all job processors
        await defineJobProcessors();

        // Start agenda
        await agenda.start();
        
        logger.info('AgendaJS initialized successfully', {
            processEvery: `${process.env.AGENDA_PROCESS_EVERY || 10000}ms`,
            maxConcurrency: process.env.AGENDA_MAX_CONCURRENCY || 10,
            defaultConcurrency: process.env.DEFAULT_JOB_CONCURRENCY || 5,
            lockLifetime: `${process.env.AGENDA_DEFAULT_LOCK_LIFETIME || 600000}ms`,
            collection: 'agendaJobs'
        });

        // Force immediate processing check
        setTimeout(() => {
            agenda._processEvery();
            logger.info('Initial job processing triggered');
        }, 2000);

        return agenda;
    } catch (error) {
        logger.error('AgendaJS initialization failed:', error);
        throw error;
    }
};

const setupEventListeners = () => {
    agenda.on('ready', () => {
        logger.info('AgendaJS ready for processing');
    });

    agenda.on('start', (job) => {
        logger.info(`Job started: ${job.attrs.name}`, {
            jobId: job.attrs._id,
            topic: job.attrs.data?.topic
        });
        updateJobMetrics(job.attrs._id, 'running', { started_at: new Date() });
    });

    agenda.on('complete', (job) => {
        const duration = job.attrs.lastFinishedAt - job.attrs.lastRunAt;
        logger.info(`Job completed: ${job.attrs.name}`, {
            jobId: job.attrs._id,
            duration: `${duration}ms`
        });
        updateJobMetrics(job.attrs._id, 'completed', {
            completed_at: new Date(),
            duration_ms: duration
        });
    });

    agenda.on('success', (job) => {
        logger.info(`Job succeeded: ${job.attrs.name}`, { jobId: job.attrs._id });
    });

    agenda.on('fail', (error, job) => {
        logger.error(`Job failed: ${job.attrs.name}`, {
            jobId: job.attrs._id,
            error: error.message,
            stack: error.stack
        });
        updateJobMetrics(job.attrs._id, 'failed', {
            completed_at: new Date(),
            error_message: error.message,
            duration_ms: job.attrs.lastFinishedAt ? job.attrs.lastFinishedAt - job.attrs.lastRunAt : 0
        });
    });

    agenda.on('processEvery', () => {
        logger.debug('AgendaJS processing cycle started');
    });
};

const defineJobProcessors = async () => {
    // Import job processors
    const githubAnalysisJob = require('../jobs/githubAnalysisJob');
    const documentSummaryJob = require('../jobs/documentSummaryJob'); 
    const deepResearchJob = require('../jobs/deepResearchJob');

    // Define processors with error handling
    agenda.define('github-analysis', { 
        concurrency: parseInt(process.env.DEFAULT_JOB_CONCURRENCY) || 2,
        lockLifetime: parseInt(process.env.JOB_LOCK_LIFETIME) || 600000
    }, async (job, done) => {
        try {
            const result = await githubAnalysisJob(job);
            job.attrs.result = result;
            done();
        } catch (error) {
            logger.error('GitHub analysis job processor error:', error);
            done(error);
        }
    });

    agenda.define('document-summary', { 
        concurrency: parseInt(process.env.DEFAULT_JOB_CONCURRENCY) || 3,
        lockLifetime: parseInt(process.env.JOB_LOCK_LIFETIME) || 600000
    }, async (job, done) => {
        try {
            const result = await documentSummaryJob(job);
            job.attrs.result = result;
            done();
        } catch (error) {
            logger.error('Document summary job processor error:', error);
            done(error);
        }
    });

    agenda.define('deep-research', { 
        concurrency: 1, // Keep at 1 for deep research due to complexity
        lockLifetime: parseInt(process.env.JOB_LOCK_LIFETIME) || 3600000 // 1 hour for deep research
    }, async (job, done) => {
        try {
            logger.info('Deep research processor starting', { jobId: job.attrs._id });
            const result = await deepResearchJob(job);
            job.attrs.result = result;
            logger.info('Deep research processor completed', { jobId: job.attrs._id });
            done();
        } catch (error) {
            logger.error('Deep research job processor error:', {
                jobId: job.attrs._id,
                error: error.message,
                stack: error.stack
            });
            done(error);
        }
    });

    // Utility jobs
    agenda.define('cleanup-old-jobs', { concurrency: 1 }, cleanupOldJobs);
    agenda.define('system-health-check', { concurrency: 1 }, systemHealthCheck);

    // Schedule recurring jobs
    await scheduleRecurringJobs();

    logger.info('All job processors defined successfully');
};

const scheduleRecurringJobs = async () => {
    try {
        await agenda.every('0 2 * * *', 'cleanup-old-jobs');
        await agenda.every('5 minutes', 'system-health-check');
        logger.info('Recurring jobs scheduled');
    } catch (error) {
        logger.error('Error scheduling recurring jobs:', error);
    }
};

// Job creation with proper error handling
const createJob = async (jobType, jobData, options = {}) => {
    try {
        if (!agenda) {
            throw new Error('AgendaJS not initialized');
        }

        const job = agenda.create(jobType, jobData);

        if (options.priority) job.priority(options.priority);
        if (options.delay) job.schedule(new Date(Date.now() + options.delay));
        if (options.runAt) job.schedule(options.runAt);

        await job.save();
        await createJobMetrics(job.attrs._id, jobType, jobData);

        logger.info(`Job created: ${jobType}`, {
            jobId: job.attrs._id,
            nextRunAt: job.attrs.nextRunAt
        });

        return job;
    } catch (error) {
        logger.error(`Error creating job ${jobType}:`, error);
        throw error;
    }
};

const cancelJob = async (jobId) => {
    try {
        const numRemoved = await agenda.cancel({ _id: jobId });
        if (numRemoved > 0) {
            await updateJobMetrics(jobId, 'cancelled', { completed_at: new Date() });
        }
        return numRemoved > 0;
    } catch (error) {
        logger.error(`Error cancelling job ${jobId}:`, error);
        throw error;
    }
};

const getJobStatus = async (jobId) => {
    try {
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

// Database operations
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
        await updateJobMetric(jobId, { status, ...updates });
    } catch (error) {
        logger.error('Error updating job metrics:', error);
    }
};

// Utility job functions
const cleanupOldJobs = async (job) => {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const numRemoved = await agenda.cancel({
            $or: [
                { lastFinishedAt: { $lt: threeDaysAgo } },
                { failedAt: { $lt: threeDaysAgo } }
            ]
        });

        const db = getDatabase();
        const result = await db.collection('job_metrics').deleteMany({
            started_at: { $lt: threeDaysAgo },
            status: { $in: ['completed', 'failed', 'cancelled'] }
        });

        logger.info(`Cleanup completed: ${numRemoved} jobs, ${result.deletedCount} metrics`);
    } catch (error) {
        logger.error('Cleanup job error:', error);
        throw error;
    }
};

const systemHealthCheck = async (job) => {
    try {
        const { checkDatabaseHealth } = require('./database');
        const dbHealth = await checkDatabaseHealth();

        logger.info('System health check completed', { database: dbHealth.healthy });

        const db = getDatabase();
        await db.collection('health_checks').insertOne({
            database: dbHealth,
            timestamp: new Date()
        });
    } catch (error) {
        logger.error('Health check error:', error);
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
