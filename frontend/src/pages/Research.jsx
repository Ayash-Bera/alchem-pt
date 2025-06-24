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
    CheckCircle,
    Clock,
    ArrowRight,
    Cpu,
    TrendingUp
} from 'lucide-react';

const Research = () => {
    const [currentJob, setCurrentJob] = useState(null);
    const [jobResult, setJobResult] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const socket = socketService.connect();

        socket.on('connect', () => {
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

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
        setLogs(prev => [...prev, log].slice(-10));
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

    const stats = [
        { label: "Multi-Step Analysis", value: "8+", icon: Brain },
        { label: "Average Duration", value: "30m", icon: Clock },
        { label: "User satisfaction", value: "105%", icon: CheckCircle }
    ];

    return (
        <div className="min-h-screen">
            <div className="container mx-auto px-6 py-16 relative z-10">
                <div className="max-w-7xl mx-auto">

                    {/* Minimal Header */}
                    <div className="text-center mb-20">
                        <div className="flex items-center justify-center mb-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                        </div>

                        <h1 className="text-6xl font-black mb-6 leading-tight">
                            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Deep Research
                            </span>
                            <br />
                            <span className="text-white">Agent</span>
                        </h1>

                        <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-12">
                            AI-powered research with multi-step analysis and intelligent insights
                        </p>

                        {/* Minimal Stats */}
                        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
                            {stats.map((stat, index) => (
                                <div key={index} className="minimal-card p-4 rounded-2xl text-center">
                                    <stat.icon className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                                    <div className="text-xl font-bold text-white">{stat.value}</div>
                                    <div className="text-xs text-gray-400">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* Form Column */}
                        <div className="lg:col-span-5 space-y-8">
                            <ResearchForm
                                onSubmit={handleSubmitJob}
                                isRunning={isJobRunning}
                                onCancel={handleCancelJob}
                                currentJobId={currentJob?.id}
                            />

                            {currentJob && (
                                <ProgressDisplay
                                    job={currentJob}
                                    logs={logs}
                                />
                            )}
                        </div>

                        {/* Results Column */}
                        <div className="lg:col-span-7">
                            <div className="h-full min-h-[600px]">
                                {isJobCompleted ? (
                                    <ResultsDisplay
                                        job={currentJob}
                                        result={jobResult}
                                    />
                                ) : (
                                    <div className="minimal-card h-full flex flex-col items-center justify-center p-16 text-center rounded-3xl">
                                        <div className="w-32 h-32 rounded-3xl minimal-card flex items-center justify-center mb-8 relative overflow-hidden">
                                            {isJobRunning ? (
                                                <div className="relative">
                                                    <Cpu className="w-16 h-16 text-blue-400 animate-pulse" />
                                                    <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full animate-spin"></div>
                                                </div>
                                            ) : (
                                                <Brain className="w-16 h-16 text-gray-300" />
                                            )}
                                        </div>

                                        <h3 className="text-3xl font-bold text-white mb-4">
                                            {currentJob ? (
                                                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                                    Research in Progress
                                                </span>
                                            ) : (
                                                <span>Ready to Research</span>
                                            )}
                                        </h3>

                                        <p className="text-lg text-gray-400 leading-relaxed max-w-md">
                                            {currentJob
                                                ? 'Your research results will appear here when analysis is complete'
                                                : 'Submit a research topic to begin AI-powered analysis'
                                            }
                                        </p>

                                        {isJobRunning && (
                                            <div className="mt-8 space-y-4">
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                                                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                                </div>

                                                <div className="minimal-card px-4 py-2 rounded-xl inline-block">
                                                    <div className="flex items-center space-x-2">
                                                        <TrendingUp className="w-4 h-4 text-green-400" />
                                                        <p className="text-sm text-gray-300">
                                                            AI analysis in progress...
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {!currentJob && (
                                            <div className="mt-8">
                                                <div className="flex items-center justify-center space-x-2 text-blue-400 cursor-pointer">
                                                    <span className="text-sm font-medium">Start your research</span>
                                                    <ArrowRight className="w-4 h-4" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Connection Status */}
            <div className="fixed bottom-8 right-8 z-50">
                <div className={`flex items-center space-x-3 px-4 py-3 rounded-2xl minimal-card shadow-xl transition-all duration-300 ${
                    isConnected ? 'border-green-500/30' : 'border-red-500/30'
                }`}>
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        {isConnected && (
                            <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75" />
                        )}
                    </div>
                    <div>
                        <div className="text-sm font-medium text-white">
                            {isConnected ? 'Live Updates' : 'Reconnecting...'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Research; 
