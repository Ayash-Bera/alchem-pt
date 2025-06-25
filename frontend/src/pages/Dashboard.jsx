import React, { useState, useEffect } from 'react';
import MetricsCards from '../components/Dashboard/MetricsCards';
import JobHistory from '../components/Dashboard/JobHistory';
import LiveMetrics from '../components/Dashboard/LiveMetrics';
import { jobsAPI, metricsAPI, healthAPI } from '../services/api';
import socketService from '../services/socket';
import {
    BarChart3,
    TrendingUp,
    Activity,
    Zap,
    Database,
    Globe,
    Clock,
    Sparkles,
    AlertTriangle,
    CheckCircle,
    RefreshCw,
    Wifi,
    WifiOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';



// Helper functions outside component
const loadJobsHelper = async (setJobs) => {
    try {
        const response = await jobsAPI.getJobs({ limit: 50 });
        if (response.data && response.data.jobs) {
            setJobs(response.data.jobs);
        } else if (Array.isArray(response.data)) {
            setJobs(response.data);
        } else {
            setJobs([]);
        }
    } catch (error) {
        console.error('Error loading jobs:', error);
        setJobs([]);
    }
};

const loadMetricsHelper = async (jobs, setMetrics) => {
    try {
        const [costResponse, performanceResponse, dashboardResponse] = await Promise.allSettled([
            metricsAPI.getCostMetrics(),
            metricsAPI.getPerformanceMetrics(),
            metricsAPI.getDashboardMetrics()
        ]);

        const costData = costResponse.status === 'fulfilled' ? costResponse.value.data?.metrics || {} : {};
        const perfData = performanceResponse.status === 'fulfilled' ? performanceResponse.value.data?.metrics || {} : {};
        const dashData = dashboardResponse.status === 'fulfilled' ? dashboardResponse.value.data?.dashboard || {} : {};

        const totalJobs = jobs.length || 0;
        const runningJobs = jobs.filter(job => job.status === 'running').length || 0;
        const completedJobs = jobs.filter(job => job.status === 'completed').length || 0;
        const failedJobs = jobs.filter(job => job.status === 'failed').length || 0;

        const summaryMetrics = {
            totalJobs,
            runningJobs,
            completedJobs,
            failedJobs,
            totalCost: costData.totalCost || 0,
            avgDuration: perfData.avgDuration || 0,
            totalTokens: costData.totalTokens || 0,
            successRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
            ...dashData.summary
        };

        setMetrics(summaryMetrics);
    } catch (error) {
        console.error('Error loading metrics:', error);
        setMetrics({});
    }
};

const loadSystemHealthHelper = async (setSystemHealth) => {
    try {
        const response = await healthAPI.getDetailedHealth();
        if (response.data) {
            // Ensure the data structure matches what components expect
            const healthData = {
                ...response.data,
                services: {
                    database: {
                        healthy: response.data.services?.database?.healthy || false,
                        host: response.data.services?.database?.host || 'N/A'
                    },
                    rabbitmq: {
                        healthy: response.data.services?.rabbitmq?.healthy || false
                    },
                    alchemyst_api: {
                        healthy: response.data.services?.alchemyst_api?.healthy || false
                    }
                }
            };
            setSystemHealth(healthData);
        }
    } catch (error) {
        console.error('Error loading system health:', error);
        // Set fallback data instead of empty object
        setSystemHealth({
            status: 'unhealthy',
            services: {
                database: { healthy: false, host: 'N/A' },
                rabbitmq: { healthy: false },
                alchemyst_api: { healthy: false }
            }
        });
    }
};

const Dashboard = () => {
    const [jobs, setJobs] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [liveData, setLiveData] = useState({});
    const [systemHealth, setSystemHealth] = useState({});
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const navigate = useNavigate();
    // Mouse tracking
    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const loadDashboardData = async () => {
        try {
            setRefreshing(true);
            await Promise.all([
                loadJobsHelper(setJobs),
                loadSystemHealthHelper(setSystemHealth)
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

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
            loadJobsHelper(setJobs);
        });

        socket.on('job_progress', (data) => {
            if (data.jobId) {
                setJobs(prevJobs =>
                    prevJobs.map(job =>
                        job.id === data.jobId
                            ? { ...job, progress: data.progress, status: data.status }
                            : job
                    )
                );
            }
            setLiveData(prev => ({ ...prev, ...data }));
        });

        socket.on('job_completed', () => {
            loadJobsHelper(setJobs);
            loadMetricsHelper(jobs, setMetrics);
        });

        socket.on('job_failed', () => {
            loadJobsHelper(setJobs);
        });

        socket.on('system_status', (data) => {
            setLiveData(prev => ({ ...prev, ...data }));
        });

        socket.on('health_update', (data) => {
            setSystemHealth(data);
        });
    };

    useEffect(() => {
        loadDashboardData();
        setupSocketConnection();

        const interval = setInterval(loadDashboardData, 30000);
        return () => {
            clearInterval(interval);
            socketService.disconnect();
        };
    }, []);

    // Auto-refresh jobs every 5 seconds to catch any missed socket updates
    useEffect(() => {
        if (jobs.some(job => job.status === 'running')) {
            const refreshInterval = setInterval(() => {
                loadJobsHelper(setJobs);
            }, 5000);

            return () => clearInterval(refreshInterval);
        }
    }, [jobs]);

    // Load metrics after jobs are loaded
    useEffect(() => {
        if (jobs.length >= 0) {
            loadMetricsHelper(jobs, setMetrics);
        }
    }, [jobs]);

    const handleViewJob = (job) => {
        navigate(`/result/${job.id}`);
    };

    const handleRetryJob = async (job) => {
        try {
            const response = await jobsAPI.retryJob(job.id);
            if (response.data.success) {
                loadJobsHelper(setJobs);
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
            loadJobsHelper(setJobs);
        } catch (error) {
            console.error('Error deleting job:', error);
        }
    };

    const handleRefresh = () => {
        loadDashboardData();
    };

    const dashboardStats = [
        {
            title: "System Status",
            value: systemHealth.status === 'healthy' ? 'Healthy' : 'Issues',
            icon: systemHealth.status === 'healthy' ? CheckCircle : AlertTriangle,
            color: systemHealth.status === 'healthy' ? 'from-green-400 to-emerald-400' : 'from-red-400 to-orange-400',
            bgColor: systemHealth.status === 'healthy' ? 'bg-green-500/10' : 'bg-red-500/10'
        },
        {
            title: "Uptime",
            value: `${Math.floor((systemHealth.uptime || 0) / 3600)}h`,
            icon: Clock,
            color: 'from-blue-400 to-cyan-400',
            bgColor: 'bg-blue-500/10'
        },
        {
            title: "API Health",
            value: systemHealth.services?.alchemyst_api?.healthy ? 'Connected' : 'Issues',
            icon: Zap,
            color: 'from-yellow-400 to-orange-400',
            bgColor: 'bg-yellow-500/10'
        },
        {
            title: "Database",
            value: systemHealth.services?.database?.healthy ? 'Online' : 'Offline',
            icon: Database,
            color: 'from-purple-400 to-pink-400',
            bgColor: 'bg-purple-500/10'
        }
    ];

    if (loading) {
        return (
            <div className="min-h-screen relative overflow-hidden">
                <div
                    className="fixed inset-0 opacity-30 pointer-events-none"
                    style={{
                        background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.1), transparent 40%)`
                    }}
                />

                <div className="container mx-auto px-6 py-8">
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                                <Sparkles className="w-8 h-8 text-white animate-pulse" />
                            </div>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                            <p className="text-xl text-gray-300">Loading dashboard...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative">
            {/* Dynamic background */}
            <div
                className="fixed inset-0 opacity-30 pointer-events-none"
                style={{
                    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.1), transparent 40%)`
                }}
            />

            {/* Animated background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-3/4 right-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-2000" />
            </div>

            <div className="container mx-auto px-6 py-16 relative z-10">
                <div className="max-w-7xl mx-auto">

                    {/* Minimal Header */}
                    <div className="text-center mb-20">
                        <div className="flex items-center justify-center mb-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl">
                                <BarChart3 className="w-8 h-8 text-white" />
                            </div>
                        </div>

                        <h1 className="text-6xl font-black mb-6 leading-tight">
                            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Analytics
                            </span>
                            <br />
                            <span className="text-white">Dashboard</span>
                        </h1>

                        <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-12">
                            Monitor your research jobs and system performance with real-time analytics
                        </p>

                        {/* Minimal System Status */}
                        <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto mb-8">
                            <div className="minimal-card p-4 rounded-2xl text-center">
                                <CheckCircle className={`w-6 h-6 mx-auto mb-2 ${systemHealth.status === 'healthy' ? 'text-green-400' : 'text-red-400'}`} />
                                <div className="text-lg font-bold text-white">{systemHealth.status === 'healthy' ? 'Healthy' : 'Issues'}</div>
                                <div className="text-xs text-gray-400">System</div>
                            </div>
                            <div className="minimal-card p-4 rounded-2xl text-center">
                                <Clock className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                                <div className="text-lg font-bold text-white">{Math.floor((systemHealth.uptime || 0) / 3600)}h</div>
                                <div className="text-xs text-gray-400">Uptime</div>
                            </div>
                            <div className="minimal-card p-4 rounded-2xl text-center">
                                <Database className={`w-6 h-6 mx-auto mb-2 ${systemHealth.services?.database?.healthy ? 'text-green-400' : 'text-red-400'}`} />
                                <div className="text-lg font-bold text-white">{systemHealth.services?.database?.healthy ? 'Online' : 'Offline'}</div>
                                <div className="text-xs text-gray-400">Database</div>
                            </div>
                            <div className="minimal-card p-4 rounded-2xl text-center">
                                <Zap className={`w-6 h-6 mx-auto mb-2 ${systemHealth.services?.alchemyst_api?.healthy ? 'text-green-400' : 'text-red-400'}`} />
                                <div className="text-lg font-bold text-white">{systemHealth.services?.alchemyst_api?.healthy ? 'Active' : 'Issues'}</div>
                                <div className="text-xs text-gray-400">API</div>
                            </div>
                        </div>

                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="minimal-card px-6 py-3 rounded-2xl hover:scale-105 transition-all duration-300"
                        >
                            <div className="flex items-center space-x-2">
                                <RefreshCw className={`w-4 h-4 text-blue-400 ${refreshing ? 'animate-spin' : ''} transition-transform duration-500`} />
                                <span className="text-sm font-medium text-white">
                                    {refreshing ? 'Refreshing...' : 'Refresh Data'}
                                </span>
                            </div>
                        </button>
                    </div>

                    {/* Metrics Cards */}
                    <div className="mb-12 relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                        <div className="relative">
                            <MetricsCards metrics={metrics} />
                        </div>
                    </div>

                    {/* Main Dashboard Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                                <div className="relative">
                                    <JobHistory
                                        jobs={jobs}
                                        onViewJob={handleViewJob}
                                        onRetryJob={handleRetryJob}
                                        onDeleteJob={handleDeleteJob}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-4">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                                <div className="relative">
                                    <LiveMetrics
                                        isConnected={isConnected}
                                        liveData={liveData}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Health Overview */}
                    <div className="mt-12">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-green-500 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                            <div className="relative glass p-8 rounded-3xl">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-white">System Health Overview</h2>
                                    <div className="flex items-center space-x-2">
                                        {isConnected ? (
                                            <Wifi className="w-5 h-5 text-green-400" />
                                        ) : (
                                            <WifiOff className="w-5 h-5 text-red-400" />
                                        )}
                                        <span className={`text-sm font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                                            {isConnected ? 'Live' : 'Offline'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="glass-strong p-6 rounded-2xl">
                                        <div className="flex items-center space-x-3 mb-4">
                                            <Database className={`w-6 h-6 ${systemHealth.services?.database?.healthy ? 'text-green-400' : 'text-red-400'}`} />
                                            <h3 className="font-semibold text-white">Database</h3>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Status</span>
                                                <span className={systemHealth.services?.database?.healthy ? 'text-green-400' : 'text-red-400'}>
                                                    {systemHealth.services?.database?.healthy ? 'Healthy' : 'Error'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Host</span>
                                                <span className="text-white">{systemHealth.services?.database?.host || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="glass-strong p-6 rounded-2xl">
                                        <div className="flex items-center space-x-3 mb-4">
                                            <Activity className={`w-6 h-6 ${systemHealth.services?.rabbitmq?.healthy ? 'text-green-400' : 'text-red-400'}`} />
                                            <h3 className="font-semibold text-white">Message Queue</h3>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Status</span>
                                                <span className={systemHealth.services?.rabbitmq?.healthy ? 'text-green-400' : 'text-red-400'}>
                                                    {systemHealth.services?.rabbitmq?.healthy ? 'Connected' : 'Disconnected'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="glass-strong p-6 rounded-2xl">
                                        <div className="flex items-center space-x-3 mb-4">
                                            <Globe className={`w-6 h-6 ${systemHealth.services?.alchemyst_api?.healthy ? 'text-green-400' : 'text-red-400'}`} />
                                            <h3 className="font-semibold text-white">Alchemyst API</h3>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Status</span>
                                                <span className={systemHealth.services?.alchemyst_api?.healthy ? 'text-green-400' : 'text-red-400'}>
                                                    {systemHealth.services?.alchemyst_api?.healthy ? 'Active' : 'Issues'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Connection Status */}
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
                            {isConnected ? 'Live Updates' : 'Reconnecting...'}
                        </div>
                        <div className="text-xs text-gray-400">
                            {isConnected ? 'Real-time monitoring active' : 'Please wait...'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance tip */}
            <div className="fixed bottom-8 left-8 z-50">
                <div className="glass px-4 py-3 rounded-2xl shadow-xl border border-white/10 max-w-xs">
                    <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white mb-1">Live Monitoring</div>
                            <div className="text-xs text-gray-400 leading-relaxed">
                                Dashboard updates automatically every 30 seconds with real-time job status
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
