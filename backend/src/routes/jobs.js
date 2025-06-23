const express = require('express');
const jobService = require('../services/jobService');
const logger = require('../utils/logger');
const socketService = require('../services/socketService');

const router = express.Router();

// Clear all jobs - utility function
router.post('/clear-all', async (req, res) => {
    try {
        const { getAgenda } = require('../config/agenda');
        const agenda = getAgenda();
        const cleared = await agenda.cancel({});
        
        logger.info('Cleared ' + cleared + ' jobs from system');
        res.json({ 
            success: true, 
            clearedJobs: cleared,
            message: 'Cleared ' + cleared + ' jobs'
        });
    } catch (error) {
        logger.error('Error clearing jobs:', error);
        res.status(500).json({ error: error.message });
    }
});

// System status check
router.get('/system-status', async (req, res) => {
    try {
        const { getAgenda } = require('../config/agenda');
        const agenda = getAgenda();

        const runningJobs = await agenda.jobs({ lockedAt: { $exists: true } });
        const scheduledJobs = await agenda.jobs({ nextRunAt: { $exists: true }, lockedAt: { $exists: false } });
        const completedJobs = await agenda.jobs({ lastFinishedAt: { $exists: true } });
        const failedJobs = await agenda.jobs({ failedAt: { $exists: true } });

        const formatJobDetails = (jobs) => {
            return jobs.map(job => ({
                id: job.attrs._id,
                name: job.attrs.name,
                type: getJobCategory(job.attrs.name),
                data: job.attrs.data ? {
                    topic: job.attrs.data.topic,
                    repository: job.attrs.data.repository,
                    document: job.attrs.data.document ? 'Document provided' : undefined
                } : {},
                nextRunAt: job.attrs.nextRunAt,
                lastRunAt: job.attrs.lastRunAt,
                lastFinishedAt: job.attrs.lastFinishedAt,
                failedAt: job.attrs.failedAt,
                progress: job.attrs.progress || 0,
                failReason: job.attrs.failReason
            }));
        };

        res.json({
            success: true,
            status: {
                isRunning: !!agenda._collection,
                summary: {
                    running: runningJobs.length,
                    scheduled: scheduledJobs.length,
                    completed: completedJobs.length,
                    failed: failedJobs.length,
                    total: runningJobs.length + scheduledJobs.length + completedJobs.length + failedJobs.length
                },
                details: {
                    runningJobs: formatJobDetails(runningJobs),
                    scheduledJobs: formatJobDetails(scheduledJobs.slice(0, 10)), // Limit to 10
                    recentCompleted: formatJobDetails(completedJobs.slice(-5)), // Last 5
                    recentFailed: formatJobDetails(failedJobs.slice(-5)) // Last 5
                },
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting system status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add this helper function at the bottom of the file
const getJobCategory = (jobName) => {
    const systemJobs = ['cleanup-old-jobs', 'cleanup-finished-jobs', 'system-health-check'];
    if (systemJobs.includes(jobName)) return 'system';
    return 'user';
};

// Create a new job
router.post('/', async (req, res) => {
    try {
        const { type, data } = req.body;

        if (!type || !data) {
            return res.status(400).json({
                error: 'Job type and data are required'
            });
        }

        let job;
        switch (type) {
            case 'github-analysis':
                job = await jobService.createGitHubAnalysisJob(data);
                break;
            case 'document-summary':
                job = await jobService.createDocumentSummaryJob(data);
                break;
            case 'deep-research':
                job = await jobService.createDeepResearchJob(data);
                break;
            default:
                return res.status(400).json({
                    error: 'Unsupported job type: ' + type
                });
        }

        // Emit job creation event to connected clients
        socketService.emitJobCreated(job);
        logger.info('Job created via API: ' + type, { jobId: job.id });

        res.status(201).json({
            success: true,
            job
        });
    } catch (error) {
        logger.error('Error creating job:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Get all jobs with filtering
router.get('/', async (req, res) => {
    try {
        const {
            type,
            status,
            limit = 50,
            skip = 0
        } = req.query;

        const filters = {
            limit: Math.min(parseInt(limit), 100),
            skip: parseInt(skip)
        };

        if (type) filters.type = type;
        if (status) filters.status = status;

        const result = await jobService.getJobs(filters);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error('Error getting jobs:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Get specific job by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const job = await jobService.getJob(id);

        if (!job) {
            return res.status(404).json({
                error: 'Job not found'
            });
        }

        res.json({
            success: true,
            job
        });
    } catch(error) {
        logger.error('Error getting job ' + req.params.id + ':', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Cancel a job
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await jobService.cancelJob(id);

        if (!success) {
            return res.status(404).json({
                error: 'Job not found or cannot be cancelled'
            });
        }

        // Emit job cancellation event
        socketService.emitJobCancelled(id);
        logger.info('Job cancelled via API: ' + id);

        res.json({
            success: true,
            message: 'Job cancelled successfully'
        });
    } catch (error) {
        logger.error('Error cancelling job ' + req.params.id + ':', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Get job statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
        const stats = await jobService.getJobStatistics(timeRange);

        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        logger.error('Error getting job statistics:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Get job progress/status for real-time updates
router.get('/:id/progress', async (req, res) => {
    try {
        const { id } = req.params;
        const job = await jobService.getJob(id);

        if (!job) {
            return res.status(404).json({
                error: 'Job not found'
            });
        }

        const progressData = {
            jobId: id,
            status: job.status,
            progress: job.progress || 0,
            lastRunAt: job.lastRunAt,
            lastFinishedAt: job.lastFinishedAt,
            failedAt: job.failedAt,
            estimatedCompletion: calculateEstimatedCompletion(job),
            metrics: job.metrics
        };

        res.json({
            success: true,
            progress: progressData
        });
    } catch (error) {
        logger.error('Error getting job progress ' + req.params.id + ':', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Retry a failed job
router.post('/:id/retry', async (req, res) => {
    try {
        const { id } = req.params;
        const job = await jobService.getJob(id);

        if (!job) {
            return res.status(404).json({
                error: 'Job not found'
            });
        }

        if (job.status !== 'failed') {
            return res.status(400).json({
                error: 'Only failed jobs can be retried'
            });
        }

        // Create a new job with the same data
        const originalData = job.data;
        let newJob;

        switch (job.name) {
            case 'github-analysis':
                newJob = await jobService.createGitHubAnalysisJob(originalData);
                break;
            case 'document-summary':
                newJob = await jobService.createDocumentSummaryJob(originalData);
                break;
            case 'deep-research':
                newJob = await jobService.createDeepResearchJob(originalData);
                break;
            default:
                return res.status(400).json({
                    error: 'Cannot retry job type: ' + job.name
                });
        }

        // Emit retry event
        socketService.emit('job_retried', {
            originalJobId: id,
            newJobId: newJob.id,
            retriedAt: new Date()
        });

        logger.info('Job retried: ' + id + ' -> ' + newJob.id);

        res.json({
            success: true,
            originalJobId: id,
            newJob
        });
    } catch (error) {
        logger.error('Error retrying job ' + req.params.id + ':', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Job types information endpoint
router.get('/types/info', (req, res) => {
    res.json({
        success: true,
        jobTypes: {
            'github-analysis': {
                name: 'GitHub Repository Analysis',
                description: 'Analyze GitHub repositories for code quality, architecture, and best practices',
                requiredFields: ['repository'],
                optionalFields: ['analysisType', 'options', 'priority'],
                estimatedDuration: '5-15 minutes',
                estimatedCost: '$0.10-$0.30'
            },
            'document-summary': {
                name: 'Document Summarization',
                description: 'Generate comprehensive summaries of documents and content',
                requiredFields: ['document'],
                optionalFields: ['summaryType', 'maxLength', 'options', 'priority'],
                estimatedDuration: '2-10 minutes',
                estimatedCost: '$0.05-$0.20'
            },
            'deep-research': {
                name: 'Deep Research Analysis',
                description: 'Conduct multi-step research on complex topics with comprehensive deliverables',
                requiredFields: ['topic'],
                optionalFields: ['researchDepth', 'sources', 'deliverables', 'options', 'priority'],
                estimatedDuration: '15-45 minutes',
                estimatedCost: '$0.25-$1.00'
            }
        }
    });
});

// Helper function to calculate estimated completion
const calculateEstimatedCompletion = (job) => {
    if (job.status === 'completed' || job.status === 'failed') {
        return null;
    }

    if (job.status === 'running' && job.lastRunAt && job.progress > 0) {
        const elapsed = Date.now() - new Date(job.lastRunAt).getTime();
        const progressRate = job.progress / elapsed;
        const remainingProgress = 100 - job.progress;
        const estimatedRemainingTime = remainingProgress / progressRate;

        return new Date(Date.now() + estimatedRemainingTime);
    }

    return null;
};

module.exports = router; 
