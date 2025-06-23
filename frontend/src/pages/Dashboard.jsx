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
    Shield,
    Clock,
    Sparkles,
    Eye,
    AlertTriangle,
    CheckCircle,
    RefreshCw,
    Cpu,
    Wifi,
    WifiOff
} from 'lucide-react';

const Dashboard = () => {
    const [jobs, setJobs] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [liveData, setLiveData] = useState({});
    const [systemHealth, setSystemHealth] = useState({});
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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

        socket.on('health_update', (data) => {
            setSystemHealth(data);
        });
    };

    const loadDashboardData = async () => {
        try {
            setRefreshing(true);
            await Promise.all([
                loadJobs(),
                loadMetrics(),
                loadSystemHealth()
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadJobs = async () => {
        try {
            const response = await jobsAPI.getJobs({ limit: 50 });
            if (response.data.success) {
                setJobs(response.data.jobs);
            }
        } catch (error) {
            console.error('Error loading jobs:', error);
        }
    };

    const loadMetrics = async () => {
        try {
            const [costResponse, performanceResponse, dashboardResponse] = await Promise.all([
                metricsAPI.getCostMetrics(),
                metricsAPI.getPerformanceMetrics(),
                metricsAPI.getDashboardMetrics()
            ]);

            const costData = costResponse.data.success ? costResponse.data.metrics : {};
            const perfData = performanceResponse.data.success ? performanceResponse.data.metrics : {};
            const dashData = dashboardResponse.data.success ? dashboardResponse.data.dashboard : {};

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
                    : 0,
                successRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
                ...dashData.summary
            };

            setMetrics(summaryMetrics);
        } catch (error) {
            console.error('Error loading metrics:', error);
        }
    };

    const loadSystemHealth = async () => {
        try {
            const response = await healthAPI.getDetailedHealth();
            if (response.data) {
                setSystemHealth(response.data);
            }
        } catch (error) {
            console.error('Error loading system health:', error);
        }
    };

    const handleViewJob = (job) => {
        console.log('View job:', job);
        // TODO: Implement job detail modal
    };

    const handleRetryJob = async (job) => {
        try {
            const response = await jobsAPI.retryJob(job.id);
            if (response.data.success) {
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
                {/* Dynamic background */}
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
                <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
                <div className="absolute top-3/4 right-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-2000" />
            </div>

            <div className="container mx-auto px-6 py-16 relative z-10">
                <div className="max-w-7xl mx-auto">

                    {/* Spectacular Header */}
                    <div className="text-center mb-20 relative">
                        {/* Glowing background text */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <h1 className="text-8xl font-black bg-gradient-to-r from-green-600/20 via-blue-600/20 to-purple-600/20 bg-clip-text text-transparent blur-sm select-none">
                                DASHBOARD
                            </h1>
                        </div>

                        {/* Main title */}
                        <div className="relative z-10">
                            <div className="flex items-center justify-center mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-green-500/25 animate-pulse">
                                    <BarChart3 className="w-8 h-8 text-white" />
                                </div>
                            </div>

                            <h1 className="text-7xl font-black mb-8 leading-tight">
                                <span className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                                    Analytics
                                </span>
                                <br />
                                <span className="text-white">Dashboard</span>
                            </h1>

                            <p className="text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed mb-12">
                                Monitor your research jobs and system performance with
                                <span className="text-transparent bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text font-semibold"> real-time analytics </span>
                                and comprehensive insights
                            </p>

                            {/* System Status Cards */}
                            <div className="grid grid-cols-4 gap-6 max-w-4xl mx-auto mb-8">
                                {dashboardStats.map((stat, index) => (
                                    <div key={index} className="glass-strong p-4 rounded-2xl text-center group hover:scale-105 transition-transform">
                                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${stat.color} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                                            <stat.icon className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="text-lg font-bold text-white group-hover:text-green-400 transition-colors">{stat.value}</div>
                                        <div className="text-xs text-gray-400">{stat.title}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Refresh Button */}
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="glass-strong px-6 py-3 rounded-2xl hover:scale-105 transition-all duration-300 group"
                            >
                                <div className="flex items-center space-x-2">
                                    <RefreshCw className={`w-4 h-4 text-blue-400 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                                    <span className="text-sm font-medium text-white">
                                        {refreshing ? 'Refreshing...' : 'Refresh Data'}
                                    </span>
                                </div>
                            </button>
                        </div>
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

                        {/* Job History - Takes up 8 columns */}
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

                        {/* Live Metrics - Takes up 4 columns */}
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
                                    {/* Database Health */}
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

                                    {/* RabbitMQ Health */}
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

                                    {/* API Health */}
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