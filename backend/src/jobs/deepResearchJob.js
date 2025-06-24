const alchemystService = require('../services/alchemystService');
const logger = require('../utils/logger');
const { getDatabase } = require('../config/database');

const deepResearchJob = async (job) => {
    const { topic, researchDepth, sources, deliverables, options, requestId } = job.attrs.data;
    const jobId = job.attrs._id;

    logger.info(`Starting deep research job for topic: ${topic}`, { jobId, researchDepth });

    try {
        job.attrs.progress = 5;


        // Step 1: Create intelligent research plan
        logger.info('Creating research plan...', { jobId });
        const researchPlan = await createResearchPlan(topic, researchDepth, sources || [], deliverables || ['summary']);
        logger.info('Research plan created successfully', { jobId, stepCount: researchPlan.steps?.length });

        job.attrs.progress = 25;


        // Step 2: Execute with our new intelligent system
        logger.info('Executing research plan...', { jobId });
        const researchResults = await executeResearchPlan(researchPlan, job);
        logger.info('Research execution completed', { jobId, resultCount: researchResults.length });

        job.attrs.progress = 70;


        // Continue with synthesis...
        logger.info('Synthesizing findings...', { jobId });
        const synthesis = await synthesizeFindings(researchResults, deliverables || ['summary']);

        job.attrs.progress = 85;


        logger.info('Generating final deliverables...', { jobId });
        const finalReport = await generateResearchDeliverables(topic, researchResults, synthesis, deliverables || ['summary']);

        job.attrs.progress = 95;


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
                totalSteps: researchPlan.steps?.length || 0,
                version: '1.0'
            }
        };

        job.attrs.progress = 100;


        const totalCosts = calculateTotalCosts(researchResults, synthesis, finalReport);
        await updateJobCosts(jobId, totalCosts);

        logger.info(`Deep research completed for topic: ${topic}`, { jobId });
        return result;

    } catch (error) {
        logger.error(`Deep research failed for topic: ${topic}`, {
            jobId,
            errorMessage: error.message,
            errorStack: error.stack,
            errorName: error.name,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
        await updateJobCosts(jobId, null, error.message);
        throw error;
    }
};

const createResearchPlan = async (topic, depth, sources, deliverables) => {
    try {
        logger.info('Starting research plan creation', { topic, depth });

        // Step 1: Analyze topic complexity for cost optimization
        logger.info('Analyzing topic complexity...');
        const complexity = await analyzeTopicComplexity(topic, depth);
        logger.info('Topic complexity analyzed', { complexity });

        // Step 2: Calculate optimal token distribution
        logger.info('Calculating token distribution...');
        const tokenBudget = calculateOptimalTokenDistribution(depth, complexity);
        logger.info('Token budget calculated', { tokenBudget });

        // Step 3: Generate cost-effective planning prompt
        logger.info('Creating planning prompt...');
        const planningPrompt = createCostEffectivePlanningPrompt(topic, depth, sources, deliverables, complexity);
        logger.info('Planning prompt created', { promptLength: planningPrompt.length });

        // Step 4: Make single API call for entire plan (cost optimization)
        logger.info('Calling Alchemyst API for plan generation...');
        let planResult;
        try {
            planResult = await alchemystService.generateAnalysis(planningPrompt, {
                maxTokens: tokenBudget.planning,
                temperature: 0.2
            });
            logger.info('Alchemyst API call successful', {
                contentLength: planResult.content?.length,
                tokens: planResult.tokens,
                cost: planResult.cost
            });
        } catch (apiError) {
            logger.error('Alchemyst API call failed:', {
                errorMessage: apiError.message,
                errorStack: apiError.stack,
                errorName: apiError.name,
                apiUrl: process.env.ALCHEMYST_API_URL,
                hasApiKey: !!process.env.ALCHEMYST_API_KEY
            });
            throw new Error(`API call failed: ${apiError.message || 'Unknown API error'}`);
        }

        // Step 5: Parse and optimize the research steps
        logger.info('Parsing research steps...');
        const rawSteps = parseResearchSteps(planResult.content, depth, tokenBudget);
        logger.info('Research steps parsed', { stepCount: rawSteps.length });

        // Step 6: Identify parallelizable steps for concurrency
        const optimizedSteps = identifyParallelizableSteps(rawSteps, complexity);

        // Step 7: Estimate total costs
        const costEstimate = estimateStepCosts(optimizedSteps, tokenBudget);

        logger.info('Research plan created successfully', {
            stepCount: optimizedSteps.length,
            estimatedCost: costEstimate.totalEstimatedCost
        });

        return {
            topic,
            depth,
            complexity: complexity.level,
            objectives: extractObjectives(planResult.content),
            methodology: selectOptimalMethodology(complexity, tokenBudget),
            steps: optimizedSteps,
            tokenBudget,
            costEstimate,
            parallelExecution: optimizedSteps.some(step => step.canRunInParallel),
            estimatedDuration: calculateOptimizedDuration(optimizedSteps, complexity),
            qualityCriteria: extractQualityCriteria(planResult.content),
            createdAt: new Date(),
            planningCost: planResult.cost
        };
    } catch (error) {
        logger.error('Error creating cost-optimized research plan:', {
            errorMessage: error.message,
            errorStack: error.stack,
            errorName: error.name,
            topic,
            depth,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
        throw new Error(`Research planning failed: ${error.message || 'Unknown planning error'}`);
    }
};

// Cost and complexity analysis
const analyzeTopicComplexity = async (topic, depth) => {
    try {
        logger.info('Analyzing topic complexity', { topic, depth });

        const factors = {
            topicLength: topic.length,
            technicalTerms: (topic.match(/\b(algorithm|system|framework|methodology|analysis|research|development)\b/gi) || []).length,
            domainSpecific: detectDomain(topic),
            depthMultiplier: depth === 'shallow' ? 0.5 : depth === 'medium' ? 1.0 : 1.8
        };

        const complexityScore = (factors.topicLength / 100) +
            (factors.technicalTerms * 2) +
            (factors.depthMultiplier * 3);

        const result = {
            level: complexityScore < 5 ? 'low' : complexityScore < 10 ? 'medium' : 'high',
            score: complexityScore,
            factors
        };

        logger.info('Topic complexity analysis complete', result);
        return result;
    } catch (error) {
        logger.error('Error in analyzeTopicComplexity:', {
            errorMessage: error.message,
            topic,
            depth
        });
        // Return default complexity to prevent failure
        return {
            level: 'medium',
            score: 5,
            factors: { topicLength: topic.length, technicalTerms: 0, domainSpecific: 'general', depthMultiplier: 1.0 }
        };
    }
};

// Smart token budget allocation
const calculateOptimalTokenDistribution = (depth, complexity) => {
    const baseTokens = {
        shallow: 8000,
        medium: 15000,
        deep: 25000
    };

    const complexityMultiplier = {
        low: 0.8,
        medium: 1.0,
        high: 1.3
    };

    const totalBudget = baseTokens[depth] * complexityMultiplier[complexity.level];

    return {
        planning: Math.floor(totalBudget * 0.1), // 10% for planning
        execution: Math.floor(totalBudget * 0.7), // 70% for research steps
        synthesis: Math.floor(totalBudget * 0.15), // 15% for synthesis
        deliverables: Math.floor(totalBudget * 0.05), // 5% for final formatting
        total: totalBudget
    };
};

// Identify steps that can run in parallel for better concurrency
const identifyParallelizableSteps = (steps, complexity) => {
    return steps.map((step, index) => {
        // Steps that can typically run in parallel
        const parallelizableTypes = [
            'literature review',
            'source analysis',
            'data collection',
            'market research',
            'comparative analysis'
        ];

        const canRunInParallel = parallelizableTypes.some(type =>
            step.name.toLowerCase().includes(type)
        ) && complexity.level !== 'high'; // Complex topics need sequential processing

        return {
            ...step,
            canRunInParallel,
            dependencies: index === 0 ? [] : canRunInParallel ? [] : [index - 1],
            estimatedTokens: Math.floor(step.estimatedTokens * (canRunInParallel ? 0.8 : 1.0)) // Parallel steps can be more focused
        };
    });
};

// Cost estimation for better budget management
const estimateStepCosts = (steps, tokenBudget) => {
    const INPUT_COST_PER_TOKEN = 0.00003;
    const OUTPUT_COST_PER_TOKEN = 0.00006;

    const stepCosts = steps.map(step => {
        const inputTokens = step.estimatedTokens * 0.3; // Prompt tokens
        const outputTokens = step.estimatedTokens * 0.7; // Response tokens

        return {
            step: step.number,
            inputCost: inputTokens * INPUT_COST_PER_TOKEN,
            outputCost: outputTokens * OUTPUT_COST_PER_TOKEN,
            totalCost: (inputTokens * INPUT_COST_PER_TOKEN) + (outputTokens * OUTPUT_COST_PER_TOKEN)
        };
    });

    const totalCost = stepCosts.reduce((sum, cost) => sum + cost.totalCost, 0);

    return {
        stepCosts,
        totalEstimatedCost: totalCost,
        costPerToken: totalCost / tokenBudget.total,
        budgetUtilization: (tokenBudget.total * 0.00004) // Rough estimate
    };
};

// Optimized methodology selection
const selectOptimalMethodology = (complexity, tokenBudget) => {
    if (complexity.level === 'low' && tokenBudget.total < 10000) {
        return 'rapid_synthesis'; // Fast, cost-effective approach
    } else if (complexity.level === 'high' || tokenBudget.total > 20000) {
        return 'comprehensive_analysis'; // Thorough but expensive
    } else {
        return 'balanced_research'; // Middle ground
    }
};

// Cost-effective planning prompt
const createCostEffectivePlanningPrompt = (topic, depth, sources, deliverables, complexity) => {
    const stepCount = complexity.level === 'low' ? 4 : complexity.level === 'medium' ? 6 : 8;

    return `
Create a research plan for: ${topic}

REQUIREMENTS:
- Complexity: ${complexity.level}
- Depth: ${depth}
- Steps needed: ${stepCount}
- Deliverables: ${deliverables.join(', ')}

Return ONLY valid JSON in this exact format:
{
  "steps": [
    {
      "number": 1,
      "name": "Initial Research and Context Analysis",
      "description": "Gather foundational information and establish research context",
      "methodology": "systematic_review",
      "expectedOutput": "Comprehensive overview with key concepts defined",
      "estimatedTokens": 1500,
      "canRunInParallel": false,
      "dependencies": [],
      "efficiency": "high"
    }
  ]
}

Generate exactly ${stepCount} steps. Each step must have all required fields.
`;
};


const parseResearchSteps = (planContent, depth, tokenBudget) => {
    try {
        // Try to extract JSON from the response
        let jsonStr = planContent.trim();

        // Find JSON object in response
        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}') + 1;

        if (jsonStart === -1 || jsonEnd === 0) {
            logger.warn('No JSON found in plan content, falling back to default steps');
            return generateDefaultSteps(depth, tokenBudget);
        }

        jsonStr = jsonStr.substring(jsonStart, jsonEnd);

        // Parse JSON
        const parsedPlan = JSON.parse(jsonStr);

        if (!parsedPlan.steps || !Array.isArray(parsedPlan.steps)) {
            throw new Error('Invalid JSON structure: missing steps array');
        }

        // Validate and process steps
        const processedSteps = parsedPlan.steps.map((step, index) => {
            return {
                number: step.number || index + 1,
                name: step.name || `Research Step ${index + 1}`,
                description: step.description || 'Conduct research analysis',
                methodology: step.methodology || 'systematic_analysis',
                expectedOutput: step.expectedOutput || 'Research findings and analysis',
                estimatedTokens: step.estimatedTokens || calculateStepTokenAllocation(tokenBudget, depth, index + 1),
                canRunInParallel: Boolean(step.canRunInParallel),
                dependencies: Array.isArray(step.dependencies) ? step.dependencies : [],
                efficiency: step.efficiency || 'medium'
            };
        });

        logger.info(`Successfully parsed ${processedSteps.length} steps from JSON`);
        return processedSteps;

    } catch (error) {
        logger.error('JSON parsing failed:', error.message);
        logger.warn('Falling back to default step generation');
        return generateDefaultSteps(depth, tokenBudget);
    }
};



// Helper function for token allocation per step
const calculateStepTokenAllocation = (tokenBudget, depth, stepNumber) => {
    const baseAllocation = tokenBudget.execution / (depth === 'shallow' ? 4 : depth === 'medium' ? 6 : 8);

    // Give more tokens to critical steps (1, middle, last)
    const multiplier = stepNumber === 1 ? 1.2 :
        stepNumber === Math.floor((depth === 'shallow' ? 4 : depth === 'medium' ? 6 : 8) / 2) ? 1.1 :
            stepNumber === (depth === 'shallow' ? 4 : depth === 'medium' ? 6 : 8) ? 1.1 :
                0.9;

    return Math.floor(baseAllocation * multiplier);
};

const getStepTokenEstimate = (depth) => {
    switch (depth) {
        case 'shallow': return 800;
        case 'medium': return 1500;
        case 'deep': return 2500;
        default: return 1500;
    }
};

const validateStepStructure = (step, index) => {
    const required = ['name', 'description'];
    const missing = required.filter(field => !step[field]);

    if (missing.length > 0) {
        logger.warn(`Step ${index + 1} missing fields: ${missing.join(', ')}`);
        return false;
    }

    return true;
};

const generateDefaultSteps = (depth, tokenBudget) => {
    const stepCount = depth === 'shallow' ? 4 : depth === 'medium' ? 6 : 8;
    const defaultStepTemplates = [
        {
            name: "Initial Research and Context Analysis",
            description: "Gather foundational information and establish research context",
            methodology: "systematic_review"
        },
        {
            name: "Literature Review and Source Analysis",
            description: "Review existing research and analyze credible sources",
            methodology: "literature_analysis"
        },
        {
            name: "Key Findings Identification",
            description: "Identify and analyze key findings and data points",
            methodology: "data_analysis"
        },
        {
            name: "Comparative Analysis",
            description: "Compare different perspectives and approaches",
            methodology: "comparative_study"
        },
        {
            name: "Synthesis and Pattern Recognition",
            description: "Synthesize information and identify patterns",
            methodology: "pattern_analysis"
        },
        {
            name: "Critical Evaluation",
            description: "Critically evaluate findings and assess validity",
            methodology: "critical_analysis"
        },
        {
            name: "Implications and Applications",
            description: "Analyze implications and practical applications",
            methodology: "application_analysis"
        },
        {
            name: "Conclusions and Recommendations",
            description: "Draw conclusions and provide recommendations",
            methodology: "synthesis_conclusion"
        }
    ];

    return defaultStepTemplates.slice(0, stepCount).map((template, index) => ({
        number: index + 1,
        name: template.name,
        description: template.description,
        methodology: template.methodology,
        expectedOutput: 'Detailed research analysis and findings',
        estimatedTokens: calculateStepTokenAllocation(tokenBudget, depth, index + 1),
        canRunInParallel: index > 0 && index < stepCount - 1, // Middle steps can be parallel
        dependencies: index === 0 ? [] : [index - 1],
        efficiency: 'medium'
    }));
};

const executeResearchPlan = async (plan, job) => {
    const results = [];
    const totalSteps = plan.steps.length;
    let accumulatedContext = { topic: plan.topic, methodology: plan.methodology };
    let totalCosts = {
        totalTokens: 0,
        totalCost: 0,
        apiCalls: 0,
        breakdown: []
    };

    logger.info(`Starting execution of ${totalSteps} steps`, {
        jobId: job.attrs._id,
        estimatedCost: plan.costEstimate?.totalEstimatedCost || 0
    });

    const executionGroups = groupStepsForExecution(plan.steps);
    let currentProgress = 15;
    const progressIncrement = 55 / totalSteps;

    for (let groupIndex = 0; groupIndex < executionGroups.length; groupIndex++) {
        const group = executionGroups[groupIndex];

        try {
            let groupResults;

            if (group.type === 'parallel' && group.steps.length > 1) {
                groupResults = await executeParallelSteps(group.steps, accumulatedContext, plan, job.attrs._id);
            } else {
                groupResults = await executeSequentialSteps(group.steps, accumulatedContext, plan, job.attrs._id);
            }

            // Accumulate costs from group results
            groupResults.forEach(result => {
                totalCosts.totalTokens += result.tokens || 0;
                totalCosts.totalCost += result.cost || 0;
                totalCosts.apiCalls += 1;
                totalCosts.breakdown.push({
                    step: result.stepName,
                    tokens: result.tokens,
                    cost: result.cost,
                    apiCall: result.apiCall || 'genai.chat.generate'
                });
            });

            const validatedResults = await validateAndIntegrateResults(groupResults, accumulatedContext);
            results.push(...validatedResults);

            accumulatedContext = await updateExecutionContext(accumulatedContext, validatedResults, plan);

            currentProgress += (group.steps.length * progressIncrement);
            job.attrs.progress = Math.min(currentProgress, 70);

            // Update costs in real-time
            await updateJobCosts(job.attrs._id, totalCosts);

        } catch (error) {
            logger.error(`Execution group ${groupIndex + 1} failed:`, {
                jobId: job.attrs._id,
                error: error.message
            });

            const recoveryResult = await handleExecutionError(error, group, accumulatedContext, plan);
            if (recoveryResult.canContinue) {
                results.push(...recoveryResult.results);
                accumulatedContext = recoveryResult.updatedContext;
            } else {
                throw error;
            }
        }
    }

    const executionSummary = await generateExecutionSummary(results, plan, totalCosts);

    logger.info(`Execution completed`, {
        jobId: job.attrs._id,
        totalSteps: results.length,
        actualCost: totalCosts.totalCost,
        totalTokens: totalCosts.totalTokens,
        apiCalls: totalCosts.apiCalls
    });

    return results;
};

// Step 1: Group steps by execution strategy (parallel vs sequential)
const executionGroups = groupStepsForExecution(plan.steps);

// Step 2: Execute groups with cost monitoring
let currentProgress = 15; // Starting progress
const progressIncrement = 55 / totalSteps; // 55% total range for execution

for (let groupIndex = 0; groupIndex < executionGroups.length; groupIndex++) {
    const group = executionGroups[groupIndex];

    logger.info(`Executing group ${groupIndex + 1}/${executionGroups.length}`, {
        jobId: job.attrs._id,
        groupType: group.type,
        stepCount: group.steps.length
    });

    try {
        let groupResults;

        if (group.type === 'parallel' && group.steps.length > 1) {
            // Execute parallel steps concurrently
            groupResults = await executeParallelSteps(group.steps, accumulatedContext, plan, job.attrs._id);
        } else {
            // Execute sequential steps
            groupResults = await executeSequentialSteps(group.steps, accumulatedContext, plan, job.attrs._id);
        }

        // Step 3: Validate and integrate results
        const validatedResults = await validateAndIntegrateResults(groupResults, accumulatedContext);
        results.push(...validatedResults);

        // Step 4: Update context with new findings
        accumulatedContext = await updateExecutionContext(accumulatedContext, validatedResults, plan);

        // Step 5: Adaptive re-planning if needed
        if (shouldReplanBasedOnFindings(validatedResults, plan)) {
            const adaptedSteps = await adaptRemainingSteps(
                executionGroups.slice(groupIndex + 1),
                accumulatedContext,
                plan
            );
            executionGroups.splice(groupIndex + 1, executionGroups.length - groupIndex - 1, ...adaptedSteps);
        }

        // Update progress
        currentProgress += (group.steps.length * progressIncrement);
        job.attrs.progress = (Math.min(currentProgress, 70));


    } catch (error) {
        logger.error(`Execution group ${groupIndex + 1} failed:`, {
            jobId: job.attrs._id,
            error: error.message,
            groupType: group.type
        });

        // Implement intelligent error recovery
        const recoveryResult = await handleExecutionError(error, group, accumulatedContext, plan);
        if (recoveryResult.canContinue) {
            results.push(...recoveryResult.results);
            accumulatedContext = recoveryResult.updatedContext;
        } else {
            throw error;
        }
    }


// Step 6: Final cost and quality assessment
const executionSummary = await generateExecutionSummary(results, plan);

logger.info(`Intelligent execution completed`, {
    jobId: job.attrs._id,
    totalSteps: results.length,
    actualCost: executionSummary.totalCost,
    estimatedCost: plan.costEstimate.totalEstimatedCost,
    costEfficiency: executionSummary.costEfficiency
});

return results;
};

// Group steps for optimal execution strategy
const groupStepsForExecution = (steps) => {
    const groups = [];
    let currentGroup = { type: 'sequential', steps: [] };

    steps.forEach((step, index) => {
        if (step.canRunInParallel && currentGroup.steps.length > 0) {
            // Start new parallel group if we have parallelizable steps
            if (currentGroup.type === 'sequential' && currentGroup.steps.length > 0) {
                groups.push(currentGroup);
                currentGroup = { type: 'parallel', steps: [step] };
            } else if (currentGroup.type === 'parallel') {
                currentGroup.steps.push(step);
            }
        } else {
            // Add to sequential group
            if (currentGroup.type === 'parallel' && currentGroup.steps.length > 0) {
                groups.push(currentGroup);
                currentGroup = { type: 'sequential', steps: [step] };
            } else {
                currentGroup.steps.push(step);
            }
        }
    });

    if (currentGroup.steps.length > 0) {
        groups.push(currentGroup);
    }

    return groups;
};

// Execute steps in parallel for better concurrency
const executeParallelSteps = async (steps, context, plan, jobId) => {
    logger.info(`Executing ${steps.length} steps in parallel`, { jobId });

    const stepPromises = steps.map(async (step) => {
        try {
            const stepContext = buildOptimizedStepContext(context, step, plan);
            const stepPrompt = createCostOptimizedStepPrompt(step, stepContext);

            const stepResult = await alchemystService.generateAnalysis(stepPrompt, {
                maxTokens: step.estimatedTokens,
                temperature: 0.3
            });

            return {
                stepNumber: step.number,
                stepName: step.name,
                description: step.description,
                content: stepResult.content,
                tokens: stepResult.tokens,
                cost: stepResult.cost,
                apiCall: stepResult.apiCall,
                executionType: 'parallel',
                quality: await assessStepQuality(stepResult.content),
                completedAt: new Date()
            };

        } catch (error) {
            logger.error(`Parallel step ${step.number} failed:`, error);
            throw new Error(`Parallel step ${step.number} failed: ${error.message}`);
        }
    });

    const results = await Promise.allSettled(stepPromises);
    const successfulResults = [];
    const failedResults = [];

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            successfulResults.push(result.value);
        } else {
            failedResults.push({
                stepNumber: steps[index].number,
                error: result.reason.message
            });
        }
    });

    if (failedResults.length > 0 && successfulResults.length > 0) {
        logger.warn(`${failedResults.length} parallel steps failed, attempting recovery`, { jobId });
        const recoveredResults = await recoverFailedParallelSteps(failedResults, successfulResults, context, plan);
        successfulResults.push(...recoveredResults);
    } else if (failedResults.length === steps.length) {
        throw new Error(`All parallel steps failed: ${failedResults.map(f => f.error).join('; ')}`);
    }

    return successfulResults;
};


// Execute steps sequentially with adaptive optimization
const executeSequentialSteps = async (steps, context, plan, jobId) => {
    const results = [];
    let currentContext = { ...context };

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        logger.info(`Executing sequential step ${step.number}: ${step.name}`, { jobId });

        try {
            const stepContext = buildEnhancedStepContext(currentContext, results, step, plan);
            const stepPrompt = createAdaptiveStepPrompt(step, stepContext, results);
            const adaptiveTokens = calculateAdaptiveTokenAllocation(step, stepContext, results);

            const stepResult = await alchemystService.generateAnalysis(stepPrompt, {
                maxTokens: adaptiveTokens,
                temperature: 0.3
            });

            const processedResult = {
                stepNumber: step.number,
                stepName: step.name,
                description: step.description,
                content: stepResult.content,
                tokens: stepResult.tokens,
                cost: stepResult.cost,
                apiCall: stepResult.apiCall,
                executionType: 'sequential',
                contextRichness: calculateContextRichness(stepContext),
                quality: await assessStepQuality(stepResult.content),
                completedAt: new Date()
            };

            if (processedResult.quality.score < 0.6) {
                logger.warn(`Step ${step.number} quality below threshold, retrying`, { jobId });
                const retryResult = await retryStepWithEnhancement(step, stepContext, stepResult);
                if (retryResult) {
                    processedResult.content = retryResult.content;
                    processedResult.tokens += retryResult.tokens;
                    processedResult.cost += retryResult.cost;
                    processedResult.quality = await assessStepQuality(retryResult.content);
                    processedResult.retried = true;
                }
            }

            results.push(processedResult);
            currentContext = await updateStepContext(currentContext, processedResult, plan);

        } catch (error) {
            logger.error(`Sequential step ${step.number} failed:`, error);
            const fallbackResult = await generateFallbackStepResult(step, currentContext, error);
            if (fallbackResult) {
                results.push(fallbackResult);
                currentContext = await updateStepContext(currentContext, fallbackResult, plan);
            } else {
                throw new Error(`Sequential step ${step.number} failed: ${error.message}`);
            }
        }
    }

    return results;
};
// Validate and integrate results for quality assurance
const validateAndIntegrateResults = async (results, context) => {
    const validatedResults = [];

    for (const result of results) {
        try {
            // Check for content quality
            if (result.quality.score < 0.5) {
                logger.warn(`Result quality too low for step ${result.stepNumber}, flagging for review`);
                result.needsReview = true;
            }

            // Check for content coherence with context
            const coherenceScore = await assessContentCoherence(result.content, context);
            result.coherenceScore = coherenceScore;

            // Extract key insights for context building
            result.keyInsights = extractKeyInsights(result.content);

            validatedResults.push(result);

        } catch (error) {
            logger.error(`Validation failed for step ${result.stepNumber}:`, error);
            result.validationError = error.message;
            validatedResults.push(result); // Include even failed validation
        }
    }

    return validatedResults;
};

// Smart context building for cost efficiency
const buildOptimizedStepContext = (context, step, plan) => {
    return {
        topic: context.topic,
        methodology: plan.methodology,
        stepObjective: step.name,
        relevantFindings: context.cumulativeInsights ? context.cumulativeInsights.slice(-3) : [], // Only last 3 insights
        focusArea: extractStepFocusArea(step.description)
    };
};

// Enhanced context for sequential steps
const buildEnhancedStepContext = (context, previousResults, step, plan) => {
    const recentResults = previousResults.slice(-2); // Last 2 results for context

    return {
        topic: context.topic,
        methodology: plan.methodology,
        stepObjective: step.name,
        previousFindings: recentResults.map(r => ({
            step: r.stepName,
            keyPoints: r.keyInsights || extractKeyInsights(r.content)
        })),
        cumulativeInsights: context.cumulativeInsights || [],
        conflictAreas: identifyPotentialConflicts(recentResults),
        qualityBaseline: calculateQualityBaseline(previousResults)
    };
};

// Assess step quality for validation
const assessStepQuality = async (content) => {
    const metrics = {
        length: content.length,
        informationDensity: calculateInformationDensity(content),
        structureScore: assessContentStructure(content),
        factualityIndicators: countFactualIndicators(content)
    };

    const score = Math.min(1.0,
        (metrics.informationDensity * 0.4) +
        (metrics.structureScore * 0.3) +
        (Math.min(metrics.factualityIndicators / 5, 1) * 0.3)
    );

    return {
        score,
        metrics,
        category: score > 0.8 ? 'excellent' : score > 0.6 ? 'good' : score > 0.4 ? 'acceptable' : 'poor'
    };
};

// Monitor and update execution context
const updateExecutionContext = async (context, newResults, plan) => {
    const updatedContext = { ...context };

    // Extract and merge insights
    const newInsights = newResults.flatMap(r => r.keyInsights || []);
    updatedContext.cumulativeInsights = [
        ...(context.cumulativeInsights || []),
        ...newInsights
    ].slice(-10); // Keep only last 10 insights for cost efficiency

    // Update conflict detection
    updatedContext.identifiedConflicts = await detectNewConflicts(newResults, context);

    // Update quality trends
    updatedContext.qualityTrend = calculateQualityTrend(newResults);

    // Update cost tracking
    updatedContext.currentCost = (context.currentCost || 0) +
        newResults.reduce((sum, r) => sum + (r.cost || 0), 0);

    return updatedContext;
};

// Smart cost-optimized prompt creation
const createCostOptimizedStepPrompt = (step, context) => {
    return `
RESEARCH STEP: ${step.name}
OBJECTIVE: ${step.description}
CONTEXT: ${context.topic} | ${context.methodology}

EFFICIENCY REQUIREMENTS:
- Focus on HIGH-VALUE information only
- Avoid redundancy with previous findings
- Provide SPECIFIC, actionable insights
- Minimize unnecessary elaboration

${context.relevantFindings ? `RELEVANT CONTEXT: ${context.relevantFindings.slice(0, 2).join('; ')}` : ''}

Deliver concise, high-impact research findings for this specific objective.
`;
};

// Adaptive prompt creation for sequential steps
const createAdaptiveStepPrompt = (step, context, previousResults) => {
    const recentQualities = previousResults.slice(-2).map(r => r.quality.category);
    const needsEnhancement = recentQualities.includes('poor') || recentQualities.includes('acceptable');

    let prompt = `
RESEARCH STEP ${step.number}: ${step.name}
OBJECTIVE: ${step.description}

CONTEXT & PROGRESSION:
Topic: ${context.topic}
Methodology: ${context.methodology}
Quality Baseline: ${context.qualityBaseline || 'Standard'}

`;

    if (context.previousFindings && context.previousFindings.length > 0) {
        prompt += `BUILDING ON PREVIOUS FINDINGS:\n`;
        context.previousFindings.forEach(finding => {
            prompt += `- ${finding.step}: ${finding.keyPoints.slice(0, 2).join(', ')}\n`;
        });
    }

    if (context.conflictAreas && context.conflictAreas.length > 0) {
        prompt += `\nCONFLICT AREAS TO ADDRESS: ${context.conflictAreas.join(', ')}\n`;
    }

    if (needsEnhancement) {
        prompt += `
QUALITY ENHANCEMENT REQUIRED:
- Provide detailed, evidence-based analysis
- Include specific examples and data points
- Ensure logical flow and clear conclusions
- Address any gaps from previous steps
`;
    }

    prompt += `
Deliver ${needsEnhancement ? 'comprehensive' : 'focused'}, high-quality research findings that advance the overall research objective.
`;

    return prompt;
};

// Calculate adaptive token allocation
const calculateAdaptiveTokenAllocation = (step, context, previousResults) => {
    let baseTokens = step.estimatedTokens;

    // Adjust based on context richness
    const contextMultiplier = 1 + (context.contextRichness || 0) * 0.2;

    // Adjust based on previous step quality
    const qualityMultiplier = previousResults.length > 0 ?
        (previousResults.slice(-1)[0].quality.score < 0.6 ? 1.3 : 1.0) : 1.0;

    // Adjust based on step importance (first and last steps get more tokens)
    const importanceMultiplier = step.number === 1 || step.number > 6 ? 1.1 : 1.0;

    return Math.floor(baseTokens * contextMultiplier * qualityMultiplier * importanceMultiplier);
};

// Generate execution summary for cost tracking
const generateExecutionSummary = async (results, plan, totalCosts) => {
    const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalTokens = results.reduce((sum, r) => sum + (r.tokens || 0), 0);
    const avgQuality = results.reduce((sum, r) => sum + (r.quality?.score || 0), 0) / results.length;

    return {
        totalSteps: results.length,
        totalCost,
        totalTokens,
        avgQuality,
        costEfficiency: plan.costEstimate.totalEstimatedCost / totalCost,
        parallelSteps: results.filter(r => r.executionType === 'parallel').length,
        retriedSteps: results.filter(r => r.retried).length,
        qualityDistribution: {
            excellent: results.filter(r => r.quality?.category === 'excellent').length,
            good: results.filter(r => r.quality?.category === 'good').length,
            acceptable: results.filter(r => r.quality?.category === 'acceptable').length,
            poor: results.filter(r => r.quality?.category === 'poor').length
        }
    };
};

//helper funcs 
const updateStepContext = async (context, result, plan) => {
    const updatedContext = { ...context };

    // Add insights from the current step
    const stepInsights = extractKeyInsights(result.content);
    updatedContext.cumulativeInsights = [
        ...(context.cumulativeInsights || []),
        ...stepInsights
    ].slice(-15); // Keep last 15 insights

    // Update quality baseline
    updatedContext.qualityBaseline = result.quality?.category || 'standard';

    // Track step completion
    updatedContext.completedSteps = (context.completedSteps || 0) + 1;

    // Update conflict areas if any new ones detected
    const newConflicts = await detectNewConflicts([result], context);
    updatedContext.conflictAreas = [
        ...(context.conflictAreas || []),
        ...newConflicts
    ];

    return updatedContext;
};

const assessContentCoherence = async (content, context) => {
    // Simple coherence scoring based on topic relevance
    const topicWords = context.topic.toLowerCase().split(' ');
    const contentWords = content.toLowerCase().split(' ');

    const relevantWords = topicWords.filter(word =>
        contentWords.some(cWord => cWord.includes(word) || word.includes(cWord))
    );

    const coherenceScore = relevantWords.length / topicWords.length;
    return Math.min(1.0, coherenceScore + 0.3); // Add base coherence
};

const calculateOptimizedDuration = (steps, complexity) => {
    const baseTimePerStep = complexity.level === 'low' ? 30 : complexity.level === 'medium' ? 45 : 60;
    const parallelSteps = steps.filter(step => step.canRunInParallel).length;
    const sequentialSteps = steps.length - parallelSteps;

    const parallelTime = parallelSteps > 0 ? Math.max(baseTimePerStep, parallelSteps * baseTimePerStep * 0.6) : 0;
    const sequentialTime = sequentialSteps * baseTimePerStep;

    return Math.floor(parallelTime + sequentialTime);
};


const extractKeyInsights = (content) => {
    // Simple insight extraction
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
    const insights = sentences.filter(s =>
        s.toLowerCase().includes('important') ||
        s.toLowerCase().includes('significant') ||
        s.toLowerCase().includes('key') ||
        s.toLowerCase().includes('critical') ||
        s.toLowerCase().includes('findings')
    );
    return insights.slice(0, 5).map(s => s.trim());
};

const calculateInformationDensity = (content) => {
    const words = content.split(/\s+/);
    const infoWords = words.filter(word =>
        word.length > 4 &&
        !['that', 'this', 'with', 'have', 'will', 'been', 'from', 'they', 'were'].includes(word.toLowerCase())
    );
    return Math.min(1.0, infoWords.length / words.length);
};

const assessContentStructure = (content) => {
    const hasHeaders = /(?:^|\n)(?:#|\d+\.|[A-Z][^.]*:)/m.test(content);
    const hasBullets = /(?:^|\n)[-*•]/m.test(content);
    const hasNumbers = /\d+\.?\s/.test(content);
    const paragraphs = content.split('\n\n').length;

    let score = 0;
    if (hasHeaders) score += 0.3;
    if (hasBullets) score += 0.2;
    if (hasNumbers) score += 0.2;
    if (paragraphs > 2) score += 0.3;

    return Math.min(1.0, score);
};

const countFactualIndicators = (content) => {
    const indicators = [
        /\d+%/, // percentages
        /\$\d+/, // dollar amounts
        /\d{4}/, // years
        /according to/gi,
        /research shows/gi,
        /studies indicate/gi,
        /data reveals/gi
    ];

    return indicators.reduce((count, pattern) => {
        const matches = content.match(pattern);
        return count + (matches ? matches.length : 0);
    }, 0);
};

const calculateContextRichness = (context) => {
    let richness = 0;
    if (context.previousFindings && context.previousFindings.length > 0) richness += 0.3;
    if (context.cumulativeInsights && context.cumulativeInsights.length > 2) richness += 0.3;
    if (context.conflictAreas && context.conflictAreas.length > 0) richness += 0.2;
    if (context.qualityBaseline) richness += 0.2;
    return Math.min(1.0, richness);
};

const extractStepFocusArea = (description) => {
    const focusKeywords = {
        'analysis': 'analytical',
        'research': 'investigative',
        'review': 'evaluative',
        'comparison': 'comparative',
        'synthesis': 'integrative'
    };

    const descLower = description.toLowerCase();
    for (const [keyword, focus] of Object.entries(focusKeywords)) {
        if (descLower.includes(keyword)) return focus;
    }
    return 'general';
};

const identifyPotentialConflicts = (results) => {
    // Simple conflict detection based on contradictory keywords
    const conflictPairs = [
        ['increase', 'decrease'],
        ['positive', 'negative'],
        ['effective', 'ineffective'],
        ['beneficial', 'harmful']
    ];

    const conflicts = [];
    const allContent = results.map(r => r.content.toLowerCase()).join(' ');

    conflictPairs.forEach(([word1, word2]) => {
        if (allContent.includes(word1) && allContent.includes(word2)) {
            conflicts.push(`${word1} vs ${word2}`);
        }
    });

    return conflicts;
};

const calculateQualityBaseline = (results) => {
    if (results.length === 0) return 'standard';
    const avgScore = results.reduce((sum, r) => sum + (r.quality?.score || 0.5), 0) / results.length;
    return avgScore > 0.8 ? 'high' : avgScore > 0.6 ? 'standard' : 'low';
};

const detectDomain = (topic) => {
    const domains = {
        technology: ['software', 'algorithm', 'AI', 'machine learning', 'programming', 'development'],
        business: ['market', 'strategy', 'finance', 'economics', 'marketing', 'sales'],
        science: ['research', 'study', 'analysis', 'methodology', 'experiment', 'data'],
        health: ['medical', 'health', 'clinical', 'patient', 'treatment', 'diagnosis']
    };

    const topicLower = topic.toLowerCase();
    for (const [domain, keywords] of Object.entries(domains)) {
        if (keywords.some(keyword => topicLower.includes(keyword))) {
            return domain;
        }
    }
    return 'general';
};

// Quality Control Functions
const retryStepWithEnhancement = async (step, context, result) => {
    logger.info(`Retrying step ${step.number} with enhancement`);

    try {
        // Analyze why the original failed
        const failureReasons = analyzeStepFailure(result);

        // Create enhanced prompt with more context and clearer instructions
        const enhancedPrompt = `
ENHANCED RETRY - Step ${step.number}: ${step.name}

PREVIOUS ATTEMPT ISSUES: ${failureReasons.join(', ')}

ENHANCED REQUIREMENTS:
- Provide specific, detailed analysis with concrete examples
- Include quantitative data where possible
- Structure response with clear headings and bullet points
- Ensure factual accuracy and cite reasoning
- Minimum 800 words for comprehensive coverage

CONTEXT: ${JSON.stringify(context, null, 2)}

STEP OBJECTIVE: ${step.description}

Deliver high-quality, structured research that addresses the identified gaps.
`;

        // Retry with higher token allocation and temperature adjustment
        const retryResult = await alchemystService.generateAnalysis(enhancedPrompt, {
            maxTokens: Math.floor(step.estimatedTokens * 1.5),
            temperature: 0.2 // Lower temperature for more focused output
        });

        logger.info(`Step ${step.number} retry successful`);
        return retryResult;

    } catch (error) {
        logger.error(`Step ${step.number} retry failed:`, error);
        return null;
    }
};

const generateFallbackStepResult = async (step, context, error) => {
    logger.warn(`Generating fallback result for step ${step.number}`);

    try {
        // Create simplified prompt for fallback
        const fallbackPrompt = `
FALLBACK MODE - Step ${step.number}: ${step.name}

ISSUE: ${error.message}
CONTEXT: Research topic: ${context.topic}

Provide a basic analysis for this research step using general knowledge:
- Key concepts and definitions
- Common approaches in this area
- General considerations and factors
- Basic recommendations

Keep response concise but informative (300-500 words).
`;

        const fallbackResult = await alchemystService.generateAnalysis(fallbackPrompt, {
            maxTokens: 600,
            temperature: 0.4
        });

        return {
            stepNumber: step.number,
            stepName: step.name + " (Fallback)",
            description: step.description,
            content: fallbackResult.content,
            tokens: fallbackResult.tokens,
            cost: fallbackResult.cost,
            executionType: 'fallback',
            quality: { score: 0.3, category: 'fallback' }, // Mark as lower quality
            isFallback: true,
            originalError: error.message,
            completedAt: new Date()
        };

    } catch (fallbackError) {
        logger.error(`Fallback generation failed for step ${step.number}:`, fallbackError);
        return null;
    }
};

// Adaptive Intelligence Functions
const shouldReplanBasedOnFindings = (results, plan) => {
    if (results.length < 2) return false;

    // Check for significant quality degradation
    const recentQuality = results.slice(-2).map(r => r.quality?.score || 0);
    const avgRecentQuality = recentQuality.reduce((a, b) => a + b, 0) / recentQuality.length;

    if (avgRecentQuality < 0.4) {
        logger.info('Replanning triggered: Quality degradation detected');
        return true;
    }

    // Check for unexpected research direction
    const topicKeywords = plan.topic.toLowerCase().split(' ');
    const recentContent = results.slice(-2).map(r => r.content.toLowerCase()).join(' ');
    const keywordOverlap = topicKeywords.filter(keyword =>
        recentContent.includes(keyword)
    ).length / topicKeywords.length;

    if (keywordOverlap < 0.3) {
        logger.info('Replanning triggered: Research direction drift detected');
        return true;
    }

    // Check for excessive conflicts
    const conflicts = results.slice(-2).flatMap(r => r.conflictAreas || []);
    if (conflicts.length > 3) {
        logger.info('Replanning triggered: Too many conflicts detected');
        return true;
    }

    return false;
};

const adaptRemainingSteps = async (remainingGroups, context, plan) => {
    logger.info('Adapting remaining research steps based on findings');

    try {
        // Extract key insights from completed work
        const completedInsights = context.cumulativeInsights || [];
        const identifiedGaps = context.identifiedConflicts || [];

        // Create adaptation prompt
        const adaptationPrompt = `
RESEARCH ADAPTATION REQUIRED

Original Topic: ${plan.topic}
Completed Insights: ${completedInsights.slice(0, 10).join(', ')}
Identified Issues: ${identifiedGaps.join(', ')}

Current remaining research steps:
${remainingGroups.map((group, i) =>
            group.steps.map(step => `${i + 1}. ${step.name}`).join('\n')
        ).join('\n')}

Please suggest 2-3 focused research steps that:
1. Address identified gaps and conflicts
2. Build on completed insights
3. Provide practical, actionable conclusions

Format as: Step Name | Brief Description | Focus Area
`;

        const adaptationResult = await alchemystService.generateAnalysis(adaptationPrompt, {
            maxTokens: 800,
            temperature: 0.3
        });

        // Parse adaptation suggestions and modify remaining groups
        const adaptedSteps = parseAdaptationSuggestions(adaptationResult.content, plan);

        if (adaptedSteps.length > 0) {
            logger.info(`Successfully adapted ${adaptedSteps.length} remaining steps`);
            return [{
                type: 'sequential',
                steps: adaptedSteps
            }];
        }

    } catch (error) {
        logger.error('Error adapting remaining steps:', error);
    }

    // Return original groups if adaptation fails
    return remainingGroups;
};

const detectNewConflicts = async (results, context) => {
    const conflicts = [];

    // Simple keyword-based conflict detection
    const conflictPairs = [
        ['increase', 'decrease', 'reduction'],
        ['positive', 'negative', 'harmful'],
        ['effective', 'ineffective', 'failed'],
        ['beneficial', 'detrimental', 'damaging'],
        ['supports', 'contradicts', 'opposes'],
        ['validates', 'invalidates', 'disproves']
    ];

    const allContent = results.map(r => r.content.toLowerCase()).join(' ');

    conflictPairs.forEach(([positive, negative, alternative]) => {
        const hasPositive = allContent.includes(positive);
        const hasNegative = allContent.includes(negative) || allContent.includes(alternative);

        if (hasPositive && hasNegative) {
            conflicts.push(`${positive} vs ${negative}`);
        }
    });

    // Check for numerical conflicts
    const numbers = allContent.match(/\d+%|\$\d+|\d+\.\d+/g) || [];
    if (numbers.length > 4) {
        // Simple heuristic: if we have many numbers, there might be conflicting data
        conflicts.push('numerical data inconsistencies');
    }

    return conflicts;
};

// Error Recovery Functions
const handleExecutionError = async (error, group, context, plan) => {
    logger.error(`Handling execution error for group ${group.type}:`, error.message);

    try {
        // Assess error severity
        const errorSeverity = assessErrorSeverity(error);

        if (errorSeverity === 'low') {
            // Try to continue with partial results
            const partialResults = await generatePartialResults(group, context, plan);
            return {
                canContinue: true,
                results: partialResults,
                updatedContext: { ...context, hasPartialResults: true }
            };
        } else if (errorSeverity === 'medium') {
            // Simplify the group and retry
            const simplifiedGroup = simplifyExecutionGroup(group);
            return {
                canContinue: true,
                results: [],
                modifiedGroup: simplifiedGroup,
                updatedContext: context
            };
        } else {
            // High severity - cannot continue
            return {
                canContinue: false,
                error: error.message
            };
        }

    } catch (recoveryError) {
        logger.error('Error recovery failed:', recoveryError);
        return { canContinue: false, error: recoveryError.message };
    }
};

const recoverFailedParallelSteps = async (failedResults, successfulResults, context, plan) => {
    logger.info(`Attempting to recover ${failedResults.length} failed parallel steps`);

    const recoveredResults = [];

    for (const failure of failedResults) {
        try {
            // Use successful results to provide context for failed step
            const successContext = successfulResults.map(s =>
                `${s.stepName}: ${s.content.substring(0, 200)}...`
            ).join('\n');

            const recoveryPrompt = `
PARALLEL STEP RECOVERY

Failed Step: ${failure.stepNumber}
Error: ${failure.error}

Context from successful parallel steps:
${successContext}

Topic: ${context.topic}

Provide a brief analysis for the failed step using the context from successful steps. Focus on complementary information that fills gaps.

Keep response focused and concise (400-600 words).
`;

            const recoveryResult = await alchemystService.generateAnalysis(recoveryPrompt, {
                maxTokens: 800,
                temperature: 0.4
            });

            recoveredResults.push({
                stepNumber: failure.stepNumber,
                stepName: `Recovered Step ${failure.stepNumber}`,
                description: 'Recovery from parallel execution failure',
                content: recoveryResult.content,
                tokens: recoveryResult.tokens,
                cost: recoveryResult.cost,
                executionType: 'recovery',
                quality: { score: 0.5, category: 'recovered' },
                isRecovered: true,
                originalError: failure.error,
                completedAt: new Date()
            });

        } catch (recoveryError) {
            logger.error(`Recovery failed for step ${failure.stepNumber}:`, recoveryError);
        }
    }

    logger.info(`Successfully recovered ${recoveredResults.length} out of ${failedResults.length} failed steps`);
    return recoveredResults;
};

// Monitoring Functions
const calculateQualityTrend = (results) => {
    if (results.length < 2) return 'insufficient_data';

    const scores = results.map(r => r.quality?.score || 0.5);
    const recent = scores.slice(-3);
    const earlier = scores.slice(0, -3);

    if (earlier.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    const difference = recentAvg - earlierAvg;

    if (difference > 0.15) return 'improving';
    if (difference < -0.15) return 'declining';
    return 'stable';
};

// Helper Functions
const analyzeStepFailure = (result) => {
    const failures = [];

    if (!result.content || result.content.length < 200) {
        failures.push('insufficient content length');
    }

    if (result.quality?.score < 0.3) {
        failures.push('low information density');
    }

    if (!result.content.includes('.') || result.content.split('.').length < 3) {
        failures.push('lack of structure');
    }

    return failures.length > 0 ? failures : ['general quality issues'];
};

const assessErrorSeverity = (error) => {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('rate limit')) {
        return 'medium';
    }

    if (message.includes('authentication') || message.includes('permission')) {
        return 'high';
    }

    if (message.includes('network') || message.includes('connection')) {
        return 'medium';
    }

    return 'low';
};

const generatePartialResults = async (group, context, plan) => {
    // Generate simplified results for the group
    const partialPrompt = `
PARTIAL RESEARCH GENERATION

Topic: ${context.topic}
Failed group: ${group.type} with ${group.steps.length} steps

Provide a consolidated analysis covering the main areas these steps would have addressed:
${group.steps.map(s => `- ${s.name}`).join('\n')}

Focus on key insights and general findings (600-800 words).
`;

    try {
        const result = await alchemystService.generateAnalysis(partialPrompt, {
            maxTokens: 1000,
            temperature: 0.3
        });

        return [{
            stepNumber: 'partial',
            stepName: 'Partial Group Recovery',
            content: result.content,
            tokens: result.tokens,
            cost: result.cost,
            isPartial: true,
            quality: { score: 0.4, category: 'partial' },
            completedAt: new Date()
        }];
    } catch (error) {
        logger.error('Partial result generation failed:', error);
        return [];
    }
};

const simplifyExecutionGroup = (group) => {
    return {
        type: 'sequential',
        steps: group.steps.map(step => ({
            ...step,
            estimatedTokens: Math.floor(step.estimatedTokens * 0.7),
            description: `Simplified: ${step.description.substring(0, 100)}...`
        })).slice(0, 2) // Reduce to max 2 steps
    };
};

const parseAdaptationSuggestions = (content, plan) => {
    const lines = content.split('\n').filter(line => line.includes('|'));
    const adaptedSteps = [];

    lines.forEach((line, index) => {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
            adaptedSteps.push({
                number: index + 1,
                name: parts[0],
                description: parts[1] || parts[0],
                expectedOutput: 'Adaptive research analysis',
                estimatedTokens: 1200,
                canRunInParallel: false
            });
        }
    });

    return adaptedSteps.slice(0, 3); // Limit to 3 adaptive steps
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
    const researchTokens = researchResults.reduce((sum, r) => sum + (r.tokens || 0), 0);
    const researchCalls = researchResults.length;

    const synthesisCost = synthesis.cost || 0;
    const synthesisTokens = synthesis.tokens || 0;

    let deliverablesCost = 0;
    let deliverablesTokens = 0;
    let deliverablesCalls = 0;

    Object.values(deliverables).forEach(deliverable => {
        if (deliverable && deliverable.cost) {
            deliverablesCost += deliverable.cost;
            deliverablesTokens += deliverable.tokens || 0;
            deliverablesCalls += 1;
        }
    });

    return {
        totalCost: researchCost + synthesisCost + deliverablesCost,
        totalTokens: researchTokens + synthesisTokens + deliverablesTokens,
        apiCalls: researchCalls + 1 + deliverablesCalls, // +1 for synthesis
        breakdown: {
            research: { cost: researchCost, tokens: researchTokens, calls: researchCalls },
            synthesis: { cost: synthesisCost, tokens: synthesisTokens, calls: 1 },
            deliverables: { cost: deliverablesCost, tokens: deliverablesTokens, calls: deliverablesCalls }
        }
    };
};

const updateJobCosts = async (jobId, costs, errorMessage = null) => {
    try {
        const { getDatabase } = require('../config/database');
        const db = getDatabase();

        if (costs) {
            await db.collection('job_metrics').updateOne(
                { job_id: jobId.toString() },
                {
                    $set: {
                        cost_usd: costs.totalCost,
                        tokens_used: costs.totalTokens,
                        api_calls: costs.apiCalls,
                        cost_breakdown: costs.breakdown,
                        updated_at: new Date()
                    }
                },
                { upsert: true }
            );

            logger.info('Job costs updated:', {
                jobId: jobId.toString(),
                totalCost: costs.totalCost,
                totalTokens: costs.totalTokens,
                apiCalls: costs.apiCalls
            });
        }

        if (errorMessage) {
            await db.collection('job_metrics').updateOne(
                { job_id: jobId.toString() },
                {
                    $set: {
                        error_message: errorMessage,
                        updated_at: new Date()
                    }
                },
                { upsert: true }
            );
        }
    } catch (error) {
        logger.error('Error updating job costs:', error);
    }
};


module.exports = deepResearchJob;
