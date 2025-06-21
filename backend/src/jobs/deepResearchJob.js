const alchemystService = require('../services/alchemystService');
const logger = require('../utils/logger');
const { getPool } = require('../config/database');

const deepResearchJob = async (job) => {
    const { topic, researchDepth, sources, deliverables, options, requestId } = job.attrs.data;
    const jobId = job.attrs._id;

    logger.info(`Starting deep research job for topic: ${topic}`, { jobId, researchDepth });

    try {
        // Update job progress
        job.progress(5);
        await job.save();

        // Step 1: Research planning and methodology
        const researchPlan = await createResearchPlan(topic, researchDepth, sources, deliverables);
        job.progress(15);
        await job.save();

        // Step 2: Execute multi-step research process
        const researchResults = await executeResearchPlan(researchPlan, job);
        job.progress(70);
        await job.save();

        // Step 3: Synthesize findings
        const synthesis = await synthesizeFindings(researchResults, deliverables);
        job.progress(85);
        await job.save();

        // Step 4: Generate final deliverables
        const finalReport = await generateResearchDeliverables(topic, researchResults, synthesis, deliverables);
        job.progress(95);
        await job.save();

        // Step 5: Package results and update metrics
        const result = {
            topic,
            researchDepth,
            plan: researchPlan,
            findings: researchResults,
            synthesis,
            deliverables: finalReport,
            metadata: {
                processedAt: new Date(),
                requestId,
                totalSteps: researchPlan.steps.length,
                version: '1.0'
            }
        };

        job.progress(100);
        await job.save();

        // Update cost metrics
        const totalCosts = calculateTotalCosts(researchResults, synthesis, finalReport);
        await updateJobCosts(jobId, totalCosts);

        logger.info(`Deep research completed for topic: ${topic}`, {
            jobId,
            stepsCompleted: researchPlan.steps.length,
            totalCost: totalCosts.total
        });

        return result;

    } catch (error) {
        logger.error(`Deep research failed for topic: ${topic}`, {
            jobId,
            error: error.message
        });

        await updateJobCosts(jobId, null, error.message);
        throw error;
    }
};

const createResearchPlan = async (topic, depth, sources, deliverables) => {
    try {
        const planningPrompt = `
Create a comprehensive research plan for the following topic: ${topic}

Research Parameters:
- Depth: ${depth}
- Preferred sources: ${sources.join(', ') || 'Any credible sources'}
- Required deliverables: ${deliverables.join(', ')}

Please create a structured research plan that includes:
1. Research objectives and key questions
2. Methodology and approach
3. Step-by-step research process (5-8 steps)
4. Expected outcomes for each step
5. Quality criteria and validation methods

Format the plan as a detailed, actionable roadmap for conducting thorough research.
`;

        const planResult = await alchemystService.generateAnalysis(planningPrompt, {
            maxTokens: 2000,
            temperature: 0.3
        });

        // Parse the plan into structured steps
        const steps = parseResearchSteps(planResult.content, depth);

        return {
            topic,
            depth,
            objectives: extractObjectives(planResult.content),
            methodology: extractMethodology(planResult.content),
            steps,
            estimatedDuration: estimateResearchDuration(steps, depth),
            qualityCriteria: extractQualityCriteria(planResult.content),
            createdAt: new Date(),
            planningCost: planResult.cost
        };
    } catch (error) {
        logger.error('Error creating research plan:', error);
        throw new Error(`Research planning failed: ${error.message}`);
    }
};

const parseResearchSteps = (planContent, depth) => {
    // Extract research steps from the generated plan
    const stepPatterns = [
        'Step 1:', 'Step 2:', 'Step 3:', 'Step 4:', 'Step 5:', 'Step 6:', 'Step 7:', 'Step 8:'
    ];

    const steps = [];
    const lines = planContent.split('\n');

    let currentStep = null;

    lines.forEach(line => {
        const stepMatch = stepPatterns.find(pattern => line.includes(pattern));
        if (stepMatch) {
            if (currentStep) {
                steps.push(currentStep);
            }
            currentStep = {
                number: steps.length + 1,
                name: line.replace(stepMatch, '').trim(),
                description: '',
                expectedOutput: '',
                estimatedTokens: getStepTokenEstimate(depth)
            };
        } else if (currentStep && line.trim()) {
            currentStep.description += line.trim() + ' ';
        }
    });

    if (currentStep) {
        steps.push(currentStep);
    }

    // Ensure minimum number of steps based on depth
    const minSteps = depth === 'shallow' ? 3 : depth === 'medium' ? 5 : 7;
    while (steps.length < minSteps) {
        steps.push(generateDefaultStep(steps.length + 1, depth));
    }

    return steps.slice(0, 8); // Maximum 8 steps
};

const getStepTokenEstimate = (depth) => {
    switch (depth) {
        case 'shallow': return 800;
        case 'medium': return 1500;
        case 'deep': return 2500;
        default: return 1500;
    }
};

const generateDefaultStep = (stepNumber, depth) => {
    const defaultSteps = {
        1: { name: 'Initial Research and Context Setting', description: 'Gather basic information and establish context' },
        2: { name: 'Literature Review and Source Analysis', description: 'Review existing research and credible sources' },
        3: { name: 'Key Findings Identification', description: 'Identify and analyze key findings and data points' },
        4: { name: 'Comparative Analysis', description: 'Compare different perspectives and approaches' },
        5: { name: 'Synthesis and Pattern Recognition', description: 'Synthesize information and identify patterns' },
        6: { name: 'Critical Evaluation', description: 'Critically evaluate findings and assess validity' },
        7: { name: 'Implications and Applications', description: 'Analyze implications and practical applications' },
        8: { name: 'Future Directions and Recommendations', description: 'Identify future research directions and recommendations' }
    };

    return {
        number: stepNumber,
        name: defaultSteps[stepNumber]?.name || `Research Step ${stepNumber}`,
        description: defaultSteps[stepNumber]?.description || 'Conduct additional research analysis',
        expectedOutput: 'Detailed analysis and findings',
        estimatedTokens: getStepTokenEstimate(depth)
    };
};

const executeResearchPlan = async (plan, job) => {
    const results = [];
    const totalSteps = plan.steps.length;

    for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        logger.info(`Executing research step ${i + 1}/${totalSteps}: ${step.name}`, { jobId: job.attrs._id });

        try {
            // Build context from previous steps
            const stepContext = buildStepContext(results, plan.topic);

            // Create step-specific prompt
            const stepPrompt = createStepPrompt(step, plan.topic, stepContext, i + 1, totalSteps);

            // Execute the research step
            const stepResult = await alchemystService.generateAnalysis(stepPrompt, {
                maxTokens: step.estimatedTokens,
                temperature: 0.3
            });

            results.push({
                stepNumber: i + 1,
                stepName: step.name,
                description: step.description,
                content: stepResult.content,
                tokens: stepResult.tokens,
                cost: stepResult.cost,
                completedAt: new Date()
            });

            // Update job progress (15% to 70% range for research execution)
            const progressIncrement = 55 / totalSteps;
            const newProgress = 15 + ((i + 1) * progressIncrement);
            job.progress(Math.min(newProgress, 70));
            await job.save();

        } catch (error) {
            logger.error(`Research step ${i + 1} failed:`, error);
            throw new Error(`Research step ${i + 1} failed: ${error.message}`);
        }
    }

    return results;
};

const buildStepContext = (previousResults, topic) => {
    if (previousResults.length === 0) {
        return { topic, previousFindings: [] };
    }

    const context = {
        topic,
        previousFindings: previousResults.map(result => ({
            step: result.stepName,
            keyPoints: extractKeyPoints(result.content)
        })),
        cumulativeInsights: synthesizeCumulativeInsights(previousResults)
    };

    return context;
};

const extractKeyPoints = (content) => {
    // Simple extraction of key points from content
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 50);
    return sentences.slice(0, 3).map(s => s.trim());
};

const synthesizeCumulativeInsights = (results) => {
    // Combine insights from all previous steps
    const allContent = results.map(r => r.content).join(' ');
    const words = allContent.toLowerCase().split(/\s+/);

    // Find most frequently mentioned concepts (simple approach)
    const wordFreq = {};
    words.forEach(word => {
        if (word.length > 4 && !isCommonWord(word)) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    });

    const topConcepts = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word]) => word);

    return topConcepts;
};

const isCommonWord = (word) => {
    const commonWords = ['that', 'this', 'with', 'have', 'will', 'been', 'from', 'they', 'were', 'said', 'each', 'which', 'their', 'time', 'more'];
    return commonWords.includes(word);
};

const createStepPrompt = (step, topic, context, stepNumber, totalSteps) => {
    let prompt = `
Research Topic: ${topic}
Research Step ${stepNumber} of ${totalSteps}: ${step.name}

Step Description: ${step.description}

`;

    if (context.previousFindings && context.previousFindings.length > 0) {
        prompt += `Previous Research Findings:\n`;
        context.previousFindings.forEach((finding, index) => {
            prompt += `Step ${index + 1} (${finding.step}):\n`;
            finding.keyPoints.forEach(point => {
                prompt += `- ${point}\n`;
            });
        });
        prompt += '\n';
    }

    if (context.cumulativeInsights && context.cumulativeInsights.length > 0) {
        prompt += `Key Concepts from Previous Steps: ${context.cumulativeInsights.join(', ')}\n\n`;
    }

    prompt += `
Current Task: Please conduct thorough research for this step, focusing on:
${step.description}

Provide:
1. Detailed analysis and findings specific to this research step
2. Evidence-based insights and data
3. Multiple perspectives where relevant
4. Clear connections to the overall research topic
5. Specific examples and case studies where applicable

Ensure your response is comprehensive, well-structured, and builds upon previous research findings.
`;

    return prompt;
};

const synthesizeFindings = async (researchResults, deliverables) => {
    try {
        const synthesisPrompt = `
Based on the following comprehensive research results, please synthesize the key findings into a coherent analysis:

Research Results:
${researchResults.map((result, index) => `
Step ${index + 1}: ${result.stepName}
${result.content}

`).join('\n---\n')}

Please provide a synthesis that includes:
1. Overall key findings and insights
2. Major themes and patterns identified
3. Conflicting viewpoints or contradictions
4. Gaps in the research or areas needing further investigation
5. Confidence levels in the findings
6. Practical implications and applications

Required deliverables focus: ${deliverables.join(', ')}

Create a well-structured synthesis that brings together all research findings into a coherent analysis.
`;

        const synthesisResult = await alchemystService.generateAnalysis(synthesisPrompt, {
            maxTokens: 3000,
            temperature: 0.2
        });

        return {
            content: synthesisResult.content,
            keyThemes: extractKeyThemes(synthesisResult.content),
            confidence: assessConfidenceLevel(researchResults),
            gaps: identifyResearchGaps(synthesisResult.content),
            implications: extractImplications(synthesisResult.content),
            cost: synthesisResult.cost,
            tokens: synthesisResult.tokens,
            synthesizedAt: new Date()
        };
    } catch (error) {
        logger.error('Error synthesizing findings:', error);
        throw new Error(`Synthesis failed: ${error.message}`);
    }
};

const generateResearchDeliverables = async (topic, researchResults, synthesis, requestedDeliverables) => {
    const deliverables = {};

    for (const deliverable of requestedDeliverables) {
        try {
            switch (deliverable.toLowerCase()) {
                case 'summary':
                    deliverables.summary = await generateExecutiveSummary(topic, synthesis);
                    break;
                case 'report':
                    deliverables.report = await generateFullReport(topic, researchResults, synthesis);
                    break;
                case 'citations':
                    deliverables.citations = generateCitations(researchResults);
                    break;
                case 'recommendations':
                    deliverables.recommendations = await generateRecommendations(topic, synthesis);
                    break;
                case 'timeline':
                    deliverables.timeline = generateResearchTimeline(researchResults);
                    break;
                case 'bibliography':
                    deliverables.bibliography = generateBibliography(researchResults);
                    break;
                default:
                    logger.warn(`Unknown deliverable type: ${deliverable}`);
            }
        } catch (error) {
            logger.error(`Error generating deliverable ${deliverable}:`, error);
            deliverables[deliverable] = { error: error.message };
        }
    }

    return deliverables;
};

const generateExecutiveSummary = async (topic, synthesis) => {
    const summaryPrompt = `
Create an executive summary for research on: ${topic}

Based on these synthesized findings:
${synthesis.content}

Executive Summary Requirements:
- Maximum 500 words
- Focus on key insights and business implications
- Include actionable recommendations
- Written for executive/decision-maker audience
- Clear, concise, and impactful

Provide a compelling executive summary that captures the essence of the research.
`;

    const result = await alchemystService.generateAnalysis(summaryPrompt, {
        maxTokens: 800,
        temperature: 0.3
    });

    return {
        content: result.content,
        wordCount: result.content.split(/\s+/).length,
        cost: result.cost,
        generatedAt: new Date()
    };
};

const generateFullReport = async (topic, researchResults, synthesis) => {
    const reportPrompt = `
Generate a comprehensive research report on: ${topic}

Research Process Summary:
${researchResults.map((result, index) => `
${index + 1}. ${result.stepName}
Key findings: ${result.content.substring(0, 300)}...
`).join('\n')}

Synthesis:
${synthesis.content}

Please create a full research report with:
1. Executive Summary
2. Methodology
3. Detailed Findings (organized by research steps)
4. Analysis and Discussion
5. Conclusions
6. Recommendations
7. Future Research Directions

Format as a professional research document with clear sections and comprehensive coverage.
`;

    const result = await alchemystService.generateAnalysis(reportPrompt, {
        maxTokens: 4000,
        temperature: 0.3
    });

    return {
        content: result.content,
        sections: extractReportSections(result.content),
        wordCount: result.content.split(/\s+/).length,
        cost: result.cost,
        generatedAt: new Date()
    };
};

const generateRecommendations = async (topic, synthesis) => {
    const recommendationsPrompt = `
Based on the research synthesis for ${topic}, provide specific, actionable recommendations:

Synthesis:
${synthesis.content}

Please provide:
1. Strategic recommendations (high-level)
2. Tactical recommendations (specific actions)
3. Implementation priorities (short, medium, long-term)
4. Risk considerations
5. Success metrics and KPIs

Format as clear, actionable recommendations with rationale.
`;

    const result = await alchemystService.generateAnalysis(recommendationsPrompt, {
        maxTokens: 2000,
        temperature: 0.3
    });

    return {
        content: result.content,
        strategic: extractStrategicRecommendations(result.content),
        tactical: extractTacticalRecommendations(result.content),
        cost: result.cost,
        generatedAt: new Date()
    };
};

// Helper functions for extracting information
const extractObjectives = (planContent) => {
    const objectiveKeywords = ['objective', 'goal', 'aim', 'purpose'];
    const lines = planContent.split('\n');
    return lines.filter(line =>
        objectiveKeywords.some(keyword => line.toLowerCase().includes(keyword))
    ).slice(0, 5);
};

const extractMethodology = (planContent) => {
    const methodologySection = planContent.toLowerCase();
    if (methodologySection.includes('methodology')) {
        const start = methodologySection.indexOf('methodology');
        const end = methodologySection.indexOf('\n\n', start);
        return planContent.substring(start, end > 0 ? end : start + 500);
    }
    return 'Comprehensive research approach using multiple sources and analytical methods';
};

const extractQualityCriteria = (planContent) => {
    const qualityKeywords = ['quality', 'criteria', 'validation', 'verification'];
    const lines = planContent.split('\n');
    return lines.filter(line =>
        qualityKeywords.some(keyword => line.toLowerCase().includes(keyword))
    ).slice(0, 3);
};

const estimateResearchDuration = (steps, depth) => {
    const baseTime = depth === 'shallow' ? 30 : depth === 'medium' ? 45 : 60;
    return steps.length * baseTime; // minutes
};

const extractKeyThemes = (synthesisContent) => {
    // Simple theme extraction
    const themes = [];
    const lines = synthesisContent.split('\n');

    lines.forEach(line => {
        if (line.includes('theme') || line.includes('pattern') || line.includes('trend')) {
            themes.push(line.trim());
        }
    });

    return themes.slice(0, 5);
};

const assessConfidenceLevel = (researchResults) => {
    // Simple confidence assessment based on research depth
    const totalSteps = researchResults.length;
    const avgContentLength = researchResults.reduce((sum, r) => sum + r.content.length, 0) / totalSteps;

    if (totalSteps >= 6 && avgContentLength > 1000) return 'High';
    if (totalSteps >= 4 && avgContentLength > 500) return 'Medium';
    return 'Low';
};

const identifyResearchGaps = (synthesisContent) => {
    const gapKeywords = ['gap', 'limitation', 'further research', 'unknown', 'unclear'];
    const lines = synthesisContent.split('\n');
    return lines.filter(line =>
        gapKeywords.some(keyword => line.toLowerCase().includes(keyword))
    ).slice(0, 3);
};

const extractImplications = (synthesisContent) => {
    const implicationKeywords = ['implication', 'impact', 'consequence', 'result'];
    const lines = synthesisContent.split('\n');
    return lines.filter(line =>
        implicationKeywords.some(keyword => line.toLowerCase().includes(keyword))
    ).slice(0, 5);
};

const generateCitations = (researchResults) => {
    return researchResults.map((result, index) => ({
        id: index + 1,
        step: result.stepName,
        type: 'Research Analysis',
        date: result.completedAt,
        summary: result.content.substring(0, 200) + '...'
    }));
};

const generateResearchTimeline = (researchResults) => {
    return researchResults.map(result => ({
        step: result.stepName,
        completedAt: result.completedAt,
        duration: 'Variable', // Could calculate based on timestamps
        output: `${result.content.length} characters of analysis`
    }));
};

const generateBibliography = (researchResults) => {
    return [
        {
            type: 'Primary Research',
            description: 'Multi-step analytical research conducted using AI-assisted methodology',
            steps: researchResults.length,
            totalTokens: researchResults.reduce((sum, r) => sum + r.tokens, 0)
        }
    ];
};

const extractReportSections = (reportContent) => {
    const sectionHeaders = ['Executive Summary', 'Methodology', 'Findings', 'Analysis', 'Conclusions', 'Recommendations'];
    const sections = {};

    sectionHeaders.forEach(header => {
        const index = reportContent.indexOf(header);
        if (index !== -1) {
            sections[header.toLowerCase().replace(' ', '_')] = {
                found: true,
                position: index
            };
        }
    });

    return sections;
};

const extractStrategicRecommendations = (content) => {
    const lines = content.split('\n');
    return lines.filter(line =>
        line.toLowerCase().includes('strategic') ||
        line.toLowerCase().includes('high-level')
    ).slice(0, 3);
};

const extractTacticalRecommendations = (content) => {
    const lines = content.split('\n');
    return lines.filter(line =>
        line.toLowerCase().includes('tactical') ||
        line.toLowerCase().includes('specific') ||
        line.toLowerCase().includes('action')
    ).slice(0, 5);
};

const calculateTotalCosts = (researchResults, synthesis, deliverables) => {
    const researchCost = researchResults.reduce((sum, r) => sum + (r.cost || 0), 0);
    const synthesisCost = synthesis.cost || 0;

    let deliverablesCost = 0;
    Object.values(deliverables).forEach(deliverable => {
        if (deliverable && deliverable.cost) {
            deliverablesCost += deliverable.cost;
        }
    });

    return {
        research: researchCost,
        synthesis: synthesisCost,
        deliverables: deliverablesCost,
        total: researchCost + synthesisCost + deliverablesCost
    };
};

const updateJobCosts = async (jobId, costs, errorMessage = null) => {
    try {
        const pool = getPool();

        if (costs) {
            const totalTokens = costs.research + costs.synthesis + costs.deliverables;
            await pool.query(
                `UPDATE job_metrics 
                 SET cost_usd = $1, tokens_used = $2, api_calls = api_calls + 5 
                 WHERE job_id = $3`,
                [costs.total, totalTokens, jobId]
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

module.exports = deepResearchJob;