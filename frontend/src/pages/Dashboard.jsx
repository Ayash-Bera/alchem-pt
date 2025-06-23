import React, { useState, useEffect } from 'react';
import MetricsCards from '../components/Dashboard/MetricsCards';
import JobHistory from '../components/Dashboard/JobHistory';
import LiveMetrics from '../components/Dashboard/LiveMetrics';
import { jobsAPI, metricsAPI } from '../services/api';
import socketService from '../services/socket';

const Dashboard = () => {
    const [jobs, setJobs] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [liveData, setLiveData] = useState({});
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
        setupSocketConnection();

        // Refresh data every 30 seconds
        const interval = setInterval(loadDashboardData, 30000);

        return () => {
            clearInterval(interval);
            socketService.disconnect();
        };
    }, []);

    const setupSocketConnection = () => {
        const socket = socketService.connect();

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('subscribe_metrics');
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('metrics_update', (data) => {
            setLiveData(prev => ({ ...prev, ...data }));
        });

        socket.on('job_created', () => {
            loadJobs();
        });

        socket.on('job_completed', () => {
            loadJobs();
            loadMetrics();
        });

        socket.on('job_failed', () => {
            loadJobs();
        });

        socket.on('system_status', (data) => {
            setLiveData(prev => ({ ...prev, ...data }));
        });
    };

    const loadDashboardData = async () => {
        try {
            await Promise.all([
                loadJobs(),
                loadMetrics()
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadJobs = async () => {
        try {
            const response = await jobsAPI.getJobs();
            if (response.data.success) {
                setJobs(response.data.jobs);
            }
        } catch (error) {
            console.error('Error loading jobs:', error);
        }
    };

    const loadMetrics = async () => {
        try {
            const [costResponse, performanceResponse] = await Promise.all([
                metricsAPI.getCostMetrics(),
                metricsAPI.getPerformanceMetrics()
            ]);

            const costData = costResponse.data.success ? costResponse.data.metrics : {};
            const perfData = performanceResponse.data.success ? performanceResponse.data.metrics : {};

            // Calculate summary metrics
            const totalJobs = jobs.length;
            const runningJobs = jobs.filter(job => job.status === 'running').length;
            const completedJobs = jobs.filter(job => job.status === 'completed').length;
            const failedJobs = jobs.filter(job => job.status === 'failed').length;

            const summaryMetrics = {
                totalJobs,
                runningJobs,
                completedJobs,
                failedJobs,
                totalCost: costData.totalCost || 0,
                avgDuration: perfData.avgDuration || 0,
                totalTokens: costData.totalTokens || 0,
                costPerToken: costData.totalCost && costData.totalTokens
                    ? costData.totalCost / costData.totalTokens
                    : 0
            };

            setMetrics(summaryMetrics);
        } catch (error) {
            console.error('Error loading metrics:', error);
        }
    };

    const handleViewJob = (job) => {
        // TODO: Implement job detail modal
        console.log('View job:', job);
    };

    const handleRetryJob = async (job) => {
        try {
            const response = await fetch(`/api/jobs/${job.id}/retry`, {
                method: 'POST'
            });

            if (response.ok) {
                loadJobs();
            }
        } catch (error) {
            console.error('Error retrying job:', error);
        }
    };

    const handleDeleteJob = async (jobId) => {
        if (!window.confirm('Are you sure you want to delete this job?')) {
            return;
        }

        try {
            await jobsAPI.cancelJob(jobId);
            loadJobs();
        } catch (error) {
            console.error('Error deleting job:', error);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-6 py-8">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">Loading dashboard...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-6 py-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                    <p className="text-gray-400">
                        Monitor your research jobs and system performance
                    </p>
                </div>

                {/* Metrics Cards */}
                <div className="mb-8">
                    <MetricsCards metrics={metrics} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Job History - Takes up 2 columns */}
                    <div className="lg:col-span-2">
                        <JobHistory
                            jobs={jobs}
                            onViewJob={handleViewJob}
                            onRetryJob={handleRetryJob}
                            onDeleteJob={handleDeleteJob}
                        />
                    </div>

                    {/* Live Metrics - Takes up 1 column */}
                    <div>
                        <LiveMetrics
                            isConnected={isConnected}
                            liveData={liveData}
                        />
                    </div>
                </div>

                {/* Connection Status */}
                <div className="fixed bottom-4 left-4">
                    <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg glass ${isConnected ? 'border-green-500/30' : 'border-red-500/30'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                        <span className="text-xs">
                            {isConnected ? 'Live Updates' : 'Reconnecting'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;