const express = require('express');
const jobService = require('../services/jobService');
const logger = require('../utils/logger');
const socketService = require('../services/socketService');

const router = express.Router();

// Replace force-process endpoint
router.get('/force-process', async (req, res) => {
    try {
        const { getAgenda } = require('../config/agenda');
        const agenda = getAgenda();
        
        // Get a waiting job and try to process it
        const jobs = await agenda.jobs({ nextRunAt: { $lte: new Date() } });
        
        if (jobs.length > 0) {
            const job = jobs[0];
            console.log('Processing job manually:', job.attrs.name);
            await job.run();
        }
        
        res.json({ 
            isRunning: agenda._isRunning,
            processedJob: jobs.length > 0 ? jobs[0].attrs.name : 'none',
            totalJobs: jobs.length
        });
    } catch (error) {
        res.json({ error: error.message, stack: error.stack });
    }
});
router.get('/agenda-debug', async (req, res) => {
    try {
        const { getAgenda } = require('../config/agenda');
        const agenda = getAgenda();
        
        const stats = await agenda.jobs({});
        res.json({
            isRunning: agenda._isRunning,
            jobCount: stats.length,
            jobs: stats.map(j => ({
                name: j.attrs.name,
                status: j.attrs.lastFinishedAt ? 'finished' : j.attrs.lockedAt ? 'running' : 'waiting'
            }))
        });
    } catch (error) {
        res.json({ error: error.message, agendaAvailable: false });
    }
});

// Add to backend/src/routes/jobs.js
router.post('/force-restart', async (req, res) => {
    try {
        const { getAgenda } = require('../config/agenda');
        const agenda = getAgenda();
        
        // Clear waiting jobs
        await agenda.cancel({ name: 'deep-research' });
        
        // Force restart
        await agenda.stop();
        await agenda.start();
        
        res.json({ success: true, message: 'AgendaJS restarted, waiting jobs cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/run-one', async (req, res) => {
    try {
        const { getAgenda } = require('../config/agenda');
        const agenda = getAgenda();
        
        // Get one scheduled job and force run it
        const jobs = await agenda.jobs({nextRunAt: {$exists: true}}, {}, 1);
        if (jobs.length > 0) {
            await jobs[0].run();
            res.json({ success: true, jobRan: jobs[0].attrs.name });
        } else {
            res.json({ error: 'No jobs to run' });
        }
    } catch (error) {
        res.json({ error: error.message });
    }
});

router.post('/run-deep-research', async (req, res) => {
    try {
        const { getAgenda } = require('../config/agenda');
        const agenda = getAgenda();
        
        const jobs = await agenda.jobs({name: 'deep-research'}, {}, 1);
        if (jobs.length > 0) {
            await jobs[0].run();
            res.json({ success: true, jobRan: 'deep-research' });
        } else {
            res.json({ error: 'No deep-research jobs found' });
        }
    } catch (error) {
        res.json({ error: error.message, stack: error.stack });
    }
});
// Add this at the very top, right after the router definition
router.get('/agenda-status', async (req, res) => {
    try {
        const { getAgenda } = require('../config/agenda');
        const agenda = getAgenda();
        
        const runningJobs = await agenda.jobs({lockedAt: {$exists: true}});
        const scheduledJobs = await agenda.jobs({nextRunAt: {$exists: true}, lockedAt: {$exists: false}});
        
        res.json({
            isRunning: !!agenda._collection,
            runningJobs: runningJobs.length,
            scheduledJobs: scheduledJobs.length,
            totalJobs: await agenda.jobs({}).length
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

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
                    error: `Unsupported job type: ${type}`
                });
        }

        // Emit job creation event to connected clients
        socketService.emitJobCreated(job);

        logger.info(`Job created via API: ${type}`, { jobId: job.id });

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
            skip = 0,
            sortBy = 'createdAt',
            sortOrder = 'desc'
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
    } catch (error) {
        logger.error(`Error getting job ${req.params.id}:`, error);
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

        logger.info(`Job cancelled via API: ${id}`);

        res.json({
            success: true,
            message: 'Job cancelled successfully'
        });
    } catch (error) {
        logger.error(`Error cancelling job ${req.params.id}:`, error);
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

// Batch job creation
router.post('/batch', async (req, res) => {
    try {
        const { jobs } = req.body;

        if (!Array.isArray(jobs) || jobs.length === 0) {
            return res.status(400).json({
                error: 'Jobs array is required and must not be empty'
            });
        }

        if (jobs.length > 10) {
            return res.status(400).json({
                error: 'Maximum 10 jobs allowed per batch'
            });
        }

        const results = [];
        const errors = [];

        for (let i = 0; i < jobs.length; i++) {
            const { type, data } = jobs[i];

            try {
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
                        throw new Error(`Unsupported job type: ${type}`);
                }

                results.push({
                    index: i,
                    success: true,
                    job
                });

                // Emit batch job creation event
                socketService.emit('batch_job_created', {
                    batchIndex: i,
                    jobId: job.id,
                    type,
                    status: job.status
                });

            } catch (error) {
                errors.push({
                    index: i,
                    error: error.message,
                    type,
                    data
                });
            }
        }

        logger.info(`Batch job creation completed: ${results.length} successful, ${errors.length} failed`);

        res.status(201).json({
            success: true,
            results,
            errors,
            summary: {
                total: jobs.length,
                successful: results.length,
                failed: errors.length
            }
        });
    } catch (error) {
        logger.error('Error creating batch jobs:', error);
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
                    error: `Cannot retry job type: ${job.name}`
                });
        }

        // Emit retry event
        socketService.emit('job_retried', {
            originalJobId: id,
            newJobId: newJob.id,
            retriedAt: new Date()
        });

        logger.info(`Job retried: ${id} -> ${newJob.id}`);

        res.json({
            success: true,
            originalJobId: id,
            newJob
        });
    } catch (error) {
        logger.error(`Error retrying job ${req.params.id}:`, error);
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
        logger.error(`Error getting job progress ${req.params.id}:`, error);
        res.status(500).json({
            error: error.message
        });
    }
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

module.exports = router;
