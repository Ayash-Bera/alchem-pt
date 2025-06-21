const { getPool } = require('../config/database');
const logger = require('./logger');

class CostTracker {
    constructor() {
        this.costAlertThreshold = parseFloat(process.env.COST_ALERT_THRESHOLD) || 10.0;
    }

    async trackJobCost(jobId, jobType, cost, tokens, apiCalls = 1) {
        try {
            const pool = getPool();
            await pool.query(
                `UPDATE job_metrics 
                 SET cost_usd = $1, tokens_used = $2, api_calls = $3 
                 WHERE job_id = $4`,
                [cost, tokens, apiCalls, jobId]
            );

            logger.info('Job cost tracked:', { jobId, cost, tokens, apiCalls });

            // Check if cost exceeds threshold
            if (cost > this.costAlertThreshold) {
                await this.triggerCostAlert(jobId, jobType, cost);
            }
        } catch (error) {
            logger.error('Error tracking job cost:', error);
        }
    }

    async getTotalCosts(timeRange = '24h') {
        try {
            const pool = getPool();
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

            const result = await pool.query(`
                SELECT 
                    SUM(cost_usd) as total_cost,
                    COUNT(*) as total_jobs,
                    AVG(cost_usd) as avg_cost,
                    SUM(tokens_used) as total_tokens
                FROM job_metrics 
                WHERE ${timeFilter} AND cost_usd IS NOT NULL
            `);

            return result.rows[0] || { total_cost: 0, total_jobs: 0, avg_cost: 0, total_tokens: 0 };
        } catch (error) {
            logger.error('Error getting total costs:', error);
            return { total_cost: 0, total_jobs: 0, avg_cost: 0, total_tokens: 0 };
        }
    }

    async getCostBreakdown(timeRange = '24h') {
        try {
            const pool = getPool();
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

            const result = await pool.query(`
                SELECT 
                    job_type,
                    SUM(cost_usd) as total_cost,
                    COUNT(*) as job_count,
                    AVG(cost_usd) as avg_cost,
                    SUM(tokens_used) as total_tokens
                FROM job_metrics 
                WHERE ${timeFilter} AND cost_usd IS NOT NULL
                GROUP BY job_type
                ORDER BY total_cost DESC
            `);

            return result.rows;
        } catch (error) {
            logger.error('Error getting cost breakdown:', error);
            return [];
        }
    }

    async triggerCostAlert(jobId, jobType, cost) {
        logger.warn('HIGH COST ALERT:', { jobId, jobType, cost, threshold: this.costAlertThreshold });

        // TODO: Implement alerting mechanism (email, Slack, etc.)
        // For now, just log the alert
    }

    calculateEstimatedCost(jobType, inputSize) {
        // Simple cost estimation based on job type and input size
        const baseCosts = {
            'github-analysis': 0.15,
            'document-summary': 0.08,
            'deep-research': 0.25
        };

        const baseCost = baseCosts[jobType] || 0.10;
        const sizeMultiplier = Math.max(1, inputSize / 1000); // Scale with input size

        return baseCost * sizeMultiplier;
    }
}

module.exports = new CostTracker();