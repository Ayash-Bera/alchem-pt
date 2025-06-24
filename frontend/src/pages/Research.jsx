import React, { useState, useEffect } from 'react';
import ResearchForm from '../components/JobForm/ResearchForm';
import ProgressDisplay from '../components/JobForm/ProgressDisplay';
import ResultsDisplay from '../components/JobForm/ResultsDisplay';
import { jobsAPI } from '../services/api';
import socketService from '../services/socket';
import {
    Sparkles,
    Brain,
    Zap,
    Database,
    TrendingUp,
    Shield,
    Cpu,
    Globe,
    ArrowRight,
    Star,
    CheckCircle,
    Clock,
    BarChart3
} from 'lucide-react';

const Research = () => {
    const [currentJob, setCurrentJob] = useState(null);
    const [jobResult, setJobResult] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Mouse tracking for interactive effects
    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        // Initialize socket connection
        const socket = socketService.connect();

        socket.on('connect', () => {
            setIsConnected(true);
            console.log('Socket connected');
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('Socket disconnected');
        });

        // Job event listeners
        socket.on('job_created', (data) => {
            addLog(`Job created: ${data.type}`, 'info');
        });

        socket.on('job_progress', (data) => {
            if (currentJob && data.jobId === currentJob.id) {
                setCurrentJob(prev => ({
                    ...prev,
                    progress: data.progress,
                    status: data.status
                }));
                addLog(`Progress: ${data.progress}% - ${data.status}`, 'progress');
            }
        });

        socket.on('job_completed', (data) => {
            if (currentJob && data.jobId === currentJob.id) {
                addLog('Research completed successfully!', 'success');
                fetchJobResult(data.jobId);
                setCurrentJob(prev => ({
                    ...prev,
                    status: 'completed',
                    progress: 100
                }));
            }
        });

        socket.on('job_failed', (data) => {
            if (currentJob && data.jobId === currentJob.id) {
                addLog(`Job failed: ${data.error}`, 'error');
                setCurrentJob(prev => ({
                    ...prev,
                    status: 'failed'
                }));
            }
        });

        return () => {
            socketService.disconnect();
        };
    }, [currentJob]);

    const addLog = (message, type = 'info') => {
        const log = {
            message,
            type,
            timestamp: new Date().toISOString()
        };
        setLogs(prev => [...prev, log].slice(-10)); // Keep last 10 logs
    };

    const handleSubmitJob = async (jobData) => {
        try {
            addLog('Creating research job...', 'info');
            const response = await jobsAPI.createJob(jobData);

            if (response.data.success) {
                const job = response.data.job;
                setCurrentJob(job);
                setJobResult(null);
                setLogs([]);
                addLog(`Research started: ${jobData.data.topic}`, 'info');

                // Subscribe to job updates
                const socket = socketService.getSocket();
                if (socket) {
                    socket.emit('subscribe_job_updates', job.id);
                }
            }
        } catch (error) {
            console.error('Error creating job:', error);
            addLog(`Error: ${error.response?.data?.error || error.message}`, 'error');
        }
    };

    const handleCancelJob = async (jobId) => {
        try {
            await jobsAPI.cancelJob(jobId);
            setCurrentJob(null);
            addLog('Research cancelled', 'warning');

            // Unsubscribe from job updates
            const socket = socketService.getSocket();
            if (socket) {
                socket.emit('unsubscribe_job_updates', jobId);
            }
        } catch (error) {
            console.error('Error cancelling job:', error);
            addLog(`Cancel error: ${error.response?.data?.error || error.message}`, 'error');
        }
    };

    const fetchJobResult = async (jobId) => {
        try {
            const response = await jobsAPI.getJob(jobId);
            if (response.data.success && response.data.job.result) {
                setJobResult(response.data.job.result);
            }
        } catch (error) {
            console.error('Error fetching job result:', error);
        }
    };

    const isJobRunning = currentJob && ['running', 'scheduled'].includes(currentJob.status);
    const isJobCompleted = currentJob && currentJob.status === 'completed' && jobResult;

    const features = [
        {
            icon: Brain,
            title: "AI-Powered Analysis",
            description: "Advanced multi-step reasoning",
            color: "from-blue-400 to-cyan-400"
        },
        {
            icon: Zap,
            title: "Lightning Fast",
            description: "Rapid processing and insights",
            color: "from-yellow-400 to-orange-400"
        },
        {
            icon: Database,
            title: "Comprehensive Data",
            description: "Multiple sources and perspectives",
            color: "from-green-400 to-emerald-400"
        },
        {
            icon: Shield,
            title: "Reliable Results",
            description: "Validated and cross-checked",
            color: "from-purple-400 to-pink-400"
        }
    ];

    const stats = [
        { label: "Research Steps", value: "8+", icon: BarChart3 },
        { label: "Data Sources", value: "50+", icon: Globe },
        { label: "Avg. Time", value: "30m", icon: Clock },
        { label: "Accuracy", value: "95%", icon: CheckCircle }
    ];

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Dynamic background with mouse interaction */}
            <div
                className="fixed inset-0 opacity-30 pointer-events-none"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.1), transparent 40%)`
                }}
            />

            {/* Animated background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-2000" />
            </div>

            {/* Main Content Container */}
            <div className="container mx-auto px-6 py-16 relative z-10">
                <div className="max-w-7xl mx-auto">

                    {/* Spectacular Header */}
                    <div className="text-center mb-20 relative">
                        {/* Glowing background text */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <h1 className="text-8xl font-black bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 bg-clip-text text-transparent blur-sm select-none">
                                RESEARCH
                            </h1>
                        </div>

                        {/* Main title */}
                        <div className="relative z-10">
                            <div className="flex items-center justify-center mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/25 animate-pulse">
                                    <Sparkles className="w-8 h-8 text-white" />
                                </div>
                            </div>

                            <h1 className="text-7xl font-black mb-8 leading-tight">
                                <span className="text-white">
                                    Deep Research
                                </span>
                                <br />
                                <span className="text-white">Agent</span>
                            </h1>

                            <p className="text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed mb-12">
                                Harness the power of AI to create
                                <span className="text-blue-400 font-semibold"> comprehensive research reports </span>
                                with real-time multi-step analysis and intelligent insights
                            </p>

                            {/* Feature highlights */}
                            <div className="flex items-center justify-center space-x-8 mb-8">
                                {features.map((feature, index) => (
                                    <div key={index} className="flex items-center space-x-3 group">
                                        <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                            <feature.icon className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-semibold text-white">{feature.title}</div>
                                            <div className="text-xs text-gray-400">{feature.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-6 max-w-2xl mx-auto">
                                {stats.map((stat, index) => (
                                    <div key={index} className="glass-strong p-4 rounded-2xl text-center group hover:scale-105 transition-transform">
                                        <stat.icon className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                                        <div className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">{stat.value}</div>
                                        <div className="text-xs text-gray-400">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* Left Column: Form and Progress */}
                        <div className="lg:col-span-5 space-y-8">
                            {/* Research Form */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                                <div className="relative">
                                    <ResearchForm
                                        onSubmit={handleSubmitJob}
                                        isRunning={isJobRunning}
                                        onCancel={handleCancelJob}
                                        currentJobId={currentJob?.id}
                                    />
                                </div>
                            </div>

                            {/* Progress Display - Only show when job exists */}
                            {currentJob && (
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                                    <div className="relative">
                                        <ProgressDisplay
                                            job={currentJob}
                                            logs={logs}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Results Area */}
                        <div className="lg:col-span-7">
                            <div className="h-full min-h-[800px] relative">
                                {isJobCompleted ? (
                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                                        <div className="relative">
                                            <ResultsDisplay
                                                job={currentJob}
                                                result={jobResult}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="glass h-full flex flex-col items-center justify-center p-16 text-center relative overflow-hidden rounded-3xl">
                                        {/* Dynamic background patterns */}
                                        <div className="absolute inset-0">
                                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5"></div>
                                            <div className="absolute top-8 right-8 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl animate-pulse"></div>
                                            <div className="absolute bottom-8 left-8 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl animate-pulse delay-1000"></div>
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
                                        </div>

                                        <div className="relative max-w-lg z-10">
                                            {/* Enhanced Icon Container */}
                                            <div className="relative mb-12">
                                                <div className="w-40 h-40 mx-auto rounded-3xl glass-strong flex items-center justify-center relative overflow-hidden group">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 group-hover:from-blue-500/30 group-hover:via-purple-500/30 group-hover:to-pink-500/30 transition-all duration-500"></div>

                                                    {isJobRunning ? (
                                                        <div className="relative z-10 flex items-center justify-center">
                                                            <Cpu className="w-20 h-20 text-blue-400 animate-pulse" />
                                                            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full animate-spin"></div>
                                                        </div>
                                                    ) : (
                                                        <div className="relative z-10">
                                                            <Brain className="w-20 h-20 text-gray-300 group-hover:text-blue-400 transition-colors" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Floating particles */}
                                                <div className="absolute inset-0 pointer-events-none">
                                                    <Star className="absolute top-4 right-8 w-4 h-4 text-yellow-400 animate-pulse" />
                                                    <Sparkles className="absolute bottom-8 left-4 w-3 h-3 text-blue-400 animate-bounce" />
                                                    <Zap className="absolute top-12 left-12 w-3 h-3 text-purple-400 animate-pulse delay-500" />
                                                </div>
                                            </div>

                                            {/* Enhanced Status Text */}
                                            <div className="space-y-6">
                                                <h3 className="text-4xl font-black text-white mb-4">
                                                    {currentJob ? (
                                                        <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                                            Research in Progress
                                                        </span>
                                                    ) : (
                                                        <span>Ready to Research</span>
                                                    )}
                                                </h3>

                                                <p className="text-xl text-gray-400 leading-relaxed">
                                                    {currentJob
                                                        ? 'Your comprehensive research results will appear here when the AI analysis is complete'
                                                        : 'Submit a research topic to begin your AI-powered deep analysis with real-time progress tracking'
                                                    }
                                                </p>

                                                {/* Enhanced Progress indicator for running jobs */}
                                                {isJobRunning && (
                                                    <div className="space-y-6">
                                                        <div className="flex items-center justify-center space-x-3">
                                                            <div className="w-4 h-4 bg-blue-400 rounded-full animate-bounce"></div>
                                                            <div className="w-4 h-4 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                            <div className="w-4 h-4 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                                        </div>

                                                        <div className="glass-strong px-6 py-3 rounded-2xl inline-block">
                                                            <div className="flex items-center space-x-3">
                                                                <TrendingUp className="w-5 h-5 text-green-400 animate-pulse" />
                                                                <p className="text-sm text-gray-300 font-medium">
                                                                    AI agents are analyzing your request...
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Progress steps visualization */}
                                                        <div className="space-y-3">
                                                            <div className="text-sm text-gray-500">Processing Steps:</div>
                                                            <div className="flex items-center justify-between max-w-md mx-auto">
                                                                {['Research', 'Analyze', 'Synthesize', 'Report'].map((step, index) => (
                                                                    <div key={index} className="flex flex-col items-center space-y-2">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${(currentJob?.progress || 0) > (index * 25)
                                                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                                                                            : 'bg-gray-700 text-gray-400'
                                                                            }`}>
                                                                            {index + 1}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400">{step}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Call to action for empty state */}
                                                {!currentJob && (
                                                    <div className="pt-8">
                                                        <div className="flex items-center justify-center space-x-2 text-blue-400 group cursor-pointer">
                                                            <span className="text-sm font-medium">Start your research journey</span>
                                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Enhanced Connection Status Indicator */}
            <div className="fixed bottom-8 right-8 z-50">
                <div className={`flex items-center space-x-4 px-6 py-4 rounded-2xl glass shadow-2xl border transition-all duration-300 ${isConnected
                    ? 'border-green-500/30 shadow-green-500/10'
                    : 'border-red-500/30 shadow-red-500/10'
                    }`}>
                    <div className="relative">
                        <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                        {isConnected && (
                            <div className="absolute inset-0 w-4 h-4 bg-green-500 rounded-full animate-ping opacity-75" />
                        )}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-white">
                            {isConnected ? 'Live Connection' : 'Reconnecting...'}
                        </div>
                        <div className="text-xs text-gray-400">
                            {isConnected ? 'Real-time updates active' : 'Please wait...'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating help tooltip */}
            <div className="fixed bottom-8 left-8 z-50">
                <div className="glass px-4 py-3 rounded-2xl shadow-xl border border-white/10 max-w-xs">
                    <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white mb-1">Pro Tip</div>
                            <div className="text-xs text-gray-400 leading-relaxed">
                                Be specific with your research topic for better, more targeted results
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Research;