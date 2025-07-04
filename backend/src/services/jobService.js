// backend/src/services/jobService.js
const { createJob, cancelJob, getJobStatus, listJobs } = require('../config/agenda');
const { publishMessage, ROUTING_KEYS } = require('../config/rabbitmq');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const isAgendaAvailable = () => {
    try {
        const { getAgenda } = require('../config/agenda');
        return !!getAgenda();
    } catch {
        return false;
    }
};
class JobService {
    constructor() {
        this.jobTypes = {
            'github-analysis': ROUTING_KEYS.GITHUB_ANALYSIS,
            'document-summary': ROUTING_KEYS.DOCUMENT_SUMMARY,
            'deep-research': ROUTING_KEYS.DEEP_RESEARCH
        };
    }

    async createGitHubAnalysisJob(data) {
        try {
            const jobData = {
                repository: data.repository,
                analysisType: data.analysisType || 'full',
                options: data.options || {},
                requestId: data.requestId || `req_${Date.now()}`,
                createdAt: new Date()
            };

            // Validate required fields
            if (!jobData.repository) {
                throw new Error('Repository URL is required');
            }

            // Create job in AgendaJS
            const job = await createJob('github-analysis', jobData, {
                priority: data.priority || 'normal',
                delay: data.delay
            });

            // Publish to RabbitMQ for processing
            await publishMessage(ROUTING_KEYS.GITHUB_ANALYSIS, {
                jobId: String(job.attrs._id),
                ...jobData
            });

            logger.info('GitHub analysis job created:', { jobId: job.attrs._id });
            return this.formatJobResponse(job);
        } catch (error) {
            logger.error('Error creating GitHub analysis job:', error);
            throw error;
        }
    }

    async createDocumentSummaryJob(data) {
        try {
            const jobData = {
                document: data.document,
                summaryType: data.summaryType || 'comprehensive',
                maxLength: data.maxLength || 1000,
                options: data.options || {},
                requestId: data.requestId || `req_${Date.now()}`,
                createdAt: new Date()
            };

            // Validate required fields
            if (!jobData.document) {
                throw new Error('Document content or URL is required');
            }

            const job = await createJob('document-summary', jobData, {
                priority: data.priority || 'normal',
                delay: data.delay
            });

            await publishMessage(ROUTING_KEYS.DOCUMENT_SUMMARY, {
                jobId: String(job.attrs._id),
                ...jobData
            });

            logger.info('Document summary job created:', { jobId: job.attrs._id });
            return this.formatJobResponse(job);
        } catch (error) {
            logger.error('Error creating document summary job:', error);
            throw error;
        }
    }

    async createDeepResearchJob(data) {
        try {
            const jobData = {
                topic: data.topic,
                researchDepth: data.researchDepth || 'medium',
                sources: data.sources || [],
                deliverables: data.deliverables || ['summary', 'citations'],
                options: data.options || {},
                requestId: data.requestId || `req_${Date.now()}`,
                createdAt: new Date()
            };

            if (!jobData.topic) {
                throw new Error('Research topic is required');
            }

            // Add timeout to job creation
            const createJobWithTimeout = Promise.race([
                createJob('deep-research', jobData, {
                    priority: data.priority || 'high',
                    delay: data.delay
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Job creation timeout')), 5000)
                )
            ]);

            const job = await createJobWithTimeout;

            // Publish notification to RabbitMQ (not job execution)
            try {
                await publishMessage(ROUTING_KEYS.DEEP_RESEARCH, {
                    jobId: String(job.attrs._id),
                    action: 'job_created',
                    topic: jobData.topic,
                    timestamp: new Date()
                });
            } catch (mqError) {
                logger.warn('RabbitMQ notification failed, job will still be processed by Agenda:', mqError.message);
            }

            logger.info('Deep research job created:', { jobId: job.attrs._id });
            return this.formatJobResponse(job);
        } catch (error) {
            logger.error('Error creating deep research job:', error);
            throw error;
        }
    }


    async getJob(jobId) {
        try {
            const job = await getJobStatus(jobId);
            if (!job) {
                return null;
            }

            // Get additional metrics AND result from MongoDB
            const { getDatabase } = require('../config/database');
            const db = getDatabase();
            const metrics = await db.collection('job_metrics').findOne({ job_id: jobId });

            return {
                ...this.formatJobResponse(job),
                metrics,
                result: metrics?.result || job.attrs.result // Fallback to job result if not in metrics
            };
        } catch (error) {
            logger.error(`Error getting job ${jobId}:`, error);
            throw error;
        }
    }

    async getJobs(filters = {}) {
        try {
            const query = {};

            // Apply filters
            if (filters.type) {
                query.name = filters.type;
            }

            if (filters.status) {
                // Map status to agenda query
                switch (filters.status) {
                    case 'pending':
                        query.nextRunAt = { $exists: true };
                        query.lockedAt = { $exists: false };
                        break;
                    case 'running':
                        query.lockedAt = { $exists: true };
                        break;
                    case 'completed':
                        query.lastFinishedAt = { $exists: true };
                        query.failedAt = { $exists: false };
                        break;
                    case 'failed':
                        query.failedAt = { $exists: true };
                        break;
                }
            }

            const limit = Math.min(filters.limit || 50, 100);
            const skip = filters.skip || 0;

            const jobs = await listJobs(query, limit, skip);

            return {
                jobs: jobs.map(job => this.formatJobResponse(job)),
                total: jobs.length,
                limit,
                skip
            };
        } catch (error) {
            logger.error('Error getting jobs:', error);
            throw error;
        }
    }

    async cancelJob(jobId) {
        try {
            const success = await cancelJob(jobId);
            if (success) {
                logger.info(`Job cancelled: ${jobId}`);
            } else {
                logger.warn(`Job not found or already completed: ${jobId}`);
            }
            return success;
        } catch (error) {
            logger.error(`Error cancelling job ${jobId}:`, error);
            throw error;
        }
    }

    async getJobMetrics(jobId) {
        try {
            const db = getDatabase();
            const result = await db.collection('job_metrics').findOne({ job_id: jobId });
            return result;
        } catch (error) {
            logger.error(`Error getting job metrics for ${jobId}:`, error);
            return null;
        }
    }

    async getJobStatistics(timeRange = '24h') {
        try {
            const db = getDatabase();
            const jobMetrics = db.collection('job_metrics');

            // Calculate time filter
            let timeFilter = {};
            const now = new Date();

            switch (timeRange) {
                case '1h':
                    timeFilter.started_at = { $gte: new Date(now - 60 * 60 * 1000) };
                    break;
                case '24h':
                    timeFilter.started_at = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
                    break;
                case '7d':
                    timeFilter.started_at = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
                    break;
                default:
                    timeFilter.started_at = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
            }

            // Get job counts by status
            const statusResult = await jobMetrics.aggregate([
                { $match: timeFilter },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        status: '$_id',
                        count: 1,
                        _id: 0
                    }
                }
            ]).toArray();

            // Get job counts by type
            const typeResult = await jobMetrics.aggregate([
                { $match: timeFilter },
                {
                    $group: {
                        _id: '$job_type',
                        count: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        job_type: '$_id',
                        count: 1,
                        _id: 0
                    }
                }
            ]).toArray();

            // Get average processing time
            const performanceResult = await jobMetrics.aggregate([
                {
                    $match: {
                        ...timeFilter,
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        avg_duration: { $avg: '$duration_ms' },
                        min_duration: { $min: '$duration_ms' },
                        max_duration: { $max: '$duration_ms' },
                        total_cost: { $sum: '$cost_usd' },
                        avg_cost: { $avg: '$cost_usd' }
                    }
                }
            ]).toArray();

            return {
                timeRange,
                statusBreakdown: statusResult,
                typeBreakdown: typeResult,
                performance: performanceResult[0] || {}
            };
        } catch (error) {
            logger.error('Error getting job statistics:', error);
            throw error;
        }
    }

    formatJobResponse(job) {
        return {
            id: job.attrs._id,
            name: job.attrs.name,
            data: job.attrs.data,
            priority: job.attrs.priority,
            nextRunAt: job.attrs.nextRunAt,
            lastRunAt: job.attrs.lastRunAt,
            lastFinishedAt: job.attrs.lastFinishedAt,
            failedAt: job.attrs.failedAt,
            lockedAt: job.attrs.lockedAt,
            status: this.getJobStatus(job),
            progress: job.attrs.progress || 0,
            result: job.attrs.result,
            failReason: job.attrs.failReason,
            createdAt: job.attrs.data?.createdAt
        };
    }

    getJobStatus(job) {
        if (job.attrs.failedAt) return 'failed';
        if (job.attrs.lastFinishedAt) return 'completed';
        if (job.attrs.lockedAt) return 'running';
        if (job.attrs.nextRunAt) return 'scheduled';
        return 'pending';
    }
}

module.exports = new JobService();