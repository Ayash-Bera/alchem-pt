const axios = require('axios');
const logger = require('../utils/logger');

class AlchemystService {
    constructor() {
        this.baseURL = process.env.ALCHEMYST_API_URL || 'https://platform-backend.getalchemystai.com/api/v1';
        this.apiKey = process.env.ALCHEMYST_API_KEY;
        this.defaultTimeout = 1200000; // 30 seconds

        if (!this.apiKey) {
            logger.warn('Alchemyst API key not found. Some features may not work.');
        }
    }

    async generateAnalysis(prompt, options = {}) {
        try {
            // Alchemyst API format (from their docs)
            const requestData = {
                chat_history: [
                    {
                        content: prompt,
                        role: "user"
                    }
                ],
                persona: options.persona || "maya"
            };

            // Add optional fields if provided
            if (options.chatId) requestData.chatId = options.chatId;
            if (options.scope) requestData.scope = options.scope;
            if (options.tools) requestData.tools = options.tools;

            logger.info('Calling Alchemyst API for analysis generation');
            logger.info('Request data:', {
                url: `${this.baseURL}/chat/generate/stream`,
                promptLength: prompt.length,
                persona: requestData.persona
            });

            const response = await axios.post(`${this.baseURL}/chat/generate/stream`, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 1200000,
                responseType: 'stream'
            });

            // Handle Server-Sent Events (SSE) stream response
            let finalContent = '';
            let metadata = {};
            let thinkingSteps = [];

            return new Promise((resolve, reject) => {
                let buffer = '';

                response.data.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');

                    // Keep the last incomplete line in buffer
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);

                            if (data === '[DONE]') {
                                logger.info('Stream completed');
                                continue;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                logger.debug('Received:', parsed);

                                if (parsed.type === 'thinking_update') {
                                    thinkingSteps.push(parsed.content);
                                } else if (parsed.type === 'final_response') {
                                    finalContent = parsed.content;
                                } else if (parsed.type === 'metadata') {
                                    metadata = parsed.content;
                                }
                            } catch (e) {
                                // Handle parsing errors
                                logger.debug('JSON parse error:', e.message);
                            }
                        }
                    }
                });

                response.data.on('end', () => {
                    if (!finalContent) {
                        reject(new Error('No final response received from Alchemyst API'));
                        return;
                    }

                    const result = {
                        content: finalContent,
                        tokens: metadata.tokens || this.estimateTokens(finalContent),
                        cost: this.calculateCost({ total_tokens: metadata.tokens || this.estimateTokens(finalContent) }),
                        metadata: metadata,
                        thinkingSteps: thinkingSteps
                    };

                    logger.info('Alchemyst API call successful', {
                        tokens: result.tokens,
                        cost: result.cost,
                        contentLength: finalContent.length,
                        thinkingStepsCount: thinkingSteps.length
                    });

                    resolve(result);
                });

                response.data.on('error', (error) => {
                    logger.error('Stream error:', error);
                    reject(error);
                });

                // Add timeout for the stream
                setTimeout(() => {
                    reject(new Error('Stream timeout - no response received within timeout period'));
                }, 120000);
            });

        } catch (error) {
            logger.error('Alchemyst API call failed:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url
            });

            if (error.response?.status === 401) {
                throw new Error('Invalid Alchemyst API key');
            }
            if (error.response?.status === 429) {
                throw new Error('Alchemyst API rate limit exceeded');
            }
            if (error.response?.status === 500) {
                throw new Error('Alchemyst API service unavailable');
            }
            if (error.response?.status === 400) {
                throw new Error(`Alchemyst API bad request: ${JSON.stringify(error.response?.data)}`);
            }

            throw new Error(`Alchemyst API error: ${error.message}`);
        }
    }
    // Helper method to estimate tokens when not provided
    estimateTokens(text) {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    async generateSummary(text, options = {}) {
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

        return await this.generateAnalysis(prompt, {
            maxTokens: Math.min(options.maxLength * 2, 1500),
            temperature: options.temperature || 0.3
        });
    }

    async performResearch(topic, options = {}) {
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

        return await this.generateAnalysis(prompt, {
            maxTokens: options.maxTokens || 3000,
            temperature: 0.2
        });
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

    calculateCost(usage) {
        if (!usage) return 0;

        // Pricing estimates (adjust based on actual Alchemyst pricing)
        const INPUT_COST_PER_TOKEN = 0.00003; // $0.03 per 1K tokens
        const OUTPUT_COST_PER_TOKEN = 0.00006; // $0.06 per 1K tokens

        const inputCost = (usage.prompt_tokens || 0) * INPUT_COST_PER_TOKEN;
        const outputCost = (usage.completion_tokens || 0) * OUTPUT_COST_PER_TOKEN;

        return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimal places
    }

    async checkAPIHealth() {
        try {
            const response = await axios.get(`${this.baseURL}/v1/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: 5000
            });

            return {
                healthy: true,
                modelsAvailable: response.data.data?.length || 0,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error('Alchemyst API health check failed:', error.message);
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
                timeout: 120000,
                responseType: 'stream'
            });

            logger.info('API Response received:', {
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers['content-type']
            });

            return { success: true, response: 'Streaming response received - connection working!' };
        } catch (error) {
            logger.error('Alchemyst API test failed:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            return { success: false, error: error.message, details: error.response?.data };
        }
    }
}

module.exports = new AlchemystService();