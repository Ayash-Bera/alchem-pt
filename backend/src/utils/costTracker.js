// backend/src/utils/costTracker.js
const { getDatabase } = require('../config/database');
const logger = require('./logger');

class CostTracker {
    constructor() {
        this.costAlertThreshold = parseFloat(process.env.COST_ALERT_THRESHOLD) || 10.0;
    }

    async trackJobCost(jobId, jobType, cost, tokens, apiCalls = 1) {
        try {
            const db = getDatabase();
            const result = await db.collection('job_metrics').updateOne(
                { job_id: jobId },
                {
                    $set: {
                        cost_usd: cost,
                        tokens_used: tokens,
                        api_calls: apiCalls,
                        updated_at: new Date()
                    }
                }
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
            const db = getDatabase();
            const jobMetrics = db.collection('job_metrics');

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

            const result = await jobMetrics.aggregate([
                {
                    $match: {
                        ...timeFilter,
                        cost_usd: { $exists: true, $ne: null }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total_cost: { $sum: '$cost_usd' },
                        total_jobs: { $sum: 1 },
                        avg_cost: { $avg: '$cost_usd' },
                        total_tokens: { $sum: '$tokens_used' }
                    }
                }
            ]).toArray();

            return result[0] || { total_cost: 0, total_jobs: 0, avg_cost: 0, total_tokens: 0 };
        } catch (error) {
            logger.error('Error getting total costs:', error);
            return { total_cost: 0, total_jobs: 0, avg_cost: 0, total_tokens: 0 };
        }
    }

    async getCostBreakdown(timeRange = '24h') {
        try {
            const db = getDatabase();
            const jobMetrics = db.collection('job_metrics');

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

            const result = await jobMetrics.aggregate([
                {
                    $match: {
                        ...timeFilter,
                        cost_usd: { $exists: true, $ne: null }
                    }
                },
                {
                    $group: {
                        _id: '$job_type',
                        total_cost: { $sum: '$cost_usd' },
                        job_count: { $sum: 1 },
                        avg_cost: { $avg: '$cost_usd' },
                        total_tokens: { $sum: '$tokens_used' }
                    }
                },
                {
                    $project: {
                        job_type: '$_id',
                        total_cost: 1,
                        job_count: 1,
                        avg_cost: 1,
                        total_tokens: 1,
                        _id: 0
                    }
                },
                { $sort: { total_cost: -1 } }
            ]).toArray();

            return result;
        } catch (error) {
            logger.error('Error getting cost breakdown:', error);
            return [];
        }
    }

    async triggerCostAlert(jobId, jobType, cost) {
        logger.warn('HIGH COST ALERT:', { jobId, jobType, cost, threshold: this.costAlertThreshold });

        // TODO: Implement alerting mechanism (email, Slack, etc.)
        // Store alert in MongoDB for now
        try {
            const db = getDatabase();
            await db.collection('cost_alerts').insertOne({
                job_id: jobId,
                job_type: jobType,
                cost: cost,
                threshold: this.costAlertThreshold,
                triggered_at: new Date(),
                resolved: false
            });
        } catch (error) {
            logger.error('Error storing cost alert:', error);
        }
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

    async getCostAlerts(resolved = false) {
        try {
            const db = getDatabase();
            const alerts = await db.collection('cost_alerts')
                .find({ resolved })
                .sort({ triggered_at: -1 })
                .limit(50)
                .toArray();

            return alerts;
        } catch (error) {
            logger.error('Error getting cost alerts:', error);
            return [];
        }
    }

    async resolveCostAlert(alertId) {
        try {
            const db = getDatabase();
            const result = await db.collection('cost_alerts').updateOne(
                { _id: alertId },
                {
                    $set: {
                        resolved: true,
                        resolved_at: new Date()
                    }
                }
            );

            return result.modifiedCount > 0;
        } catch (error) {
            logger.error('Error resolving cost alert:', error);
            return false;
        }
    }
}

module.exports = new CostTracker();