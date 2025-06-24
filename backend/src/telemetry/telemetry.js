// backend/src/telemetry/telemetry.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');


let sdk = null;
let isInitialized = false;

const initializeTelemetry = () => {
    try {
        // Skip initialization in test environments or if already initialized
        if (process.env.NODE_ENV === 'test' || isInitialized) {
            return;
        }

        console.log('🔭 Initializing OpenTelemetry...');

        // Create resource with service information
        const resource = new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'alchemyst-platform',
            [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
            [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'alchemyst',
            [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
        });

        // Configure trace exporter (Google Cloud or local)
        const traceExporter = process.env.GOOGLE_CLOUD_PROJECT
            ? new OTLPTraceExporter({
                url: `https://cloudtrace.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/traces:batchWrite`,
            })
            : new OTLPTraceExporter({
                url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
            });

        // Configure Prometheus metrics exporter


        // Initialize SDK with auto-instrumentations
        sdk = new NodeSDK({
            resource,
            traceExporter,
            instrumentations: [
                getNodeAutoInstrumentations({
                    // Disable problematic instrumentations that might conflict
                    '@opentelemetry/instrumentation-fs': {
                        enabled: false, // Can be noisy
                    },
                    '@opentelemetry/instrumentation-winston': {
                        enabled: true, // Keep logging instrumentation
                    },
                    '@opentelemetry/instrumentation-http': {
                        enabled: true,
                        requestHook: (span, request) => {
                            // Add custom attributes to HTTP spans
                            span.setAttributes({
                                'http.user_agent': request.headers['user-agent'],
                                'alchemyst.request_id': request.headers['x-request-id'] || 'unknown'
                            });
                        }
                    },
                    '@opentelemetry/instrumentation-express': {
                        enabled: true,
                    },
                    '@opentelemetry/instrumentation-mongoose': {
                        enabled: true,
                    }
                })
            ]
        });

        // Start the SDK
        sdk.start();
        isInitialized = true;

        console.log('✅ OpenTelemetry initialized successfully');

        // Graceful shutdown
        process.on('SIGTERM', () => {
            sdk.shutdown()
                .then(() => console.log('📊 OpenTelemetry terminated'))
                .catch((error) => console.error('❌ Error terminating OpenTelemetry', error))
                .finally(() => process.exit(0));
        });

    } catch (error) {
        console.error('❌ Failed to initialize OpenTelemetry:', error);
        // Don't throw - let the application continue without telemetry
    }
};

const getSDK = () => sdk;

const isInitializedTelemetry = () => isInitialized;

module.exports = {
    initializeTelemetry,
    getSDK,
    isInitializedTelemetry
};