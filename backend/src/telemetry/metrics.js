// backend/src/telemetry/metrics.js
const { metrics, trace } = require('@opentelemetry/api');
const { isInitializedTelemetry } = require('./telemetry');

// Get meter for custom metrics
const meter = metrics.getMeter('alchemyst-platform', '1.0.0');
const tracer = trace.getTracer('alchemyst-platform', '1.0.0');

// Custom metrics
let customMetrics = {};

const initializeCustomMetrics = () => {
    if (!isInitializedTelemetry()) {
        console.log('⚠️ OpenTelemetry not initialized, skipping custom metrics');
        return;
    }

    try {
        // Job processing metrics
        customMetrics.jobDuration = meter.createHistogram('alchemyst_job_duration_seconds', {
            description: 'Duration of job processing in seconds',
            unit: 's'
        });

        customMetrics.jobsTotal = meter.createCounter('alchemyst_jobs_total', {
            description: 'Total number of jobs processed'
        });

        customMetrics.jobsActive = meter.createUpDownCounter('alchemyst_jobs_active', {
            description: 'Number of currently active jobs'
        });

	customMetrics.queueDepth = meter.createUpDownCounter('alchemyst_queue_depth', {
            description: 'Current depth of job queue'
        });

        // API call metrics
        customMetrics.apiCallDuration = meter.createHistogram('alchemyst_api_call_duration_seconds', {
            description: 'Duration of external API calls in seconds',
            unit: 's'
        });

        customMetrics.apiCallsTotal = meter.createCounter('alchemyst_api_calls_total', {
            description: 'Total number of API calls made'
        });

        customMetrics.apiCallCost = meter.createHistogram('alchemyst_api_call_cost_usd', {
            description: 'Cost of API calls in USD',
            unit: 'USD'
        });

        // Token usage metrics
        customMetrics.tokensUsed = meter.createCounter('alchemyst_tokens_used_total', {
            description: 'Total number of tokens used'
        });

        // System health metrics
        customMetrics.healthChecks = meter.createCounter('alchemyst_health_checks_total', {
            description: 'Total number of health checks performed'
        });

        customMetrics.errors = meter.createCounter('alchemyst_errors_total', {
            description: 'Total number of errors encountered'
        });
        
        console.log('✅ Custom metrics initialized:', Object.keys(customMetrics));  
    } catch (error) {
        console.error('❌ Failed to initialize custom metrics:', error);
    }
};

// Job tracking functions
const startJobSpan = (jobName, jobData) => {
    if (!isInitializedTelemetry()) return { span: null, startTime: Date.now() };

    try {
        const span = tracer.startSpan(`job.${jobName}`, {
            attributes: {
                'job.type': jobName,
                'job.id': jobData.jobId || 'unknown',
                'job.topic': jobData.topic || 'unknown',
                'job.priority': jobData.priority || 'normal'
            }
        });

        // Track active jobs
        if (customMetrics.jobsActive) {
            customMetrics.jobsActive.add(1, { job_type: jobName });
        }

        return { span, startTime: Date.now() };
    } catch (error) {
        console.error('Error starting job span:', error);
        return { span: null, startTime: Date.now() };
    }
};

const endJobSpan = (spanData, jobName, status, result = null) => {
    if (!isInitializedTelemetry() || !spanData) return;

    try {
        const { span, startTime } = spanData;
        const duration = (Date.now() - startTime) / 1000;

        // Record metrics
        if (customMetrics.jobDuration) {
            customMetrics.jobDuration.record(duration, {
                job_type: jobName,
                status: status
            });
        }

        if (customMetrics.jobsTotal) {
            customMetrics.jobsTotal.add(1, {
                job_type: jobName,
                status: status
            });
        }

        if (customMetrics.jobsActive) {
            customMetrics.jobsActive.add(-1, { job_type: jobName });
        }

        // Add span attributes
        if (span) {
            span.setAttributes({
                'job.status': status,
                'job.duration_seconds': duration
            });

            if (result && result.cost) {
                span.setAttribute('job.cost_usd', result.cost);
            }

            if (result && result.tokens) {
                span.setAttribute('job.tokens_used', result.tokens);
            }

            if (status === 'completed') {
                span.setStatus({ code: 1 });
            } else if (status === 'failed') {
                span.setStatus({
                    code: 2,
                    message: result?.error || 'Job failed'
                });
            }

            span.end();
        }
    } catch (error) {
        console.error('Error ending job span:', error);
    }
};

// API call tracking
const trackApiCall = (apiName, duration, cost, tokens, status = 'success') => {
    if (!isInitializedTelemetry()) return;

    try {
        if (customMetrics.apiCallDuration) {
            customMetrics.apiCallDuration.record(duration, {
                api: apiName,
                status: status
            });
        }

        if (customMetrics.apiCallsTotal) {
            customMetrics.apiCallsTotal.add(1, {
                api: apiName,
                status: status
            });
        }

        if (cost && customMetrics.apiCallCost) {
            customMetrics.apiCallCost.record(cost, {
                api: apiName
            });
        }

        if (tokens && customMetrics.tokensUsed) {
            customMetrics.tokensUsed.add(tokens, {
                api: apiName
            });
        }
    } catch (error) {
        console.error('Error tracking API call:', error);
    }
};

// Queue monitoring
const updateQueueDepth = (depth, queueType = 'agenda') => {
    if (!isInitializedTelemetry()) return;

    try {
        if (customMetrics.queueDepth) {
            customMetrics.queueDepth.record(depth, { queue_type: queueType });
        }
    } catch (error) {
        console.error('Error updating queue depth:', error);
    }
};

// Health check tracking
const trackHealthCheck = (service, status) => {
    if (!isInitializedTelemetry()) return;

    try {
        if (customMetrics.healthChecks) {
            customMetrics.healthChecks.add(1, {
                service: service,
                status: status
            });
        }
    } catch (error) {
        console.error('Error tracking health check:', error);
    }
};

// Error tracking
const trackError = (errorType, service, errorMessage = '') => {
    if (!isInitializedTelemetry()) return;

    try {
        if (customMetrics.errors) {
            customMetrics.errors.add(1, {
                error_type: errorType,
                service: service
            });
        }

        // Also create an error span for better tracing
        const span = tracer.startSpan(`error.${errorType}`, {
            attributes: {
                'error.type': errorType,
                'error.service': service,
                'error.message': errorMessage
            }
        });

        span.setStatus({
            code: 2,
            message: errorMessage
        });

        span.end();
    } catch (error) {
        console.error('Error tracking error:', error);
    }
};

// Utility function to create custom spans
const createSpan = (name, attributes = {}) => {
    if (!isInitializedTelemetry()) return null;

    try {
        return tracer.startSpan(name, { attributes });
    } catch (error) {
        console.error('Error creating span:', error);
        return null;
    }
};

module.exports = {
    initializeCustomMetrics,
    startJobSpan,
    endJobSpan,
    trackApiCall,
    updateQueueDepth,
    trackHealthCheck,
    trackError,
    createSpan,
    tracer,
    meter
};
