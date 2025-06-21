const { createJob, cancelJob, getJobStatus, listJobs } = require('../config/agenda');
const { publishMessage, ROUTING_KEYS } = require('../config/rabbitmq');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');

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
                jobId: job.attrs._id,
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
                jobId: job.attrs._id,
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

            // Validate required fields
            if (!jobData.topic) {
                throw new Error('Research topic is required');
            }

            const job = await createJob('deep-research', jobData, {
                priority: data.priority || 'high', // Deep research gets higher priority
                delay: data.delay
            });

            await publishMessage(ROUTING_KEYS.DEEP_RESEARCH, {
                jobId: job.attrs._id,
                ...jobData
            });

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

            // Get additional metrics from database
            const metrics = await this.getJobMetrics(jobId);

            return {
                ...this.formatJobResponse(job),
                metrics
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
            const pool = getPool();
            const result = await pool.query(
                'SELECT * FROM job_metrics WHERE job_id = $1',
                [jobId]
            );

            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.error(`Error getting job metrics for ${jobId}:`, error);
            return null;
        }
    }

    async getJobStatistics(timeRange = '24h') {
        try {
            const pool = getPool();

            // Calculate time filter
            let timeFilter = '';
            switch (timeRange) {
                case '1h':
                    timeFilter = "started_at >= NOW() - INTERVAL '1 hour'";
                    break;
                case '24h':
                    timeFilter = "started_at >= NOW() - INTERVAL '24 hours'";
                    break;
                case '7d':
                    timeFilter = "started_at >= NOW() - INTERVAL '7 days'";
                    break;
                default:
                    timeFilter = "started_at >= NOW() - INTERVAL '24 hours'";
            }

            // Get job counts by status
            const statusResult = await pool.query(`
                SELECT status, COUNT(*) as count
                FROM job_metrics
                WHERE ${timeFilter}
                GROUP BY status
            `);

            // Get job counts by type
            const typeResult = await pool.query(`
                SELECT job_type, COUNT(*) as count
                FROM job_metrics
                WHERE ${timeFilter}
                GROUP BY job_type
            `);

            // Get average processing time
            const performanceResult = await pool.query(`
                SELECT 
                    AVG(duration_ms) as avg_duration,
                    MIN(duration_ms) as min_duration,
                    MAX(duration_ms) as max_duration,
                    SUM(cost_usd) as total_cost,
                    AVG(cost_usd) as avg_cost
                FROM job_metrics
                WHERE ${timeFilter} AND status = 'completed'
            `);

            return {
                timeRange,
                statusBreakdown: statusResult.rows,
                typeBreakdown: typeResult.rows,
                performance: performanceResult.rows[0] || {}
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