const express = require('express');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get concurrency metrics
router.get('/concurrency', async (req, res) => {
    try {
        const pool = getPool();

        // Get current running jobs
        const runningJobs = await pool.query(`
            SELECT 
                job_type,
                COUNT(*) as count
            FROM job_metrics 
            WHERE status = 'running'
            GROUP BY job_type
        `);

        // Get jobs by status in last hour
        const statusMetrics = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM job_metrics 
            WHERE started_at >= NOW() - INTERVAL '1 hour'
            GROUP BY status
        `);

        // Get concurrent job peaks
        const concurrencyPeaks = await pool.query(`
            SELECT 
                DATE_TRUNC('hour', started_at) as hour,
                MAX(concurrent_count) as peak_concurrency
            FROM (
                SELECT 
                    started_at,
                    COUNT(*) OVER (
                        ORDER BY started_at 
                        RANGE BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
                    ) as concurrent_count
                FROM job_metrics
                WHERE started_at >= NOW() - INTERVAL '24 hours'
                  AND status IN ('running', 'completed')
            ) subq
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
        `);

        res.json({
            success: true,
            metrics: {
                currentlyRunning: runningJobs.rows,
                statusBreakdown: statusMetrics.rows,
                concurrencyPeaks: concurrencyPeaks.rows,
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting concurrency metrics:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Get cost metrics
router.get('/costs', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
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
            case '30d':
                timeFilter = "started_at >= NOW() - INTERVAL '30 days'";
                break;
            default:
                timeFilter = "started_at >= NOW() - INTERVAL '24 hours'";
        }

        // Total costs by job type
        const costsByType = await pool.query(`
            SELECT 
                job_type,
                COUNT(*) as job_count,
                SUM(cost_usd) as total_cost,
                AVG(cost_usd) as avg_cost,
                SUM(tokens_used) as total_tokens,
                SUM(api_calls) as total_api_calls
            FROM job_metrics 
            WHERE ${timeFilter} 
              AND cost_usd IS NOT NULL
            GROUP BY job_type
            ORDER BY total_cost DESC
        `);

        // Cost over time
        const costsOverTime = await pool.query(`
            SELECT 
                DATE_TRUNC('hour', started_at) as hour,
                SUM(cost_usd) as hourly_cost,
                COUNT(*) as job_count
            FROM job_metrics
            WHERE ${timeFilter}
              AND cost_usd IS NOT NULL
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
        `);

        // Cost efficiency metrics
        const efficiency = await pool.query(`
            SELECT 
                AVG(cost_usd / NULLIF(duration_ms, 0) * 1000) as cost_per_second,
                AVG(tokens_used / NULLIF(cost_usd, 0)) as tokens_per_dollar,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_usd) as median_cost,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY cost_usd) as p95_cost
            FROM job_metrics
            WHERE ${timeFilter}
              AND cost_usd IS NOT NULL
              AND duration_ms IS NOT NULL
              AND status = 'completed'
        `);

        res.json({
            success: true,
            metrics: {
                timeRange,
                costsByType: costsByType.rows,
                costsOverTime: costsOverTime.rows,
                efficiency: efficiency.rows[0] || {},
                totalCost: costsByType.rows.reduce((sum, row) => sum + parseFloat(row.total_cost || 0), 0),
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting cost metrics:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Get performance metrics
router.get('/performance', async (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
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

        // Performance by job type
        const performanceByType = await pool.query(`
            SELECT 
                job_type,
                COUNT(*) as job_count,
                AVG(duration_ms) as avg_duration_ms,
                MIN(duration_ms) as min_duration_ms,
                MAX(duration_ms) as max_duration_ms,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as median_duration_ms,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_jobs,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
                ROUND(
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2
                ) as success_rate
            FROM job_metrics 
            WHERE ${timeFilter}
              AND duration_ms IS NOT NULL
            GROUP BY job_type
            ORDER BY avg_duration_ms DESC
        `);

        // Throughput over time
        const throughputOverTime = await pool.query(`
            SELECT 
                DATE_TRUNC('hour', completed_at) as hour,
                COUNT(*) as jobs_completed,
                AVG(duration_ms) as avg_duration_ms
            FROM job_metrics
            WHERE ${timeFilter}
              AND status = 'completed'
              AND completed_at IS NOT NULL
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
        `);

        // Error rates
        const errorRates = await pool.query(`
            SELECT 
                job_type,
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
                ROUND(
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0 / COUNT(*), 2
                ) as error_rate,
                COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as jobs_with_errors
            FROM job_metrics
            WHERE ${timeFilter}
            GROUP BY job_type
            ORDER BY error_rate DESC
        `);

        // Queue performance
        const queueMetrics = await pool.query(`
            SELECT 
                AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_queue_time_seconds,
                PERCENTILE_CONT(0.5) WITHIN GROUP (
                    ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at))
                ) as median_queue_time_seconds,
                PERCENTILE_CONT(0.95) WITHIN GROUP (
                    ORDER BY EXTRACT(EPOCH FROM (completed_at - started_at))
                ) as p95_queue_time_seconds
            FROM job_metrics
            WHERE ${timeFilter}
              AND status = 'completed'
              AND started_at IS NOT NULL
              AND completed_at IS NOT NULL
        `);

        res.json({
            success: true,
            metrics: {
                timeRange,
                performanceByType: performanceByType.rows,
                throughputOverTime: throughputOverTime.rows,
                errorRates: errorRates.rows,
                queueMetrics: queueMetrics.rows[0] || {},
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting performance metrics:', error);
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

        res.json({
            success: true,
            metrics: systemMetrics
        });
    } catch (error) {
        logger.error('Error getting system metrics:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Get detailed job metrics for a specific job
router.get('/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const pool = getPool();

        const jobMetrics = await pool.query(`
            SELECT *
            FROM job_metrics
            WHERE job_id = $1
        `, [jobId]);

        if (jobMetrics.rows.length === 0) {
            return res.status(404).json({
                error: 'Job metrics not found'
            });
        }

        res.json({
            success: true,
            metrics: jobMetrics.rows[0]
        });
    } catch (error) {
        logger.error(`Error getting job metrics for ${req.params.jobId}:`, error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Get aggregated dashboard metrics
router.get('/dashboard', async (req, res) => {
    try {
        const pool = getPool();

        // Get summary stats for last 24 hours
        const summary = await pool.query(`
            SELECT 
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
                COUNT(CASE WHEN status = 'running' THEN 1 END) as running_jobs,
                SUM(cost_usd) as total_cost,
                AVG(duration_ms) as avg_duration_ms,
                SUM(tokens_used) as total_tokens
            FROM job_metrics
            WHERE started_at >= NOW() - INTERVAL '24 hours'
        `);

        // Get recent activity (last 10 jobs)
        const recentActivity = await pool.query(`
            SELECT 
                job_id,
                job_type,
                status,
                started_at,
                completed_at,
                duration_ms,
                cost_usd
            FROM job_metrics
            ORDER BY started_at DESC
            LIMIT 10
        `);

        // Get job type distribution
        const typeDistribution = await pool.query(`
            SELECT 
                job_type,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
            FROM job_metrics
            WHERE started_at >= NOW() - INTERVAL '24 hours'
            GROUP BY job_type
            ORDER BY count DESC
        `);

        res.json({
            success: true,
            dashboard: {
                summary: summary.rows[0] || {},
                recentActivity: recentActivity.rows,
                typeDistribution: typeDistribution.rows,
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting dashboard metrics:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;