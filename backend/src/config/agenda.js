const Agenda = require('agenda');
const logger = require('../utils/logger');
const { ObjectId } = require('mongodb');

let agenda = null;

const initializeAgenda = async () => {
    try {
        // FIXED: Use correct Agenda.js initialization pattern
        agenda = new Agenda({
            db: {
                address: process.env.MONGODB_URL || 'mongodb://agendauser:agenda123@10.0.0.6:27017/alchemyst_platform?replicaSet=alchemyst-rs',
                collection: 'agendaJobs'
            },
            processEvery: '10 seconds',
            maxConcurrency: parseInt(process.env.AGENDA_MAX_CONCURRENCY) || 10,
            defaultConcurrency: parseInt(process.env.DEFAULT_JOB_CONCURRENCY) || 5,
            defaultLockLifetime: parseInt(process.env.AGENDA_DEFAULT_LOCK_LIFETIME) || 600000
        });

        // Move all agenda.on() event listeners here AFTER agenda is created
        agenda.on('start', (job) => {
            // Create initial job metric record
            const { insertJobMetric } = require('./database');
            insertJobMetric({
                job_id: job.attrs._id.toString(),
                job_type: job.attrs.name,
                status: 'running',
                started_at: new Date(),
                cost_usd: 0,
                tokens_used: 0,
                api_calls: 0
            });
        });
        // Set up comprehensive event logging
        setupEventListeners();

        // Define all job processors
        await defineJobProcessors();

        logger.info('AgendaJS initialized successfully', {
            processEvery: '10 seconds',
            maxConcurrency: process.env.AGENDA_MAX_CONCURRENCY || 10,
            defaultConcurrency: process.env.DEFAULT_JOB_CONCURRENCY || 5,
            lockLifetime: `${process.env.AGENDA_DEFAULT_LOCK_LIFETIME || 600000}ms`,
            collection: 'agendaJobs'
        });

        return agenda;
    } catch (error) {
        logger.error('AgendaJS initialization failed:', error);
        throw error;
    }
};

// Helper function to categorize jobs
const getJobCategory = (jobName) => {
    const systemJobs = ['cleanup-old-jobs', 'cleanup-finished-jobs', 'system-health-check'];
    return systemJobs.includes(jobName) ? 'system' : 'user';
};

const setupEventListeners = () => {
    agenda.on('ready', () => {
        logger.info('🟢 AgendaJS ready for processing');
    });

    agenda.on('start', (job) => {
        const category = getJobCategory(job.attrs.name);
        logger.info(`🎯 ${category.toUpperCase()} JOB STARTING: ${job.attrs.name}`, {
            jobId: job.attrs._id,
            category,
            topic: job.attrs.data?.topic || 'N/A',
            repository: job.attrs.data?.repository || 'N/A',
            scheduledFor: job.attrs.nextRunAt,
            actualStart: new Date()
        });
        updateJobMetrics(job.attrs._id, 'running', { started_at: new Date() });
    });

    agenda.on('complete', (job) => {
        const duration = job.attrs.lastFinishedAt - job.attrs.lastRunAt;
        const category = getJobCategory(job.attrs.name);
        logger.info(`✅ ${category.toUpperCase()} JOB COMPLETED: ${job.attrs.name}`, {
            jobId: job.attrs._id,
            category,
            duration: `${duration}ms`
        });
        updateJobMetrics(job.attrs._id, 'completed', {
            completed_at: new Date(),
            duration_ms: duration
        });
    });

    agenda.on('success', (job) => {
        const category = getJobCategory(job.attrs.name);
        logger.info(`✅ ${category.toUpperCase()} JOB SUCCEEDED: ${job.attrs.name}`, {
            jobId: job.attrs._id,
            category
        });
    });

    agenda.on('fail', (error, job) => {
        const category = getJobCategory(job.attrs.name);
        logger.error(`❌ ${category.toUpperCase()} JOB FAILED: ${job.attrs.name}`, {
            jobId: job.attrs._id,
            category,
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
        logger.debug('🔄 AgendaJS checking for jobs to process');
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
// deep research concurrency and shi 
    agenda.define('deep-research', {
        concurrency: 1,
        lockLifetime: parseInt(process.env.JOB_LOCK_LIFETIME) || 3600000
    }, async (job, done) => {
        try {
            logger.info('🔍 DEEP RESEARCH PROCESSOR INVOKED', {
                jobId: job.attrs._id,
                topic: job.attrs.data?.topic,
                timestamp: new Date()
            });
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
    agenda.define('cleanup-finished-jobs', { concurrency: 1 }, cleanupFinishedJobs);
    agenda.define('system-health-check', { concurrency: 1 }, systemHealthCheck);

    // CRITICAL: Start agenda using IIFE pattern from docs
    (async function () {
        await agenda.start();
        logger.info('🟢 AgendaJS auto-processing STARTED', {
            isRunning: agenda._isRunning,
            processEvery: '10 seconds'
        });

        // Schedule recurring jobs after start (FIXED: Only if enabled)
        await scheduleRecurringJobs();
    })();

    logger.info('All job processors defined successfully');
};

const scheduleRecurringJobs = async () => {
    try {
        // FIXED: Only schedule recurring jobs if explicitly enabled
        if (process.env.ENABLE_RECURRING_JOBS !== 'true') {
            logger.info('🚫 Recurring jobs disabled by configuration (ENABLE_RECURRING_JOBS != true)');
            return;
        }

        logger.info('📅 Scheduling recurring system jobs...');
        await agenda.every('0 2 * * *', 'cleanup-old-jobs');
        await agenda.every('5 minutes', 'system-health-check');
        await agenda.every('1 hour', 'cleanup-finished-jobs');
        logger.info('✅ Recurring jobs scheduled successfully');
    } catch (error) {
        logger.error('❌ Error scheduling recurring jobs:', error);
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

        const category = getJobCategory(jobType);
        logger.info(`📋 ${category.toUpperCase()} JOB CREATED: ${jobType}`, {
            jobId: job.attrs._id,
            category,
            nextRunAt: job.attrs.nextRunAt,
            currentTime: new Date()
        });

        await createJobMetrics(job.attrs._id, jobType, jobData);

        return job;
    } catch (error) {
        logger.error(`Error creating job ${jobType}:`, error);
        throw error;
    }
};

const cancelJob = async (jobId) => {
    try {
        const { ObjectId } = require('mongodb');

        // Convert string ID to ObjectId for MongoDB query
        let query;
        try {
            query = { _id: new ObjectId(jobId) };
        } catch (objectIdError) {
            // If ObjectId conversion fails, try as string
            query = { _id: jobId };
        }

        const numRemoved = await agenda.cancel(query);
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
        const { ObjectId } = require('mongodb');
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

        const { getDatabase } = require('./database');
        const db = getDatabase();
        const result = await db.collection('job_metrics').deleteMany({
            started_at: { $lt: threeDaysAgo },
            status: { $in: ['completed', 'failed', 'cancelled'] }
        });

        logger.info(`🧹 SYSTEM: Cleanup completed - ${numRemoved} jobs, ${result.deletedCount} metrics removed`);
    } catch (error) {
        logger.error('Cleanup job error:', error);
        throw error;
    }
};

const cleanupFinishedJobs = async (job) => {
    try {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const numRemoved = await agenda.cancel({
            $or: [
                { lastFinishedAt: { $lt: twoHoursAgo } },
                { failedAt: { $lt: twoHoursAgo } }
            ]
        });
        logger.info(`🧹 SYSTEM: Cleaned up ${numRemoved} finished jobs older than 2 hours`);
    } catch (error) {
        logger.error('Cleanup finished jobs error:', error);
        throw error;
    }
};

const systemHealthCheck = async (job) => {
    try {
        const { checkDatabaseHealth } = require('./database');
        const dbHealth = await checkDatabaseHealth();

        logger.info('💚 SYSTEM: Health check completed', { database: dbHealth.healthy });

        const { getDatabase } = require('./database');
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