const axios = require('axios');
const logger = require('../utils/logger');

class AlchemystService {
    constructor() {
        this.baseURL = process.env.ALCHEMYST_API_URL || 'https://api.alchemyst.ai';
        this.apiKey = process.env.ALCHEMYST_API_KEY;
        this.defaultTimeout = 30000; // 30 seconds

        if (!this.apiKey) {
            logger.warn('Alchemyst API key not found. Some features may not work.');
        }
    }

    async generateAnalysis(prompt, options = {}) {
        try {
            const requestData = {
                prompt,
                max_tokens: options.maxTokens || 2000,
                temperature: options.temperature || 0.3,
                model: options.model || 'gpt-4',
                stream: false
            };

            logger.info('Calling Alchemyst API for analysis generation');

            const response = await axios.post(`${this.baseURL}/v1/chat/completions`, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.defaultTimeout
            });

            const result = {
                content: response.data.choices[0].message.content,
                tokens: response.data.usage?.total_tokens || 0,
                cost: this.calculateCost(response.data.usage),
                model: response.data.model
            };

            logger.info('Alchemyst API call successful', {
                tokens: result.tokens,
                cost: result.cost
            });

            return result;
        } catch (error) {
            logger.error('Alchemyst API call failed:', error.response?.data || error.message);

            if (error.response?.status === 401) {
                throw new Error('Invalid Alchemyst API key');
            }
            if (error.response?.status === 429) {
                throw new Error('Alchemyst API rate limit exceeded');
            }
            if (error.response?.status === 500) {
                throw new Error('Alchemyst API service unavailable');
            }

            throw new Error(`Alchemyst API error: ${error.message}`);
        }
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
}

module.exports = new AlchemystService();