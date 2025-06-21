require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

// Import configurations
const { connectDatabase } = require('./config/database');
const { initializeAgenda, gracefulShutdown } = require('./config/agenda');
const { connectRabbitMQ, closeRabbitMQ } = require('./config/rabbitmq');

// Import routes
const jobRoutes = require('./routes/jobs');
const metricsRoutes = require('./routes/metrics');
const healthRoutes = require('./routes/health');

// Import middleware and services
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const socketService = require('./services/socketService');

// Configuration
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Critical: bind to all interfaces
const FRONTEND_URL = process.env.FRONTEND_URL || "http://35.209.5.151:3000";

const app = express();
const server = createServer(app);

// Enhanced CORS configuration
const corsOptions = {
    origin: [
        FRONTEND_URL,
        'http://localhost:3000',
        'http://35.209.5.151:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

const io = new Server(server, {
    cors: corsOptions
});

// Basic middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add security headers
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
});

// Rate limiting with more lenient settings for development
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Increased limit for testing
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);

// Enhanced request logging middleware
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            duration: `${duration}ms`,
            contentLength: res.get('Content-Length')
        });
    });

    next();
});

// Health check route (before other routes)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
    });
});

// Basic route for testing (enhanced)
app.get('/', (req, res) => {
    res.json({
        message: 'Alchemyst Platform API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            health: '/health',
            api: '/api',
            jobs: '/api/jobs',
            metrics: '/api/metrics',
            healthCheck: '/api/health'
        }
    });
});

// Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);

// Test endpoint for debugging
app.get('/test', (req, res) => {
    res.json({
        message: 'Test endpoint working',
        timestamp: new Date(),
        headers: req.headers,
        ip: req.ip
    });
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
    logger.info('Client connected to socket', { socketId: socket.id });

    // Send current system status on connection
    socket.emit('system_status', {
        status: 'connected',
        timestamp: new Date(),
        message: 'Connected to Alchemyst Platform'
    });

    // Handle client requesting job updates
    socket.on('subscribe_job_updates', (jobId) => {
        if (jobId) {
            socket.join(`job_${jobId}`);
            logger.info(`Client subscribed to job updates: ${jobId}`, { socketId: socket.id });
        }
    });

    socket.on('unsubscribe_job_updates', (jobId) => {
        if (jobId) {
            socket.leave(`job_${jobId}`);
            logger.info(`Client unsubscribed from job updates: ${jobId}`, { socketId: socket.id });
        }
    });

    // Handle general metrics subscription
    socket.on('subscribe_metrics', () => {
        socket.join('metrics_updates');
        logger.info('Client subscribed to metrics updates', { socketId: socket.id });
    });

    socket.on('unsubscribe_metrics', () => {
        socket.leave('metrics_updates');
        logger.info('Client unsubscribed from metrics updates', { socketId: socket.id });
    });

    socket.on('disconnect', (reason) => {
        logger.info('Client disconnected from socket', {
            socketId: socket.id,
            reason
        });
    });

    socket.on('error', (error) => {
        logger.error('Socket error:', {
            socketId: socket.id,
            error: error.message
        });
    });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    logger.warn(`404 - Route not found: ${req.originalUrl}`, {
        method: req.method,
        ip: req.ip
    });
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// Global error handlers
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    setTimeout(() => {
        gracefulShutdown().then(() => process.exit(1));
    }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    setTimeout(() => {
        gracefulShutdown().then(() => process.exit(1));
    }, 1000);
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await shutdown();
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await shutdown();
});

const shutdown = async () => {
    try {
        logger.info('Starting graceful shutdown...');

        // Stop accepting new connections
        server.close(() => {
            logger.info('HTTP server closed');
        });

        // Close socket connections
        io.close(() => {
            logger.info('Socket.io server closed');
        });

        // Shutdown AgendaJS
        await gracefulShutdown();

        // Close RabbitMQ connection
        await closeRabbitMQ();

        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};

// Initialize services and start server
async function initializeApp() {
    try {
        logger.info('🚀 Starting Alchemyst Platform...');

        // Always start the HTTP server first (even if services fail)
        server.listen(PORT, HOST, () => {
            logger.info(`✅ HTTP Server running on ${HOST}:${PORT}`);
            logger.info(`📊 Health check: http://localhost:${PORT}/health`);
            logger.info(`🌐 External access: http://35.209.5.151:${PORT}`);
            logger.info(`🔗 Test endpoint: http://35.209.5.151:${PORT}/test`);
        });

        // Initialize socket service early
        socketService.initialize(io);
        logger.info('✅ Socket service initialized');

        // Try to initialize other services (but don't fail if they're unavailable)
        try {
            logger.info('🔌 Connecting to database...');
            await connectDatabase();
            logger.info('✅ Database connected successfully');
        } catch (error) {
            logger.error('❌ Database connection failed, continuing without it:', error.message);
        }

        try {
            logger.info(' Connecting to RabbitMQ...');
            await connectRabbitMQ();
            logger.info('RabbitMQ connected successfully');
        } catch (error) {
            logger.error('❌ RabbitMQ connection failed, continuing without it:', error.message);
        }

        try {
            logger.info(' Initializing AgendaJS...');
            await initializeAgenda();
            logger.info('AgendaJS initialized successfully');
        } catch (error) {
            logger.error('❌ AgendaJS initialization failed, continuing without it:', error.message);
        }

        // Emit server ready event
        setTimeout(() => {
            io.emit('server_ready', {
                status: 'ready',
                port: PORT,
                host: HOST,
                timestamp: new Date(),
                services: {
                    http: 'connected',
                    websocket: 'connected',
                    database: 'check logs',
                    rabbitmq: 'check logs',
                    agenda: 'check logs'
                }
            });
        }, 1000);

        // Set up periodic health broadcasts
        setInterval(() => {
            io.emit('health_update', {
                status: 'healthy',
                timestamp: new Date(),
                uptime: process.uptime(),
                memory: process.memoryUsage()
            });
        }, 30000); // Every 30 seconds

        logger.info('🎉 Alchemyst Platform initialization completed!');

    } catch (error) {
        logger.error('💥 Failed to initialize app:', error);

        // Still try to start the basic HTTP server
        server.listen(PORT, HOST, () => {
            logger.info(`⚠️  Basic HTTP Server running on ${HOST}:${PORT} (degraded mode)`);
            logger.info(`🔗 Test endpoint: http://35.209.5.151:${PORT}/test`);
        });
    }
}

// Start the application
initializeApp();

// Export for testing
module.exports = { app, server };