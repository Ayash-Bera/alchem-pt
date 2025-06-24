// backend/src/routes/metrics.js
const express = require('express');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');
const { trackHealthCheck } = require('../telemetry/metrics');
const promClient = require('prom-client');

const router = express.Router();

// Prometheus metrics endpoint (exposed by OpenTelemetry)
router.get('/prometheus', async (req, res) => {
    try {
        const promClient = require('prom-client');
        res.set('Content-Type', promClient.register.contentType);
        const metrics = await promClient.register.metrics();
        res.end(metrics);
    } catch (error) {
        res.status(500).end(error);
    }
});

// Get concurrency metrics
router.get('/concurrency', async (req, res) => {
    try {
        const db = getDatabase();
        const jobMetrics = db.collection('job_metrics');

        // Get current running jobs
        const runningJobs = await jobMetrics.aggregate([
            { $match: { status: 'running' } },
            { $group: { _id: '$job_type', count: { $sum: 1 } } },
            { $project: { job_type: '$_id', count: 1, _id: 0 } }
        ]).toArray();

        // Get jobs by status in last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const statusMetrics = await jobMetrics.aggregate([
            { $match: { started_at: { $gte: oneHourAgo } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $project: { status: '$_id', count: 1, _id: 0 } }
        ]).toArray();

        // Get concurrent job peaks (simplified for MongoDB)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const concurrencyPeaks = await jobMetrics.aggregate([
            {
                $match: {
                    started_at: { $gte: twentyFourHoursAgo },
                    status: { $in: ['running', 'completed'] }
                }
            },
            {
                $group: {
                    _id: {
                        hour: { $dateToString: { format: "%Y-%m-%d-%H", date: "$started_at" } }
                    },
                    job_count: { $sum: 1 }
                }
            },
            { $sort: { '_id.hour': -1 } },
            { $limit: 24 },
            {
                $project: {
                    hour: '$_id.hour',
                    peak_concurrency: '$job_count',
                    _id: 0
                }
            }
        ]).toArray();

        trackHealthCheck('concurrency_metrics', 'success');

        res.json({
            success: true,
            metrics: {
                currentlyRunning: runningJobs,
                statusBreakdown: statusMetrics,
                concurrencyPeaks: concurrencyPeaks,
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting concurrency metrics:', error);
        trackHealthCheck('concurrency_metrics', 'error');
        res.status(500).json({
            error: error.message
        });
    }
});

// Get cost metrics
router.get('/costs', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
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
            case '30d':
                timeFilter.started_at = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
                break;
            default:
                timeFilter.started_at = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
        }

        // Total costs by job type
        const costsByType = await jobMetrics.aggregate([
            {
                $match: {
                    ...timeFilter,
                    cost_usd: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$job_type',
                    job_count: { $sum: 1 },
                    total_cost: { $sum: '$cost_usd' },
                    avg_cost: { $avg: '$cost_usd' },
                    total_tokens: { $sum: '$tokens_used' },
                    total_api_calls: { $sum: '$api_calls' }
                }
            },
            {
                $project: {
                    job_type: '$_id',
                    job_count: 1,
                    total_cost: 1,
                    avg_cost: 1,
                    total_tokens: 1,
                    total_api_calls: 1,
                    _id: 0
                }
            },
            { $sort: { total_cost: -1 } }
        ]).toArray();

        // Cost over time
        const costsOverTime = await jobMetrics.aggregate([
            {
                $match: {
                    ...timeFilter,
                    cost_usd: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: {
                        hour: { $dateToString: { format: "%Y-%m-%d-%H", date: "$started_at" } }
                    },
                    hourly_cost: { $sum: '$cost_usd' },
                    job_count: { $sum: 1 }
                }
            },
            { $sort: { '_id.hour': -1 } },
            { $limit: 24 },
            {
                $project: {
                    hour: '$_id.hour',
                    hourly_cost: 1,
                    job_count: 1,
                    _id: 0
                }
            }
        ]).toArray();

        // Cost efficiency metrics
        const efficiency = await jobMetrics.aggregate([
            {
                $match: {
                    ...timeFilter,
                    cost_usd: { $exists: true, $ne: null },
                    duration_ms: { $exists: true, $ne: null },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    avg_cost_per_second: {
                        $avg: {
                            $cond: {
                                if: { $gt: ['$duration_ms', 0] },
                                then: {
                                    $divide: [
                                        '$cost_usd',
                                        { $divide: ['$duration_ms', 1000] }
                                    ]
                                },
                                else: 0
                            }
                        }
                    },
                    avg_tokens_per_dollar: {
                        $avg: {
                            $cond: {
                                if: { $gt: ['$cost_usd', 0] },
                                then: { $divide: ['$tokens_used', '$cost_usd'] },
                                else: 0
                            }
                        }
                    }
                }
            }
        ]).toArray();

        // Calculate percentiles manually (MongoDB doesn't have built-in percentile functions)
        const allCosts = await jobMetrics.find({
            ...timeFilter,
            cost_usd: { $exists: true, $ne: null }
        }).sort({ cost_usd: 1 }).toArray();

        const median_cost = allCosts.length > 0 ?
            allCosts[Math.floor(allCosts.length * 0.5)]?.cost_usd : 0;
        const p95_cost = allCosts.length > 0 ?
            allCosts[Math.floor(allCosts.length * 0.95)]?.cost_usd : 0;

        trackHealthCheck('cost_metrics', 'success');

        res.json({
            success: true,
            metrics: {
                timeRange,
                costsByType: costsByType,
                costsOverTime: costsOverTime,
                efficiency: {
                    ...efficiency[0],
                    median_cost,
                    p95_cost
                },
                totalCost: costsByType.reduce((sum, row) => sum + (row.total_cost || 0), 0),
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting cost metrics:', error);
        trackHealthCheck('cost_metrics', 'error');
        res.status(500).json({
            error: error.message
        });
    }
});

// Get performance metrics
router.get('/performance', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
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

        // Performance by job type
        const performanceByType = await jobMetrics.aggregate([
            {
                $match: {
                    ...timeFilter,
                    duration_ms: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$job_type',
                    job_count: { $sum: 1 },
                    avg_duration_ms: { $avg: '$duration_ms' },
                    min_duration_ms: { $min: '$duration_ms' },
                    max_duration_ms: { $max: '$duration_ms' },
                    successful_jobs: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    failed_jobs: {
                        $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                    }
                }
            },
            {
                $addFields: {
                    success_rate: {
                        $multiply: [
                            { $divide: ['$successful_jobs', '$job_count'] },
                            100
                        ]
                    }
                }
            },
            {
                $project: {
                    job_type: '$_id',
                    job_count: 1,
                    avg_duration_ms: 1,
                    min_duration_ms: 1,
                    max_duration_ms: 1,
                    successful_jobs: 1,
                    failed_jobs: 1,
                    success_rate: { $round: ['$success_rate', 2] },
                    _id: 0
                }
            },
            { $sort: { avg_duration_ms: -1 } }
        ]).toArray();

        // Throughput over time
        const throughputOverTime = await jobMetrics.aggregate([
            {
                $match: {
                    ...timeFilter,
                    status: 'completed',
                    completed_at: { $exists: true }
                }
            },
            {
                $group: {
                    _id: {
                        hour: { $dateToString: { format: "%Y-%m-%d-%H", date: "$completed_at" } }
                    },
                    jobs_completed: { $sum: 1 },
                    avg_duration_ms: { $avg: '$duration_ms' }
                }
            },
            { $sort: { '_id.hour': -1 } },
            { $limit: 24 },
            {
                $project: {
                    hour: '$_id.hour',
                    jobs_completed: 1,
                    avg_duration_ms: 1,
                    _id: 0
                }
            }
        ]).toArray();

        // Error rates
        const errorRates = await jobMetrics.aggregate([
            { $match: timeFilter },
            {
                $group: {
                    _id: '$job_type',
                    total_jobs: { $sum: 1 },
                    failed_jobs: {
                        $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                    },
                    jobs_with_errors: {
                        $sum: { $cond: [{ $ne: ['$error_message', null] }, 1, 0] }
                    }
                }
            },
            {
                $addFields: {
                    error_rate: {
                        $multiply: [
                            { $divide: ['$failed_jobs', '$total_jobs'] },
                            100
                        ]
                    }
                }
            },
            {
                $project: {
                    job_type: '$_id',
                    total_jobs: 1,
                    failed_jobs: 1,
                    error_rate: { $round: ['$error_rate', 2] },
                    jobs_with_errors: 1,
                    _id: 0
                }
            },
            { $sort: { error_rate: -1 } }
        ]).toArray();

        // Queue performance (simplified)
        const queueMetrics = await jobMetrics.aggregate([
            {
                $match: {
                    ...timeFilter,
                    status: 'completed',
                    started_at: { $exists: true },
                    completed_at: { $exists: true }
                }
            },
            {
                $addFields: {
                    queue_time_seconds: {
                        $divide: [
                            { $subtract: ['$completed_at', '$started_at'] },
                            1000
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avg_queue_time_seconds: { $avg: '$queue_time_seconds' }
                }
            }
        ]).toArray();

        trackHealthCheck('performance_metrics', 'success');

        res.json({
            success: true,
            metrics: {
                timeRange,
                performanceByType: performanceByType,
                throughputOverTime: throughputOverTime,
                errorRates: errorRates,
                queueMetrics: queueMetrics[0] || {},
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting performance metrics:', error);
        trackHealthCheck('performance_metrics', 'error');
        res.status(500).json({
            error: error.message
        });
    }
});

// Get real-time system metrics
router.get('/system', (req, res) => {
    try {
        const systemMetrics = {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            version: process.version,
            platform: process.platform,
            arch: process.arch,
            loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
            timestamp: new Date()
        };

        trackHealthCheck('system_metrics', 'success');

        res.json({
            success: true,
            metrics: systemMetrics
        });
    } catch (error) {
        logger.error('Error getting system metrics:', error);
        trackHealthCheck('system_metrics', 'error');
        res.status(500).json({
            error: error.message
        });
    }
});

// Get detailed job metrics for a specific job
router.get('/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const db = getDatabase();
        const jobMetrics = db.collection('job_metrics');

        const jobMetric = await jobMetrics.findOne({ job_id: jobId });

        if (!jobMetric) {
            return res.status(404).json({
                error: 'Job metrics not found'
            });
        }

        trackHealthCheck('job_metrics_lookup', 'success');

        res.json({
            success: true,
            metrics: jobMetric
        });
    } catch (error) {
        logger.error(`Error getting job metrics for ${req.params.jobId}:`, error);
        trackHealthCheck('job_metrics_lookup', 'error');
        res.status(500).json({
            error: error.message
        });
    }
});

router.get('/prometheus', async (req, res) => {
    try {
        res.set('Content-Type', promClient.register.contentType);
        const metrics = await promClient.register.metrics();
        res.end(metrics);
    } catch (error) {
        res.status(500).end(error);
    }
});

// Get aggregated dashboard metrics
router.get('/dashboard', async (req, res) => {
    try {
        const db = getDatabase();
        const jobMetrics = db.collection('job_metrics');
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Get summary stats for last 24 hours
        const summary = await jobMetrics.aggregate([
            { $match: { started_at: { $gte: twentyFourHoursAgo } } },
            {
                $group: {
                    _id: null,
                    total_jobs: { $sum: 1 },
                    completed_jobs: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    failed_jobs: {
                        $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                    },
                    running_jobs: {
                        $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] }
                    },
                    total_cost: { $sum: '$cost_usd' },
                    avg_duration_ms: { $avg: '$duration_ms' },
                    total_tokens: { $sum: '$tokens_used' }
                }
            }
        ]).toArray();

        // Get recent activity (last 10 jobs)
        const recentActivity = await jobMetrics.find({})
            .sort({ started_at: -1 })
            .limit(10)
            .project({
                job_id: 1,
                job_type: 1,
                status: 1,
                started_at: 1,
                completed_at: 1,
                duration_ms: 1,
                cost_usd: 1
            })
            .toArray();

        // Get job type distribution
        const typeDistribution = await jobMetrics.aggregate([
            { $match: { started_at: { $gte: twentyFourHoursAgo } } },
            {
                $group: {
                    _id: '$job_type',
                    count: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    job_type: '$_id'
                }
            },
            {
                $lookup: {
                    from: 'job_metrics',
                    pipeline: [
                        { $match: { started_at: { $gte: twentyFourHoursAgo } } },
                        { $count: 'total' }
                    ],
                    as: 'total_count'
                }
            },
            {
                $addFields: {
                    percentage: {
                        $round: [
                            {
                                $multiply: [
                                    { $divide: ['$count', { $arrayElemAt: ['$total_count.total', 0] }] },
                                    100
                                ]
                            },
                            2
                        ]
                    }
                }
            },
            {
                $project: {
                    job_type: 1,
                    count: 1,
                    percentage: 1,
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ]).toArray();

        trackHealthCheck('dashboard_metrics', 'success');

        res.json({
            success: true,
            dashboard: {
                summary: summary[0] || {},
                recentActivity: recentActivity,
                typeDistribution: typeDistribution,
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting dashboard metrics:', error);
        trackHealthCheck('dashboard_metrics', 'error');
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;