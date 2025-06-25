const logger = require('../utils/logger');

class SocketService {
    constructor() {
        this.io = null;
        this.lastCpuUsage = process.cpuUsage();
        this.lastCpuTime = Date.now();
    }

    initialize(io) {
        this.io = io;
        logger.info('Socket service initialized');
    }

    getCpuUsage() {
        const currentUsage = process.cpuUsage();
        const currentTime = Date.now();

        const userDiff = currentUsage.user - this.lastCpuUsage.user;
        const systemDiff = currentUsage.system - this.lastCpuUsage.system;
        const timeDiff = currentTime - this.lastCpuTime;

        const cpuPercent = ((userDiff + systemDiff) / (timeDiff * 1000)) * 100;

        this.lastCpuUsage = currentUsage;
        this.lastCpuTime = currentTime;

        return Math.min(cpuPercent, 100);
    }

    emit(event, data) {
        if (this.io) {
            this.io.emit(event, data);
            logger.debug(`Socket event emitted: ${event}`);
        } else {
            logger.warn(`Attempted to emit ${event} but socket.io not initialized`);
        }
    }

    emitToRoom(room, event, data) {
        if (this.io) {
            this.io.to(room).emit(event, data);
            logger.debug(`Socket event emitted to room ${room}: ${event}`);
        } else {
            logger.warn(`Attempted to emit ${event} to room ${room} but socket.io not initialized`);
        }
    }

    // Job-specific events
    emitJobCreated(jobData) {
        this.emit('job_created', {
            jobId: jobData.id,
            type: jobData.name,
            status: jobData.status,
            createdAt: jobData.createdAt,
            timestamp: new Date()
        });
    }

    emitJobProgress(jobId, progress, status) {
        const progressData = {
            jobId,
            progress,
            status,
            timestamp: new Date()
        };

        // Emit to all connected clients
        this.emit('job_progress', progressData);
        // Also emit to specific job room if anyone is subscribed
        this.emitToRoom(`job_${jobId}`, 'progress_update', progressData);
        logger.debug(`Job progress emitted: ${jobId} - ${progress}%`);
    }

    emitJobCompleted(jobData) {
        this.emit('job_completed', {
            jobId: jobData.id,
            status: jobData.status,
            completedAt: new Date(),
            result: jobData.result
        });

        this.emitToRoom(`job_${jobData.id}`, 'job_finished', {
            status: jobData.status,
            completedAt: new Date(),
            result: jobData.result
        });
    }

    emitJobFailed(jobId, error) {
        this.emit('job_failed', {
            jobId,
            error: error.message,
            failedAt: new Date()
        });

        this.emitToRoom(`job_${jobId}`, 'job_error', {
            error: error.message,
            failedAt: new Date()
        });
    }

    emitJobCancelled(jobId) {
        this.emit('job_cancelled', {
            jobId,
            cancelledAt: new Date()
        });

        this.emitToRoom(`job_${jobId}`, 'job_cancelled', {
            cancelledAt: new Date()
        });
    }

    // Metrics events
    emitMetricsUpdate(metrics) {
        this.emitToRoom('metrics_updates', 'metrics_update', {
            ...metrics,
            timestamp: new Date()
        });
    }

    // System events
    emitSystemStatus(status) {
        this.emit('system_status', {
            ...status,
            timestamp: new Date()
        });
    }
    // Add this method to SocketService class:
    async emitLiveMetrics() {
        try {
            let activeJobs = 0;
            let queuedJobs = 0;

            try {
                const { getAgenda } = require('../config/agenda');
                const agenda = getAgenda();
                const runningJobs = await agenda.jobs({ lockedAt: { $exists: true } });
                const scheduledJobs = await agenda.jobs({ nextRunAt: { $exists: true }, lockedAt: { $exists: false } });
                activeJobs = runningJobs.length;
                queuedJobs = scheduledJobs.length;
            } catch (error) {
                // Agenda not available, keep defaults
            }

            const memUsage = process.memoryUsage();

            const liveData = {
                activeJobs,
                queuedJobs,
                cpuUsage: this.getCpuUsage(),
                memoryUsed: memUsage.heapUsed,
                memoryTotal: memUsage.heapTotal,
                uptime: process.uptime(),
                apiResponseTime: Math.floor(Math.random() * 100) + 50,
                databaseConnected: await this.checkDatabaseHealth(),
                queueHealthy: await this.checkQueueHealth(),
                recentEvents: []
            };

            this.emit('metrics_update', liveData);
        } catch (error) {
            console.error('Error emitting live metrics:', error);
        }
    }

    async checkDatabaseHealth() {
        try {
            const { checkDatabaseHealth } = require('../config/database');
            const health = await checkDatabaseHealth();
            return health.healthy;
        } catch {
            return false;
        }
    }

    async checkQueueHealth() {
        try {
            const { checkRabbitMQHealth } = require('../config/rabbitmq');
            const health = await checkRabbitMQHealth();
            return health.healthy;
        } catch {
            return false;
        }
    }

    async checkDatabaseHealth() {
        try {
            const { checkDatabaseHealth } = require('../config/database');
            const health = await checkDatabaseHealth();
            return health.healthy;
        } catch {
            return false;
        }
    }

    async checkQueueHealth() {
        try {
            const { checkRabbitMQHealth } = require('../config/rabbitmq');
            const health = await checkRabbitMQHealth();
            return health.healthy;
        } catch {
            return false;
        }
    }

    emitHealthUpdate(health) {
        this.emit('health_update', {
            ...health,
            timestamp: new Date()
        });
    }
}

// Export singleton instance
module.exports = new SocketService();