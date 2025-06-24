const logger = require('../utils/logger');

class SocketService {
    constructor() {
        this.io = null;
    }

    initialize(io) {
        this.io = io;
        logger.info('Socket service initialized');
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
        this.emit('job_progress', {
            jobId,
            progress,
            status,
            timestamp: new Date()
        });

        // Also emit to specific job room
        this.emitToRoom(`job_${jobId}`, 'progress_update', {
            progress,
            status,
            timestamp: new Date()
        });
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
    emitLiveMetrics() {
        const liveData = {
            activeJobs: 0, // Get from agenda
            queuedJobs: 0,
            cpuUsage: process.cpuUsage().system / 1000000, // Convert to percentage
            memoryUsed: process.memoryUsage().heapUsed,
            memoryTotal: process.memoryUsage().heapTotal,
            uptime: process.uptime(),
            apiResponseTime: Math.floor(Math.random() * 100) + 50, // Or track real response times
            databaseConnected: true, // Check actual DB connection
            queueHealthy: true, // Check actual queue health
            recentEvents: [] // Add recent system events
        };

        this.emit('metrics_update', liveData);
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