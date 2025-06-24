const express = require('express');
const { checkDatabaseHealth } = require('../config/database');
const { checkRabbitMQHealth } = require('../config/rabbitmq');
const alchemystService = require('../services/alchemystService');
const logger = require('../utils/logger');

const router = express.Router();

// Basic health check
router.get('/', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            uptime: process.uptime(),
            version: '1.0.0',
            services: {
                api: { status: 'healthy' }
            }
        };

        res.json(health);
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Comprehensive health check
router.get('/detailed', async (req, res) => {
    try {
        const [dbHealth, mqHealth, apiHealth] = await Promise.allSettled([
            checkDatabaseHealth(),
            checkRabbitMQHealth(),
            alchemystService.testConnection()
        ]);

        // Build health object first
        const health = {
            services: {
                database: {
                    healthy: dbHealth.status === 'fulfilled' ? dbHealth.value.healthy : false,
                    host: dbHealth.status === 'fulfilled' ? dbHealth.value.host : 'N/A',
                    timestamp: dbHealth.status === 'fulfilled' ? dbHealth.value.timestamp : new Date()
                },
                rabbitmq: {
                    healthy: mqHealth.status === 'fulfilled' ? mqHealth.value.healthy : false,
                    timestamp: mqHealth.status === 'fulfilled' ? mqHealth.value.timestamp : new Date()
                },
                alchemyst_api: {
                    healthy: apiHealth.status === 'fulfilled' ? apiHealth.value.success : false,
                    timestamp: new Date()
                }
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date()
        };

        // Then determine overall health
        const allHealthy = Object.values(health.services).every(service => service.healthy);
        health.status = allHealthy ? 'healthy' : 'degraded';

        const statusCode = allHealthy ? 200 : 503;
        res.status(statusCode).json(health);
        // In the detailed health check route, after res.status(statusCode).json(health);
        const { trackHealthCheck } = require('../telemetry/metrics');
        trackHealthCheck('detailed_health_check', allHealthy ? 'success' : 'failed');
    } catch (error) {
        logger.error('Detailed health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date()
        });
    }
});

// Readiness probe
router.get('/ready', async (req, res) => {
    try {
        // Check if all critical services are ready
        const [dbHealth, mqHealth] = await Promise.all([
            checkDatabaseHealth(),
            checkRabbitMQHealth()
        ]);

        const ready = dbHealth.healthy && mqHealth.healthy;

        res.status(ready ? 200 : 503).json({
            ready,
            timestamp: new Date(),
            services: {
                database: dbHealth.healthy,
                rabbitmq: mqHealth.healthy
            }
        });
    } catch (error) {
        logger.error('Readiness check failed:', error);
        res.status(503).json({
            ready: false,
            error: error.message,
            timestamp: new Date()
        });
    }
});

// Test Alchemyst API connection
router.get('/alchemyst-test', async (req, res) => {
    try {
        const alchemystService = require('../services/alchemystService');
        const result = await alchemystService.testConnection();

        res.json({
            success: result.success,
            message: result.success ? 'Alchemyst API connected successfully' : 'Alchemyst API connection failed',
            details: result,
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date()
        });
    }
});
// Liveness probe
router.get('/live', (req, res) => {
    res.json({
        alive: true,
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

module.exports = router;