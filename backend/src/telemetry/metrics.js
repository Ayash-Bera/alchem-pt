// backend/src/telemetry/metrics.js
const { metrics, trace } = require('@opentelemetry/api');
const { isInitializedTelemetry } = require('./telemetry');

// Get meter for custom metrics
const meter = metrics.getMeter('alchemyst-platform', '1.0.0');
const tracer = trace.getTracer('alchemyst-platform', '1.0.0');
const promClient = require('prom-client');

// Custom metrics
let customMetrics = {};
let metricsInitialized = false;

const promMetrics = {
    jobDuration: new promClient.Histogram({
        name: 'alchemyst_job_duration_seconds',
        help: 'Duration of job processing in seconds',
        labelNames: ['job_type', 'status']
    }),

    jobsTotal: new promClient.Counter({
        name: 'alchemyst_jobs_total',
        help: 'Total number of jobs processed',
        labelNames: ['job_type', 'status']
    }),

    apiCallDuration: new promClient.Histogram({
        name: 'alchemyst_api_call_duration_seconds',
        help: 'Duration of API calls in seconds',
        labelNames: ['api', 'status']
    }),

    errors: new promClient.Counter({
        name: 'alchemyst_errors_total',
        help: 'Total number of errors',
        labelNames: ['error_type', 'service']
    })
};

const initializeCustomMetrics = () => {
    try {
        console.log('🔧 Initializing custom metrics...');

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

        metricsInitialized = true;
        console.log('✅ Custom metrics defined:', Object.keys(customMetrics));

        // Force initial metric values to make them visible in Prometheus
        setTimeout(() => {
            try {
                console.log('📊 Recording initial metric values...');

                // Record baseline values
                customMetrics.healthChecks.add(1, { service: 'system', status: 'init' });
                customMetrics.jobsTotal.add(0, { job_type: 'init', status: 'completed' });
                customMetrics.jobsActive.add(0, { job_type: 'init' });
                customMetrics.apiCallsTotal.add(1, { api: 'system_init', status: 'success' });
                customMetrics.apiCallDuration.record(0.1, { api: 'system_init', status: 'success' });
                customMetrics.apiCallCost.record(0.001, { api: 'system_init' });
                customMetrics.tokensUsed.add(10, { api: 'system_init' });
                customMetrics.errors.add(0, { error_type: 'init', service: 'system' });
                customMetrics.queueDepth.add(0, { queue_type: 'agenda' });

                console.log('✅ Initial metric values recorded successfully');
            } catch (error) {
                console.error('❌ Error recording initial metrics:', error);
            }
        }, 1000);

    } catch (error) {
        console.error('❌ Failed to initialize custom metrics:', error);
        metricsInitialized = false;
    }
};

// Job tracking functions
const startJobSpan = (jobName, jobData) => {
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
            console.log('📊 Job started, active jobs increased:', jobName);
        }

        return { span, startTime: Date.now() };
    } catch (error) {
        console.error('❌ Error starting job span:', error);
        return { span: null, startTime: Date.now() };
    }
};

const endJobSpan = (spanData, jobName, status, result = null) => {
    try {
        if (!spanData) return;

        const { span, startTime } = spanData;
        const duration = (Date.now() - startTime) / 1000;

        // Record metrics
        if (customMetrics.jobDuration) {
            customMetrics.jobDuration.record(duration, {
                job_type: jobName,
                status: status
            });
            console.log('📊 Job duration recorded:', { jobName, duration, status });
        }

        if (customMetrics.jobsTotal) {
            customMetrics.jobsTotal.add(1, {
                job_type: jobName,
                status: status
            });
            console.log('📊 Job total incremented:', { jobName, status });
        }

        if (customMetrics.jobsActive) {
            customMetrics.jobsActive.add(-1, { job_type: jobName });
            console.log('📊 Job finished, active jobs decreased:', jobName);
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
        console.error('❌ Error ending job span:', error);
    }
};

// API call tracking
const trackApiCall = (apiName, duration, cost, tokens, status = 'success') => {
    try {
        console.log('📊 Recording API call metric:', { apiName, duration, cost, tokens, status });

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
        if (cost && promMetrics.apiCallCost) {
            promMetrics.apiCallCost.observe({ api: apiName }, cost);
        }
        // Add after existing OpenTelemetry code:
        if (promMetrics.apiCallDuration) {
            promMetrics.apiCallDuration.observe({ api: apiName, status }, duration);
        }

        // Add after existing OpenTelemetry code:
        if (promMetrics.errors) {
            promMetrics.errors.inc({ error_type: errorType, service });
        }

        console.log('✅ API call metrics recorded successfully');
    } catch (error) {
        console.error('❌ Error tracking API call:', error);
    }
};

// Queue monitoring
const updateQueueDepth = (depth, queueType = 'agenda') => {
    try {
        if (customMetrics.queueDepth) {
            customMetrics.queueDepth.add(depth, { queue_type: queueType });
            console.log('📊 Queue depth updated:', { depth, queueType });
        }
    } catch (error) {
        console.error('❌ Error updating queue depth:', error);
    }
};

// Health check tracking
const trackHealthCheck = (service, status) => {
    try {
        console.log('📊 Recording health check:', { service, status });

        if (customMetrics.healthChecks) {
            customMetrics.healthChecks.add(1, {
                service: service,
                status: status
            });
            console.log('✅ Health check metric recorded');
        }
    } catch (error) {
        console.error('❌ Error tracking health check:', error);
    }
};

// Error tracking
const trackError = (errorType, service, errorMessage = '') => {
    try {
        console.log('📊 Recording error metric:', { errorType, service, errorMessage });

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
        console.log('✅ Error metrics recorded');
    } catch (error) {
        console.error('❌ Error tracking error:', error);
    }
};

// Utility function to create custom spans
const createSpan = (name, attributes = {}) => {
    try {
        return tracer.startSpan(name, { attributes });
    } catch (error) {
        console.error('❌ Error creating span:', error);
        return null;
    }
};

// Force record test metrics (called from app.js)
const recordTestMetrics = () => {
    try {
        console.log('🧪 Recording test metrics for visibility...');

        trackHealthCheck('server_startup', 'success');
        trackApiCall('startup_test', 0.1, 0.001, 10, 'success');
        trackError('test_error', 'system', 'This is a test error');
        updateQueueDepth(0, 'test_queue');

        // Simulate a quick job
        const spanData = startJobSpan('test-job', { jobId: 'test-123', topic: 'test' });
        setTimeout(() => {
            endJobSpan(spanData, 'test-job', 'completed', { cost: 0.001, tokens: 5 });
        }, 100);

        console.log('✅ Test metrics recorded - should be visible in Prometheus');
    } catch (error) {
        console.error('❌ Error recording test metrics:', error);
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
    recordTestMetrics,
    tracer,
    meter
};