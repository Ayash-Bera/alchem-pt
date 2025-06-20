const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

// Import configurations
const { connectDatabase } = require('./config/database');
const { initializeAgenda } = require('./config/agenda');
const { connectRabbitMQ } = require('./config/rabbitmq');

// Import routes
const jobRoutes = require('./routes/jobs');
const metricsRoutes = require('./routes/metrics');
const healthRoutes = require('./routes/health');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL,
        methods: ["GET", "POST"]
    }
});

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
}));

// Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);

// Error handling
app.use(errorHandler);

// Socket.io for real-time updates
io.on('connection', (socket) => {
    logger.info('Client connected');

    socket.on('disconnect', () => {
        logger.info('Client disconnected');
    });
});

// Initialize services
async function initializeApp() {
    try {
        await connectDatabase();
        await connectRabbitMQ();
        await initializeAgenda();

        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to initialize app:', error);
        process.exit(1);
    }
}

initializeApp();

module.exports = { app, io };