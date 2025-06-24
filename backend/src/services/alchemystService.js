const axios = require('axios');
const logger = require('../utils/logger');
const { trackApiCall, createSpan, trackError } = require('../telemetry/metrics');

class AlchemystService {
    constructor() {
        this.baseURL = process.env.ALCHEMYST_API_URL || 'https://platform-backend.getalchemystai.com/api/v1';
        this.apiKey = process.env.ALCHEMYST_API_KEY;
        this.defaultTimeout = 3000000; // 30 seconds

        if (!this.apiKey) {
            logger.warn('Alchemyst API key not found. Some features may not work.');
        }
    }

    // In backend/src/services/alchemystService.js

    async generateAnalysis(prompt, options = {}, retryCount = 0) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 5000;
        const startTime = Date.now();

        // Create telemetry span for this API call
        const span = createSpan('alchemyst.api.generate_analysis', {
            'api.method': 'POST',
            'api.endpoint': '/chat/generate/stream',
            'api.retry_count': retryCount,
            'prompt.length': prompt.length,
            'options.max_tokens': options.maxTokens || 'default',
            'options.temperature': options.temperature || 'default'
        });

        try {
            const requestData = {
                chat_history: [
                    {
                        content: prompt,
                        role: "user"
                    }
                ],
                persona: options.persona || "maya"
            };

            if (options.chatId) requestData.chatId = options.chatId;
            if (options.scope) requestData.scope = options.scope;
            if (options.tools) requestData.tools = options.tools;

            logger.info(`API call attempt ${retryCount + 1}/${MAX_RETRIES + 1}`);

            const response = await axios.post(`${this.baseURL}/chat/generate/stream`, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 180000,
                responseType: 'stream'
            });

            let finalContent = '';
            let metadata = {};
            let thinkingSteps = [];

            return new Promise((resolve, reject) => {
                let buffer = '';
                let resolved = false;

                response.data.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === 'thinking_update') {
                                    thinkingSteps.push(parsed.content);
                                } else if (parsed.type === 'final_response') {
                                    finalContent = parsed.content;
                                } else if (parsed.type === 'metadata') {
                                    metadata = parsed.content;
                                }
                            } catch (e) {
                                // Ignore JSON parse errors
                            }
                        }
                    }
                });

                response.data.on('end', () => {
                    if (resolved) return;
                    resolved = true;

                    if (!finalContent) {
                        const error = new Error('No final response received from Alchemyst API');
                        trackError('api_empty_response', 'alchemyst', error.message);
                        reject(error);
                        return;
                    }

                    const estimatedTokens = this.estimateTokens(finalContent);
                    const actualTokens = metadata.tokens || estimatedTokens;
                    const apiCallDuration = (Date.now() - startTime) / 1000;

                    const result = {
                        content: finalContent,
                        tokens: actualTokens,
                        cost: this.calculateAlchemystCost(actualTokens),
                        metadata: metadata,
                        thinkingSteps: thinkingSteps,
                        apiCall: 'genai.chat.generate',
                        timestamp: new Date()
                    };

                    // Track API call metrics
                    trackApiCall('alchemyst_generate_analysis', apiCallDuration, result.cost, actualTokens, 'success');

                    // Add telemetry attributes
                    if (span) {
                        span.setAttributes({
                            'api.response.tokens': actualTokens,
                            'api.response.cost_usd': result.cost,
                            'api.response.content_length': finalContent.length,
                            'api.response.thinking_steps': thinkingSteps.length,
                            'api.duration_seconds': apiCallDuration
                        });
                        span.setStatus({ code: 1 }); // OK
                        span.end();
                    }

                    resolve(result);
                });

                response.data.on('error', (error) => {
                    if (resolved) return;
                    resolved = true;

                    const apiCallDuration = (Date.now() - startTime) / 1000;
                    trackApiCall('alchemyst_generate_analysis', apiCallDuration, 0, 0, 'error');
                    trackError('api_stream_error', 'alchemyst', error.message);

                    if (span) {
                        span.setStatus({
                            code: 2, // ERROR
                            message: error.message
                        });
                        span.setAttributes({
                            'api.duration_seconds': apiCallDuration,
                            'error.type': 'stream_error'
                        });
                        span.end();
                    }

                    if ((error.code === 'ECONNRESET' || error.message.includes('aborted')) && retryCount < MAX_RETRIES) {
                        setTimeout(() => {
                            this.generateAnalysis(prompt, options, retryCount + 1)
                                .then(resolve)
                                .catch(reject);
                        }, RETRY_DELAY * (retryCount + 1));
                    } else {
                        reject(error);
                    }
                });

                setTimeout(() => {
                    if (resolved) return;
                    resolved = true;

                    const apiCallDuration = (Date.now() - startTime) / 1000;
                    trackApiCall('alchemyst_generate_analysis', apiCallDuration, 0, 0, 'timeout');
                    trackError('api_timeout', 'alchemyst', 'Request timeout');

                    if (span) {
                        span.setStatus({
                            code: 2, // ERROR
                            message: 'Request timeout'
                        });
                        span.setAttributes({
                            'api.duration_seconds': apiCallDuration,
                            'error.type': 'timeout'
                        });
                        span.end();
                    }

                    if (retryCount < MAX_RETRIES) {
                        setTimeout(() => {
                            this.generateAnalysis(prompt, options, retryCount + 1)
                                .then(resolve)
                                .catch(reject);
                        }, RETRY_DELAY);
                    } else {
                        reject(new Error('Request timeout after all retries'));
                    }
                }, 180000);
            });

        } catch (error) {
            const apiCallDuration = (Date.now() - startTime) / 1000;
            trackApiCall('alchemyst_generate_analysis', apiCallDuration, 0, 0, 'error');
            trackError('api_request_error', 'alchemyst', error.message);

            if (span) {
                span.setStatus({
                    code: 2, // ERROR
                    message: error.message
                });
                span.setAttributes({
                    'api.duration_seconds': apiCallDuration,
                    'error.type': 'request_error',
                    'error.code': error.code || 'unknown'
                });
                span.end();
            }

            if (retryCount < MAX_RETRIES && (error.code === 'ECONNRESET' || error.message.includes('timeout'))) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
                return this.generateAnalysis(prompt, options, retryCount + 1);
            }

            logger.error('Alchemyst API call failed after retries:', error.message);
            throw error;
        }
    }

    calculateAlchemystCost(tokens, apiCall = 'genai.chat.generate') {
        // Alchemyst token costs per call type
        const TOKEN_COSTS = {
            'genai.chat.generate': 1,
            'genai.chat.web_search': 4,
            'genai.email.generate': 3,
            'genai.social.generate': 3,
            'genai.workflow.step.generate': 7,
            'genai.leads.get': 3,
            'genai.leads.augment.by_url': 2,
            'genai.leads.augment.by_web_search': 4,
            'genai.email.send': 1,
            'campaigns.create': 1
        };

        const baseTokenCost = TOKEN_COSTS[apiCall] || 1;
        // Assume $0.001 per Alchemyst token (adjust based on actual pricing)
        return baseTokenCost * 0.001;
    }


    calculateCost(usage) {
        // Keep for backward compatibility
        return this.calculateAlchemystCost(usage.total_tokens || 0);
    }

    // Helper method to estimate tokens when not provided
    estimateTokens(text) {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    async generateSummary(text, options = {}) {
        const span = createSpan('alchemyst.generate_summary', {
            'summary.input_length': text.length,
            'summary.max_length': options.maxLength || 500
        });

        try {
            const prompt = `
Please provide a comprehensive summary of the following content:

${text}

Summary requirements:
- Maximum length: ${options.maxLength || 500} words
- Focus on key insights and main points
- Include actionable takeaways if applicable
- Maintain original context and meaning

Please format the summary clearly and concisely.
`;

            const result = await this.generateAnalysis(prompt, {
                maxTokens: Math.min(options.maxLength * 2, 1500),
                temperature: options.temperature || 0.3
            });

            if (span) {
                span.setAttributes({
                    'summary.output_length': result.content.length,
                    'summary.tokens_used': result.tokens,
                    'summary.cost': result.cost
                });
                span.end();
            }

            return result;
        } catch (error) {
            if (span) {
                span.setStatus({
                    code: 2, // ERROR
                    message: error.message
                });
                span.end();
            }
            throw error;
        }
    }

    async performResearch(topic, options = {}) {
        const span = createSpan('alchemyst.perform_research', {
            'research.topic': topic,
            'research.depth': options.depth || 'medium'
        });

        try {
            const prompt = `
Conduct comprehensive research on the following topic: ${topic}

Research parameters:
- Depth: ${options.depth || 'medium'}
- Focus areas: ${(options.focusAreas || []).join(', ') || 'general overview'}
- Target audience: ${options.audience || 'technical professionals'}

Please provide:
1. Executive summary
2. Key findings and insights
3. Supporting evidence and examples
4. Implications and recommendations
5. Areas for further investigation

Ensure the research is thorough, well-structured, and evidence-based.
`;

            const result = await this.generateAnalysis(prompt, {
                maxTokens: options.maxTokens || 3000,
                temperature: 0.2
            });

            if (span) {
                span.setAttributes({
                    'research.output_length': result.content.length,
                    'research.tokens_used': result.tokens,
                    'research.cost': result.cost
                });
                span.end();
            }

            return result;
        } catch (error) {
            if (span) {
                span.setStatus({
                    code: 2, // ERROR
                    message: error.message
                });
                span.end();
            }
            throw error;
        }
    }


    async analyzeDocument(documentContent, analysisType = 'comprehensive') {
        let prompt = '';

        switch (analysisType) {
            case 'summary':
                prompt = `Provide a concise summary of this document:\n\n${documentContent}`;
                break;
            case 'key-points':
                prompt = `Extract the key points and main arguments from this document:\n\n${documentContent}`;
                break;
            case 'sentiment':
                prompt = `Analyze the sentiment and tone of this document:\n\n${documentContent}`;
                break;
            case 'comprehensive':
            default:
                prompt = `
Perform a comprehensive analysis of this document:

${documentContent}

Please provide:
1. Document summary
2. Key themes and topics
3. Main arguments or findings
4. Tone and sentiment analysis
5. Structure and organization assessment
6. Recommendations or next steps (if applicable)

Keep the analysis detailed but concise.
`;
        }

        return await this.generateAnalysis(prompt, {
            maxTokens: 2000,
            temperature: 0.3
        });
    }

    async generateCode(requirements, language = 'javascript') {
        const prompt = `
Generate ${language} code based on these requirements:

${requirements}

Requirements:
- Write clean, well-documented code
- Follow best practices for ${language}
- Include error handling where appropriate
- Add comments explaining complex logic
- Make the code production-ready

Please provide the complete implementation.
`;

        return await this.generateAnalysis(prompt, {
            maxTokens: 3000,
            temperature: 0.1
        });
    }

    async translateText(text, targetLanguage, sourceLanguage = 'auto') {
        const prompt = `
Translate the following text from ${sourceLanguage} to ${targetLanguage}:

${text}

Requirements:
- Maintain original meaning and context
- Use appropriate tone and style
- Preserve any technical terms or proper nouns
- Provide natural, fluent translation
`;

        return await this.generateAnalysis(prompt, {
            maxTokens: Math.max(text.length * 2, 500),
            temperature: 0.2
        });
    }

    async processMultiStepTask(steps, context = {}) {
        const results = [];
        let accumulatedContext = { ...context };

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            logger.info(`Processing multi-step task - Step ${i + 1}/${steps.length}: ${step.name}`);

            try {
                const prompt = this.buildStepPrompt(step, accumulatedContext, i + 1, steps.length);
                const result = await this.generateAnalysis(prompt, step.options || {});

                results.push({
                    stepNumber: i + 1,
                    stepName: step.name,
                    result: result.content,
                    tokens: result.tokens,
                    cost: result.cost
                });

                // Update accumulated context for next step
                accumulatedContext[`step_${i + 1}_result`] = result.content;

            } catch (error) {
                logger.error(`Multi-step task failed at step ${i + 1}:`, error);
                throw new Error(`Multi-step task failed at step ${i + 1}: ${error.message}`);
            }
        }

        return {
            steps: results,
            totalTokens: results.reduce((sum, r) => sum + r.tokens, 0),
            totalCost: results.reduce((sum, r) => sum + r.cost, 0),
            completedAt: new Date()
        };
    }

    buildStepPrompt(step, context, stepNumber, totalSteps) {
        let prompt = `
Multi-step Task Progress: Step ${stepNumber} of ${totalSteps}
Current Step: ${step.name}

`;

        if (step.description) {
            prompt += `Step Description: ${step.description}\n\n`;
        }

        if (Object.keys(context).length > 0) {
            prompt += `Context from previous steps:\n`;
            Object.entries(context).forEach(([key, value]) => {
                if (key.startsWith('step_') && typeof value === 'string') {
                    prompt += `${key}: ${value.substring(0, 500)}...\n`;
                }
            });
            prompt += '\n';
        }

        prompt += `Current Task: ${step.prompt}\n\n`;
        prompt += `Please complete this step thoroughly and provide results that can be used in subsequent steps.`;

        return prompt;
    }

    calculateCost(usage, apiCall = 'genai.chat.generate') {
        // Alchemyst API token costs per call
        const ALCHEMYST_TOKEN_COSTS = {
            'genai.chat.generate': 1,
            'genai.chat.web_search': 4,
            'genai.email.generate': 3,
            'genai.social.generate': 3,
            'genai.workflow.step.generate': 7,
            'genai.leads.get': 3,
            'genai.leads.augment.by_url': 2,
            'genai.leads.augment.by_web_search': 4,
            'genai.email.send': 1,
            'campaigns.create': 1
        };

        const tokensPerCall = ALCHEMYST_TOKEN_COSTS[apiCall] || 1;

        // If you have actual token usage from response, use that
        // Otherwise estimate based on content length
        const actualTokens = usage.total_tokens || this.estimateTokens(usage.content || '');

        return {
            tokens: actualTokens,
            cost: tokensPerCall * 0.001, // Assuming $0.001 per token - adjust based on your pricing
            apiCall: apiCall
        };
    }

    async checkAPIHealth() {
        const span = createSpan('alchemyst.health_check');
        const startTime = Date.now();

        try {
            const response = await axios.get(`${this.baseURL}/v1/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: 5000
            });

            const duration = (Date.now() - startTime) / 1000;
            trackApiCall('alchemyst_health_check', duration, 0, 0, 'success');

            const healthResult = {
                healthy: true,
                modelsAvailable: response.data.data?.length || 0,
                timestamp: new Date()
            };

            if (span) {
                span.setAttributes({
                    'health.models_available': healthResult.modelsAvailable,
                    'health.duration_seconds': duration
                });
                span.setStatus({ code: 1 }); // OK
                span.end();
            }

            return healthResult;
        } catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            trackApiCall('alchemyst_health_check', duration, 0, 0, 'error');
            trackError('health_check_failed', 'alchemyst', error.message);

            logger.error('Alchemyst API health check failed:', error.message);

            if (span) {
                span.setStatus({
                    code: 2, // ERROR
                    message: error.message
                });
                span.setAttributes({
                    'health.duration_seconds': duration,
                    'error.type': 'health_check_failed'
                });
                span.end();
            }

            return {
                healthy: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }


    // Batch processing for multiple requests
    async processBatch(requests, options = {}) {
        const batchSize = options.batchSize || 5;
        const delay = options.delay || 1000; // 1 second delay between batches
        const results = [];

        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(requests.length / batchSize)}`);

            const batchPromises = batch.map(async (request, index) => {
                try {
                    const result = await this.generateAnalysis(request.prompt, request.options);
                    return {
                        index: i + index,
                        success: true,
                        result
                    };
                } catch (error) {
                    return {
                        index: i + index,
                        success: false,
                        error: error.message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Add delay between batches to respect rate limits
            if (i + batchSize < requests.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return {
            results,
            totalProcessed: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };
    }

    async testConnection() {
        const span = createSpan('alchemyst.test_connection');
        const startTime = Date.now();

        try {
            logger.info('Testing Alchemyst API connection...', {
                baseURL: this.baseURL,
                hasApiKey: !!this.apiKey,
                fullUrl: `${this.baseURL}/chat/generate/stream`
            });

            const testData = {
                chat_history: [
                    {
                        content: "Hello, please respond with 'API connection successful'",
                        role: "user"
                    }
                ],
                persona: "maya"
            };

            logger.info('Sending request with correct format:', { testData });

            const response = await axios.post(`${this.baseURL}/chat/generate/stream`, testData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 300000,
                responseType: 'stream'
            });

            const duration = (Date.now() - startTime) / 1000;
            trackApiCall('alchemyst_test_connection', duration, 0, 0, 'success');

            logger.info('API Response received:', {
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers['content-type']
            });

            if (span) {
                span.setAttributes({
                    'test.duration_seconds': duration,
                    'test.response_status': response.status
                });
                span.setStatus({ code: 1 }); // OK
                span.end();
            }

            return { success: true, response: 'Streaming response received - connection working!' };
        } catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            trackApiCall('alchemyst_test_connection', duration, 0, 0, 'error');
            trackError('connection_test_failed', 'alchemyst', error.message);

            logger.error('Alchemyst API test failed:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });

            if (span) {
                span.setStatus({
                    code: 2, // ERROR
                    message: error.message
                });
                span.setAttributes({
                    'test.duration_seconds': duration,
                    'error.type': 'connection_test_failed',
                    'error.status': error.response?.status || 'unknown'
                });
                span.end();
            }

            return { success: false, error: error.message, details: error.response?.data };
        }
    }
}

module.exports = new AlchemystService();