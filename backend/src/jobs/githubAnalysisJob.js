const axios = require('axios');
const alchemystService = require('../services/alchemystService');
const logger = require('../utils/logger');
const { getPool } = require('../config/database');

const githubAnalysisJob = async (job) => {
    const { repository, analysisType, options, requestId } = job.attrs.data;
    const jobId = job.attrs._id;

    logger.info(`Starting GitHub analysis job for repository: ${repository}`, { jobId });

    try {
        // Update job progress
        job.progress(10);
        await job.save();

        // Step 1: Fetch repository information
        const repoInfo = await fetchRepositoryInfo(repository);
        job.progress(25);
        await job.save();

        // Step 2: Analyze repository structure
        const structureAnalysis = await analyzeRepositoryStructure(repoInfo);
        job.progress(50);
        await job.save();

        // Step 3: Perform code analysis using Alchemyst
        const codeAnalysis = await performCodeAnalysis(repoInfo, structureAnalysis, analysisType);
        job.progress(75);
        await job.save();

        // Step 4: Generate comprehensive report
        const report = await generateAnalysisReport(repoInfo, structureAnalysis, codeAnalysis);
        job.progress(90);
        await job.save();

        // Step 5: Store results and update metrics
        const result = {
            repository,
            analysisType,
            report,
            metadata: {
                processedAt: new Date(),
                requestId,
                analysisVersion: '1.0'
            }
        };

        job.progress(100);
        await job.save();

        // Update cost metrics
        await updateJobCosts(jobId, codeAnalysis.costs);

        logger.info(`GitHub analysis completed for repository: ${repository}`, { jobId });
        return result;

    } catch (error) {
        logger.error(`GitHub analysis failed for repository: ${repository}`, {
            jobId,
            error: error.message
        });

        // Update error metrics
        await updateJobCosts(jobId, null, error.message);
        throw error;
    }
};

const fetchRepositoryInfo = async (repository) => {
    try {
        // Extract owner and repo name from URL
        const match = repository.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!match) {
            throw new Error('Invalid GitHub repository URL');
        }

        const [, owner, repo] = match;
        const cleanRepo = repo.replace('.git', '');

        // Fetch repository information from GitHub API
        const repoResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${cleanRepo}`,
            {
                headers: {
                    'User-Agent': 'Alchemyst-Platform',
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        // Fetch repository contents
        const contentsResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${cleanRepo}/contents`,
            {
                headers: {
                    'User-Agent': 'Alchemyst-Platform',
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        // Fetch recent commits
        const commitsResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${cleanRepo}/commits?per_page=10`,
            {
                headers: {
                    'User-Agent': 'Alchemyst-Platform',
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );

        return {
            repository: repoResponse.data,
            contents: contentsResponse.data,
            recentCommits: commitsResponse.data,
            owner,
            name: cleanRepo
        };
    } catch (error) {
        if (error.response?.status === 404) {
            throw new Error('Repository not found or is private');
        }
        if (error.response?.status === 403) {
            throw new Error('GitHub API rate limit exceeded');
        }
        throw new Error(`Failed to fetch repository info: ${error.message}`);
    }
};

const analyzeRepositoryStructure = async (repoInfo) => {
    const { repository, contents } = repoInfo;

    const analysis = {
        languages: repository.language ? [repository.language] : [],
        fileTypes: {},
        projectStructure: {},
        frameworks: [],
        buildTools: [],
        metrics: {
            totalFiles: contents.length,
            totalSize: repository.size,
            starCount: repository.stargazers_count,
            forkCount: repository.forks_count,
            lastUpdate: repository.updated_at
        }
    };

    // Analyze file structure
    contents.forEach(item => {
        if (item.type === 'file') {
            const extension = item.name.split('.').pop();
            analysis.fileTypes[extension] = (analysis.fileTypes[extension] || 0) + 1;

            // Detect frameworks and build tools
            if (item.name === 'package.json') analysis.frameworks.push('Node.js');
            if (item.name === 'requirements.txt') analysis.frameworks.push('Python');
            if (item.name === 'Gemfile') analysis.frameworks.push('Ruby');
            if (item.name === 'pom.xml') analysis.frameworks.push('Maven/Java');
            if (item.name === 'Dockerfile') analysis.buildTools.push('Docker');
            if (item.name === 'docker-compose.yml') analysis.buildTools.push('Docker Compose');
            if (item.name === 'Makefile') analysis.buildTools.push('Make');
        }
    });

    return analysis;
};

const performCodeAnalysis = async (repoInfo, structureAnalysis, analysisType) => {
    try {
        const { repository, recentCommits } = repoInfo;

        // Prepare analysis prompt based on type
        let analysisPrompt = '';
        let estimatedCost = 0;

        switch (analysisType) {
            case 'security':
                analysisPrompt = createSecurityAnalysisPrompt(repository, structureAnalysis);
                estimatedCost = 0.15;
                break;
            case 'performance':
                analysisPrompt = createPerformanceAnalysisPrompt(repository, structureAnalysis);
                estimatedCost = 0.12;
                break;
            case 'architecture':
                analysisPrompt = createArchitectureAnalysisPrompt(repository, structureAnalysis);
                estimatedCost = 0.20;
                break;
            default: // 'full'
                analysisPrompt = createFullAnalysisPrompt(repository, structureAnalysis, recentCommits);
                estimatedCost = 0.25;
        }

        // Call Alchemyst API for analysis
        const analysis = await alchemystService.generateAnalysis(analysisPrompt, {
            maxTokens: 2000,
            temperature: 0.3
        });

        return {
            type: analysisType,
            analysis: analysis.content,
            costs: {
                estimated: estimatedCost,
                actual: analysis.cost || estimatedCost,
                tokens: analysis.tokens || 0
            }
        };
    } catch (error) {
        logger.error('Code analysis failed:', error);
        throw new Error(`Code analysis failed: ${error.message}`);
    }
};

const createFullAnalysisPrompt = (repository, structureAnalysis, recentCommits) => {
    return `
Perform a comprehensive analysis of this GitHub repository:

Repository: ${repository.name}
Description: ${repository.description || 'No description provided'}
Language: ${repository.language || 'Not specified'}
Stars: ${repository.stargazers_count}
Forks: ${repository.forks_count}

File Structure:
${JSON.stringify(structureAnalysis.fileTypes, null, 2)}

Detected Frameworks: ${structureAnalysis.frameworks.join(', ') || 'None detected'}
Build Tools: ${structureAnalysis.buildTools.join(', ') || 'None detected'}

Recent Commits (last 5):
${recentCommits.slice(0, 5).map(commit =>
        `- ${commit.commit.message} (${commit.commit.author.date})`
    ).join('\n')}

Please provide a comprehensive analysis including:
1. Code quality assessment
2. Architecture overview
3. Security considerations
4. Performance implications
5. Maintenance recommendations
6. Technology stack evaluation
7. Best practices adherence

Keep the analysis practical and actionable.
`;
};

const createSecurityAnalysisPrompt = (repository, structureAnalysis) => {
    return `
Perform a security-focused analysis of this repository:

Repository: ${repository.name}
Language: ${repository.language}
File Types: ${JSON.stringify(structureAnalysis.fileTypes)}
Frameworks: ${structureAnalysis.frameworks.join(', ')}

Focus on:
1. Dependency vulnerabilities
2. Authentication and authorization patterns
3. Input validation practices
4. Data exposure risks
5. Configuration security
6. API security considerations
7. Recommended security improvements

Provide specific, actionable security recommendations.
`;
};

const createPerformanceAnalysisPrompt = (repository, structureAnalysis) => {
    return `
Analyze the performance characteristics of this repository:

Repository: ${repository.name}
Language: ${repository.language}
Size: ${structureAnalysis.metrics.totalSize} KB
File Structure: ${JSON.stringify(structureAnalysis.fileTypes)}

Evaluate:
1. Code efficiency patterns
2. Database optimization opportunities
3. Caching strategies
4. Resource utilization
5. Scalability considerations
6. Performance bottlenecks
7. Optimization recommendations

Provide specific performance improvement suggestions.
`;
};

const createArchitectureAnalysisPrompt = (repository, structureAnalysis) => {
    return `
Analyze the software architecture of this repository:

Repository: ${repository.name}
Language: ${repository.language}
Frameworks: ${structureAnalysis.frameworks.join(', ')}
File Organization: ${JSON.stringify(structureAnalysis.fileTypes)}

Examine:
1. Overall architecture pattern
2. Component organization
3. Separation of concerns
4. Design pattern usage
5. Modularity and coupling
6. Extensibility considerations
7. Architecture improvement recommendations

Focus on architectural quality and maintainability.
`;
};

const generateAnalysisReport = async (repoInfo, structureAnalysis, codeAnalysis) => {
    const { repository } = repoInfo;

    return {
        summary: {
            repository: repository.name,
            owner: repository.owner.login,
            description: repository.description,
            analysisType: codeAnalysis.type,
            completedAt: new Date()
        },
        repository: {
            url: repository.html_url,
            language: repository.language,
            size: repository.size,
            stars: repository.stargazers_count,
            forks: repository.forks_count,
            openIssues: repository.open_issues_count,
            lastUpdated: repository.updated_at,
            license: repository.license?.name
        },
        structure: structureAnalysis,
        analysis: codeAnalysis.analysis,
        recommendations: extractRecommendations(codeAnalysis.analysis),
        metrics: {
            analysisScore: calculateAnalysisScore(structureAnalysis, codeAnalysis),
            complexity: assessComplexity(structureAnalysis),
            maintainability: assessMaintainability(repository, structureAnalysis)
        }
    };
};

const extractRecommendations = (analysisText) => {
    // Simple extraction of recommendations from analysis text
    const lines = analysisText.split('\n');
    const recommendations = [];

    lines.forEach(line => {
        if (line.includes('recommend') || line.includes('should') || line.includes('consider')) {
            recommendations.push(line.trim());
        }
    });

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
};

const calculateAnalysisScore = (structureAnalysis, codeAnalysis) => {
    // Simple scoring algorithm based on various factors
    let score = 50; // Base score

    // Bonus for good structure
    if (structureAnalysis.buildTools.length > 0) score += 10;
    if (structureAnalysis.frameworks.length > 0) score += 10;

    // Bonus for repository activity
    if (structureAnalysis.metrics.starCount > 10) score += 5;
    if (structureAnalysis.metrics.forkCount > 5) score += 5;

    // Analysis quality bonus
    if (codeAnalysis.analysis.length > 500) score += 10;

    return Math.min(score, 100);
};

const assessComplexity = (structureAnalysis) => {
    const fileCount = structureAnalysis.metrics.totalFiles;
    const typeCount = Object.keys(structureAnalysis.fileTypes).length;

    if (fileCount > 100 || typeCount > 10) return 'High';
    if (fileCount > 50 || typeCount > 5) return 'Medium';
    return 'Low';
};

const assessMaintainability = (repository, structureAnalysis) => {
    let score = 0;

    if (repository.description) score += 1;
    if (repository.license) score += 1;
    if (structureAnalysis.buildTools.length > 0) score += 1;
    if (repository.open_issues_count < 10) score += 1;

    if (score >= 3) return 'High';
    if (score >= 2) return 'Medium';
    return 'Low';
};

const updateJobCosts = async (jobId, costs, errorMessage = null) => {
    try {
        const pool = getPool();

        if (costs) {
            await pool.query(
                `UPDATE job_metrics 
                 SET cost_usd = $1, tokens_used = $2, api_calls = api_calls + 1 
                 WHERE job_id = $3`,
                [costs.actual, costs.tokens, jobId]
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

module.exports = githubAnalysisJob;