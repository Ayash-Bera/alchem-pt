import React, { useState, useEffect } from 'react';
import ResearchForm from '../components/JobForm/ResearchForm';
import ProgressDisplay from '../components/JobForm/ProgressDisplay';
import ResultsDisplay from '../components/JobForm/ResultsDisplay';
import { jobsAPI } from '../services/api';
import socketService from '../services/socket';

const Research = () => {
    const [currentJob, setCurrentJob] = useState(null);
    const [jobResult, setJobResult] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
            <div className="container mx-auto px-6 py-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Deep Research Agent
                        </h1>
                        <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                            Create comprehensive research reports using AI-powered analysis
                        </p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Left Column: Form and Progress */}
                        <div className="space-y-8">
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

                        {/* Right Column: Results */}
                        <div className="min-h-[600px]">
                            {isJobCompleted ? (
                                <ResultsDisplay
                                    job={currentJob}
                                    result={jobResult}
                                />
                            ) : (
                                <div className="glass h-full flex items-center justify-center p-12">
                                    <div className="text-center text-gray-400 max-w-md">
                                        <div className="w-20 h-20 mx-auto mb-6 rounded-full glass-strong flex items-center justify-center">
                                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-medium mb-3 text-white">
                                            {currentJob ? 'Research in Progress' : 'Ready to Research'}
                                        </h3>
                                        <p className="text-gray-400">
                                            {currentJob
                                                ? 'Your research results will appear here when complete'
                                                : 'Submit a research topic to get started'
                                            }
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Connection Status */}
                    <div className="fixed bottom-6 right-6">
                        <div className={`flex items-center space-x-3 px-4 py-3 rounded-xl glass ${isConnected ? 'border-green-500/30' : 'border-red-500/30'
                            }`}>
                            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                                } ${isConnected ? 'animate-pulse' : ''}`} />
                            <span className="text-sm font-medium">
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Research;