const alchemystService = require('../services/alchemystService');
const axios = require('axios');
const logger = require('../utils/logger');
const { getPool } = require('../config/database');

const documentSummaryJob = async (job) => {
    const { document, summaryType, maxLength, options, requestId } = job.attrs.data;
    const jobId = job.attrs._id;

    logger.info(`Starting document summary job`, { jobId, summaryType });

    try {
        // Update job progress
        job.progress(10);
        await job.save();

        // Step 1: Extract/fetch document content
        const documentContent = await extractDocumentContent(document);
        job.progress(25);
        await job.save();

        // Step 2: Preprocess document
        const processedContent = await preprocessDocument(documentContent, options);
        job.progress(40);
        await job.save();

        // Step 3: Generate summary using Alchemyst
        const summary = await generateDocumentSummary(processedContent, summaryType, maxLength);
        job.progress(70);
        await job.save();

        // Step 4: Post-process and format results
        const formattedResult = await formatSummaryResult(summary, documentContent, summaryType);
        job.progress(90);
        await job.save();

        // Step 5: Store results and update metrics
        const result = {
            document: {
                type: detectDocumentType(document),
                length: documentContent.length,
                source: typeof document === 'string' && document.startsWith('http') ? 'url' : 'text'
            },
            summary: formattedResult,
            metadata: {
                summaryType,
                maxLength,
                processedAt: new Date(),
                requestId,
                version: '1.0'
            }
        };

        job.progress(100);
        await job.save();

        // Update cost metrics
        await updateJobCosts(jobId, summary.costs);

        logger.info(`Document summary completed`, { jobId, summaryLength: formattedResult.content.length });
        return result;

    } catch (error) {
        logger.error(`Document summary failed`, {
            jobId,
            error: error.message
        });

        await updateJobCosts(jobId, null, error.message);
        throw error;
    }
};

const extractDocumentContent = async (document) => {
    try {
        // Handle different document input types
        if (typeof document === 'string') {
            // Check if it's a URL
            if (document.startsWith('http://') || document.startsWith('https://')) {
                return await fetchDocumentFromURL(document);
            }
            // Otherwise treat as direct text content
            return document;
        }

        // Handle file uploads or base64 content
        if (document.content) {
            return document.content;
        }

        if (document.url) {
            return await fetchDocumentFromURL(document.url);
        }

        throw new Error('Invalid document format');
    } catch (error) {
        logger.error('Error extracting document content:', error);
        throw new Error(`Failed to extract document content: ${error.message}`);
    }
};

const fetchDocumentFromURL = async (url) => {
    try {
        logger.info(`Fetching document from URL: ${url}`);

        // Validate URL
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error('Only HTTP and HTTPS URLs are supported');
        }

        const response = await axios.get(url, {
            timeout: 30000,
            maxContentLength: 10 * 1024 * 1024, // 10MB limit
            headers: {
                'User-Agent': 'Alchemyst-Document-Processor/1.0'
            }
        });

        const contentType = response.headers['content-type'] || '';

        // Handle different content types
        if (contentType.includes('text/')) {
            return response.data;
        } else if (contentType.includes('application/json')) {
            return JSON.stringify(response.data, null, 2);
        } else if (contentType.includes('application/pdf')) {
            throw new Error('PDF processing not yet implemented');
        } else {
            // Try to process as text
            return String(response.data);
        }
    } catch (error) {
        if (error.code === 'ENOTFOUND') {
            throw new Error('URL not found or inaccessible');
        }
        if (error.code === 'ETIMEDOUT') {
            throw new Error('Request timeout while fetching document');
        }
        throw new Error(`Failed to fetch document: ${error.message}`);
    }
};

const preprocessDocument = async (content, options = {}) => {
    try {
        let processedContent = content;

        // Remove excessive whitespace
        processedContent = processedContent.replace(/\s+/g, ' ').trim();

        // Handle very long documents
        const maxLength = options.maxInputLength || 50000; // 50k chars max
        if (processedContent.length > maxLength) {
            logger.info(`Document too long (${processedContent.length} chars), truncating to ${maxLength}`);

            // Try to truncate at sentence boundaries
            const truncated = processedContent.substring(0, maxLength);
            const lastSentence = truncated.lastIndexOf('.');
            if (lastSentence > maxLength * 0.8) {
                processedContent = truncated.substring(0, lastSentence + 1);
            } else {
                processedContent = truncated;
            }
        }

        // Remove or clean problematic characters
        processedContent = processedContent.replace(/[^\x20-\x7E\n\r\t]/g, '');

        // Add content structure markers if needed
        if (options.preserveStructure) {
            // Basic structure preservation (headings, paragraphs)
            processedContent = processedContent.replace(/\n\n+/g, '\n\n[PARAGRAPH_BREAK]\n\n');
        }

        return processedContent;
    } catch (error) {
        logger.error('Error preprocessing document:', error);
        throw new Error(`Document preprocessing failed: ${error.message}`);
    }
};

const generateDocumentSummary = async (content, summaryType, maxLength) => {
    try {
        let prompt = '';
        let expectedTokens = 500;

        switch (summaryType) {
            case 'executive':
                prompt = createExecutiveSummaryPrompt(content, maxLength);
                expectedTokens = Math.min(maxLength * 1.5, 800);
                break;
            case 'bullet-points':
                prompt = createBulletPointSummaryPrompt(content, maxLength);
                expectedTokens = Math.min(maxLength * 1.2, 600);
                break;
            case 'technical':
                prompt = createTechnicalSummaryPrompt(content, maxLength);
                expectedTokens = Math.min(maxLength * 1.8, 1000);
                break;
            case 'abstract':
                prompt = createAbstractSummaryPrompt(content, maxLength);
                expectedTokens = Math.min(maxLength * 1.3, 400);
                break;
            default: // 'comprehensive'
                prompt = createComprehensiveSummaryPrompt(content, maxLength);
                expectedTokens = Math.min(maxLength * 2, 1200);
        }

        const result = await alchemystService.generateAnalysis(prompt, {
            maxTokens: expectedTokens,
            temperature: 0.3
        });

        return {
            content: result.content,
            type: summaryType,
            costs: {
                tokens: result.tokens,
                cost: result.cost
            }
        };
    } catch (error) {
        logger.error('Error generating summary:', error);
        throw new Error(`Summary generation failed: ${error.message}`);
    }
};

const createComprehensiveSummaryPrompt = (content, maxLength) => {
    return `
Please provide a comprehensive summary of the following document:

${content}

Summary Requirements:
- Maximum length: ${maxLength} words
- Include key points, main arguments, and conclusions
- Maintain logical flow and structure
- Preserve important details and context
- Make it accessible to a general audience

Structure the summary with:
1. Main topic/purpose
2. Key findings or arguments
3. Supporting details
4. Conclusions or implications

Keep the summary informative yet concise.
`;
};

const createExecutiveSummaryPrompt = (content, maxLength) => {
    return `
Create an executive summary of the following document:

${content}

Executive Summary Requirements:
- Maximum length: ${maxLength} words
- Focus on business impact and key decisions
- Highlight actionable insights
- Include financial/strategic implications if relevant
- Written for senior management audience
- Clear recommendations or next steps

Format for executive consumption with clear, actionable insights.
`;
};

const createBulletPointSummaryPrompt = (content, maxLength) => {
    return `
Summarize the following document in bullet point format:

${content}

Bullet Point Summary Requirements:
- Maximum total length: ${maxLength} words
- Use clear, concise bullet points
- Organize by themes or sections
- Each bullet should be self-contained
- Prioritize most important information
- Use sub-bullets for supporting details when needed

Create a well-organized, scannable summary.
`;
};

const createTechnicalSummaryPrompt = (content, maxLength) => {
    return `
Provide a technical summary of the following document:

${content}

Technical Summary Requirements:
- Maximum length: ${maxLength} words
- Focus on technical details, methodologies, and specifications
- Include technical terminology and precise language
- Highlight technical innovations or approaches
- Preserve numerical data and measurements
- Target audience: technical professionals

Maintain technical accuracy and depth.
`;
};

const createAbstractSummaryPrompt = (content, maxLength) => {
    return `
Create an abstract for the following document:

${content}

Abstract Requirements:
- Maximum length: ${maxLength} words
- Concise overview of the entire document
- Include purpose, methods, results, and conclusions
- Self-contained and informative
- Academic/research paper style
- No citations or references

Write a clear, standalone abstract.
`;
};

const formatSummaryResult = async (summary, originalContent, summaryType) => {
    const wordCount = summary.content.split(/\s+/).length;
    const compressionRatio = originalContent.length / summary.content.length;

    return {
        content: summary.content,
        type: summaryType,
        statistics: {
            wordCount,
            characterCount: summary.content.length,
            compressionRatio: Math.round(compressionRatio * 100) / 100,
            originalLength: originalContent.length
        },
        quality: {
            readabilityScore: calculateReadabilityScore(summary.content),
            coherenceScore: calculateCoherenceScore(summary.content),
            completenessScore: calculateCompletenessScore(summary.content, originalContent)
        },
        generatedAt: new Date()
    };
};

const detectDocumentType = (document) => {
    if (typeof document === 'string') {
        if (document.startsWith('http')) return 'url';
        if (document.includes('```') || document.includes('function') || document.includes('class ')) return 'code';
        if (document.includes('# ') || document.includes('## ')) return 'markdown';
        return 'text';
    }

    if (document.type) return document.type;
    return 'unknown';
};

// Simple quality scoring functions
const calculateReadabilityScore = (text) => {
    // Simple readability based on sentence length and word complexity
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/);
    const avgSentenceLength = words.length / sentences.length;

    // Score based on average sentence length (15-20 words is optimal)
    let score = 100;
    if (avgSentenceLength > 25) score -= 20;
    if (avgSentenceLength < 10) score -= 10;

    return Math.max(score, 0);
};

const calculateCoherenceScore = (text) => {
    // Simple coherence check based on transition words and structure
    const transitionWords = ['however', 'therefore', 'furthermore', 'additionally', 'consequently', 'meanwhile'];
    const transitionCount = transitionWords.reduce((count, word) => {
        return count + (text.toLowerCase().split(word).length - 1);
    }, 0);

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const coherenceRatio = transitionCount / sentences.length;

    return Math.min(coherenceRatio * 100, 100);
};

const calculateCompletenessScore = (summary, original) => {
    // Simple completeness check based on key terms coverage
    const originalWords = original.toLowerCase().split(/\s+/);
    const summaryWords = summary.toLowerCase().split(/\s+/);

    // Find important words (longer than 4 characters, not common words)
    const commonWords = ['that', 'this', 'with', 'have', 'will', 'been', 'from', 'they', 'were', 'said'];
    const importantOriginalWords = originalWords
        .filter(word => word.length > 4 && !commonWords.includes(word))
        .slice(0, 50); // Top 50 important words

    const coveredWords = importantOriginalWords.filter(word =>
        summaryWords.includes(word)
    );

    return (coveredWords.length / importantOriginalWords.length) * 100;
};

const updateJobCosts = async (jobId, costs, errorMessage = null) => {
    try {
        const pool = getPool();

        if (costs) {
            await pool.query(
                `UPDATE job_metrics 
                 SET cost_usd = $1, tokens_used = $2, api_calls = api_calls + 1 
                 WHERE job_id = $3`,
                [costs.cost, costs.tokens, jobId]
            );
        }

        if (errorMessage) {
            await pool.query(
                `UPDATE job_metrics 
                 SET error_message = $1 
                 WHERE job_id = $2`,
                [errorMessage, jobId]
            );
        }
    } catch (error) {
        logger.error('Error updating job costs:', error);
    }
};

module.exports = documentSummaryJob;