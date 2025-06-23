const alchemystService = require('../services/alchemystService');
const logger = require('../utils/logger');
const { getDatabase } = require('../config/database');

const deepResearchJob = async (job) => {
    const { topic, researchDepth, sources, deliverables, options, requestId } = job.attrs.data;
    const jobId = job.attrs._id;

    logger.info(`Starting deep research job for topic: ${topic}`, { jobId, researchDepth });

    try {
	job.attrs.progress = 5;
        await job.save();

        // Step 1: Create intelligent research plan
        logger.info('Creating research plan...', { jobId });
        const researchPlan = await createResearchPlan(topic, researchDepth, sources || [], deliverables || ['summary']);
        logger.info('Research plan created successfully', { jobId, stepCount: researchPlan.steps?.length });

	job.attrs.progress = 25;
        await job.save();

        // Step 2: Execute with our new intelligent system
        logger.info('Executing research plan...', { jobId });
        const researchResults = await executeResearchPlan(researchPlan, job);
        logger.info('Research execution completed', { jobId, resultCount: researchResults.length });

	job.attrs.progress = 70;
        await job.save();

        // Continue with synthesis...
        logger.info('Synthesizing findings...', { jobId });
        const synthesis = await synthesizeFindings(researchResults, deliverables || ['summary']);

	job.attrs.progress = 85;
        await job.save();

        logger.info('Generating final deliverables...', { jobId });
        const finalReport = await generateResearchDeliverables(topic, researchResults, synthesis, deliverables || ['summary']);

	job.attrs.progress = 95;
        await job.save();

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
        await job.save();

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
    return `
Create an EFFICIENT and COST-EFFECTIVE research plan for: ${topic}

CONSTRAINTS:
- Complexity Level: ${complexity.level}
- Research Depth: ${depth}
- Token Budget: LIMITED (optimize for quality vs cost)
- Deliverables: ${deliverables.join(', ')}

OPTIMIZATION REQUIREMENTS:
1. Minimize redundant research steps
2. Maximize information gathering per API call
3. Identify steps that can run in parallel
4. Focus on high-impact, low-cost research methods
5. Create ${complexity.level === 'low' ? '3-4' : complexity.level === 'medium' ? '5-6' : '6-8'} focused steps

For each step, specify:
- Step name and objective
- Expected information yield
- Parallelization potential (Yes/No)
- Token efficiency rating (High/Medium/Low)

Create a lean, efficient research methodology that maximizes insight per dollar spent.
`;
};


const parseResearchSteps = (planContent, depth, tokenBudget) => {
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

            // Extract efficiency indicators from the plan
            const isHighEfficiency = line.toLowerCase().includes('high') && line.toLowerCase().includes('efficiency');
            const canParallelize = line.toLowerCase().includes('parallel') || line.toLowerCase().includes('concurrent');

            currentStep = {
                number: steps.length + 1,
                name: line.replace(stepMatch, '').trim(),
                description: '',
                expectedOutput: '',
                estimatedTokens: calculateStepTokenAllocation(tokenBudget, depth, steps.length + 1),
                efficiency: isHighEfficiency ? 'high' : 'medium',
                parallelizable: canParallelize
            };
        } else if (currentStep && line.trim()) {
            currentStep.description += line.trim() + ' ';
        }
    });

    if (currentStep) {
        steps.push(currentStep);
    }

    // Ensure optimal step count for cost efficiency
    const optimalStepCount = depth === 'shallow' ? 4 : depth === 'medium' ? 6 : 8;

    while (steps.length < optimalStepCount) {
        steps.push(generateDefaultStep(steps.length + 1, depth, tokenBudget));
    }

    return steps.slice(0, optimalStepCount); // Cap at optimal count
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
    let accumulatedContext = { topic: plan.topic, methodology: plan.methodology };

    logger.info(`Starting intelligent execution of ${totalSteps} steps`, {
        jobId: job.attrs._id,
        parallelCapable: plan.parallelExecution,
        estimatedCost: plan.costEstimate.totalEstimatedCost
    });

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
            job.attrs.progress=(Math.min(currentProgress, 70));
            await job.save();

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

    const startTime = Date.now();

    // Create promises for parallel execution
    const stepPromises = steps.map(async (step) => {
        try {
            // Build step-specific context (lighter for parallel execution)
            const stepContext = buildOptimizedStepContext(context, step, plan);

            // Create cost-optimized prompt
            const stepPrompt = createCostOptimizedStepPrompt(step, stepContext);

            // Execute with cost monitoring
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
                executionTime: Date.now() - startTime,
                executionType: 'parallel',
                quality: await assessStepQuality(stepResult.content),
                completedAt: new Date()
            };

        } catch (error) {
            logger.error(`Parallel step ${step.number} failed:`, error);
            throw new Error(`Parallel step ${step.number} failed: ${error.message}`);
        }
    });

    // Execute all parallel steps with timeout protection
    const results = await Promise.allSettled(stepPromises);

    // Process results and handle any failures
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

    // If we have failures, attempt smart recovery
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
            // Build enhanced context from previous steps
            const stepContext = buildEnhancedStepContext(currentContext, results, step, plan);

            // Create adaptive prompt based on previous findings
            const stepPrompt = createAdaptiveStepPrompt(step, stepContext, results);

            // Dynamic token allocation based on context richness
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
                executionType: 'sequential',
                contextRichness: calculateContextRichness(stepContext),
                quality: await assessStepQuality(stepResult.content),
                completedAt: new Date()
            };

            // Validate step quality and retry if needed
            if (processedResult.quality.score < 0.6) {
                logger.warn(`Step ${step.number} quality below threshold, retrying with enhanced prompt`, { jobId });
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

            // Update context for next step
            currentContext = await updateStepContext(currentContext, processedResult, plan);

        } catch (error) {
            logger.error(`Sequential step ${step.number} failed:`, error);

            // Attempt graceful degradation
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
const generateExecutionSummary = async (results, plan) => {
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

// Stub functions for features we'll implement later
const shouldReplanBasedOnFindings = (results, plan) => false; // Disable for testing
const adaptRemainingSteps = async (groups, context, plan) => groups; // Return unchanged
const handleExecutionError = async (error, group, context, plan) => ({ canContinue: false });
const recoverFailedParallelSteps = async (failed, successful, context, plan) => [];
const retryStepWithEnhancement = async (step, context, result) => null;
const generateFallbackStepResult = async (step, context, error) => null;
const assessContentCoherence = async (content, context) => 0.8;
const detectNewConflicts = async (results, context) => [];
const calculateQualityTrend = (results) => 'stable';
const updateStepContext = async (context, result, plan) => context;

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
        const db = getDatabase();
        const jobMetrics = db.collection('job_metrics');

        if (costs) {
            const totalTokens = costs.research + costs.synthesis + costs.deliverables;
            await jobMetrics.updateOne(
                { job_id: jobId },
                {
                    $set: {
                        cost_usd: costs.total,
                        tokens_used: totalTokens,
                        updated_at: new Date()
                    },
                    $inc: {
                        api_calls: 5
                    }
                }
            );
        }

        if (errorMessage) {
            await jobMetrics.updateOne(
                { job_id: jobId },
                {
                    $set: {
                        error_message: errorMessage,
                        updated_at: new Date()
                    }
                }
            );
        }
    } catch (error) {
        logger.error('Error updating job costs:', error);
    }
};

module.exports = deepResearchJob;
