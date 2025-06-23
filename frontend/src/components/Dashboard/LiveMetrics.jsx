import React, { useState, useEffect } from 'react';
import {
    Activity,
    Cpu,
    Database,
    Wifi,
    WifiOff,
    Zap,
    Clock,
    BarChart3,
    Monitor
} from 'lucide-react';

const LiveMetrics = ({ isConnected = false, liveData = {} }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [cpuHistory, setCpuHistory] = useState([]);
    const [memoryHistory, setMemoryHistory] = useState([]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Track CPU and memory history for mini charts
    useEffect(() => {
        if (liveData.cpuUsage !== undefined) {
            setCpuHistory(prev => [...prev.slice(-9), liveData.cpuUsage]);
        }
        if (liveData.memoryUsed && liveData.memoryTotal) {
            const memoryPercent = (liveData.memoryUsed / liveData.memoryTotal) * 100;
            setMemoryHistory(prev => [...prev.slice(-9), memoryPercent]);
        }
    }, [liveData.cpuUsage, liveData.memoryUsed, liveData.memoryTotal]);

    const formatUptime = (seconds) => {
        if (!seconds) return '0s';
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const formatMemory = (bytes) => {
        if (!bytes) return '0 MB';
        const mb = bytes / 1024 / 1024;
        if (mb >= 1024) {
            return `${(mb / 1024).toFixed(1)} GB`;
        }
        return `${Math.round(mb)} MB`;
    };

    const getConnectionStatus = () => {
        return isConnected ? {
            icon: Wifi,
            text: 'Connected',
            color: 'text-green-400',
            bgColor: 'bg-green-500/20',
            pulse: true
        } : {
            icon: WifiOff,
            text: 'Disconnected',
            color: 'text-red-400',
            bgColor: 'bg-red-500/20',
            pulse: false
        };
    };

    const getHealthColor = (value, thresholds) => {
        if (value < thresholds.good) return 'text-green-400';
        if (value < thresholds.warning) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getMiniChart = (data, color = 'blue') => {
        if (data.length === 0) return null;

        const max = Math.max(...data, 1);
        const points = data.map((value, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - (value / max) * 100;
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg className="w-full h-8" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                    fill="none"
                    stroke={`var(--${color}-500)`}
                    strokeWidth="2"
                    points={points}
                    className="drop-shadow-sm"
                />
                <defs>
                    <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={`var(--${color}-500)`} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={`var(--${color}-500)`} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polyline
                    fill={`url(#gradient-${color})`}
                    stroke="none"
                    points={`0,100 ${points} 100,100`}
                />
            </svg>
        );
    };

    const connectionStatus = getConnectionStatus();
    const ConnectionIcon = connectionStatus.icon;

    const memoryPercent = liveData.memoryTotal ?
        ((liveData.memoryUsed || 0) / liveData.memoryTotal) * 100 : 0;

    return (
        <div className="glass p-8 rounded-3xl relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-48 h-48 bg-gradient-to-br from-green-500/5 to-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-full blur-2xl" />

            {/* Header */}
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Live System Metrics</h2>
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl ${connectionStatus.bgColor} ${connectionStatus.pulse ? 'animate-pulse' : ''}`}>
                            <ConnectionIcon className={`w-4 h-4 ${connectionStatus.color}`} />
                        </div>
                        <div>
                            <span className={`text-sm font-medium ${connectionStatus.color}`}>
                                {connectionStatus.text}
                            </span>
                            <p className="text-xs text-gray-500">
                                {isConnected ? 'Real-time updates' : 'Attempting reconnection...'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-lg font-mono text-blue-400 mb-1">
                        {currentTime.toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-gray-400">
                        {currentTime.toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                {/* Active Jobs */}
                <div className="glass-strong p-6 rounded-2xl group hover:scale-105 transition-transform">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <Activity className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <span className="text-sm text-gray-400 font-medium">Active Jobs</span>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white mb-2">
                        {liveData.activeJobs || 0}
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                            {liveData.queuedJobs || 0} queued
                        </div>
                        {liveData.activeJobs > 0 && (
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        )}
                    </div>
                </div>

                {/* CPU Usage */}
                <div className="glass-strong p-6 rounded-2xl group hover:scale-105 transition-transform">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                            <Cpu className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <span className="text-sm text-gray-400 font-medium">CPU Usage</span>
                        </div>
                    </div>
                    <div className={`text-3xl font-bold mb-2 ${getHealthColor(liveData.cpuUsage || 0, { good: 50, warning: 80 })}`}>
                        {(liveData.cpuUsage || 0).toFixed(1)}%
                    </div>
                    <div className="space-y-2">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(liveData.cpuUsage || 0, 100)}%` }}
                            />
                        </div>
                        {cpuHistory.length > 0 && (
                            <div className="h-8">
                                {getMiniChart(cpuHistory, 'orange')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Memory Usage */}
                <div className="glass-strong p-6 rounded-2xl group hover:scale-105 transition-transform">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                            <Database className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <span className="text-sm text-gray-400 font-medium">Memory</span>
                        </div>
                    </div>
                    <div className={`text-2xl font-bold mb-1 ${getHealthColor(memoryPercent, { good: 60, warning: 85 })}`}>
                        {formatMemory(liveData.memoryUsed)}
                    </div>
                    <div className="space-y-2">
                        <div className="text-xs text-gray-500">
                            of {formatMemory(liveData.memoryTotal)} ({memoryPercent.toFixed(1)}%)
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(memoryPercent, 100)}%` }}
                            />
                        </div>
                        {memoryHistory.length > 0 && (
                            <div className="h-8">
                                {getMiniChart(memoryHistory, 'purple')}
                            </div>
                        )}
                    </div>
                </div>

                {/* System Uptime */}
                <div className="glass-strong p-6 rounded-2xl group hover:scale-105 transition-transform">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                            <Clock className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <span className="text-sm text-gray-400 font-medium">Uptime</span>
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">
                        {formatUptime(liveData.uptime || 0)}
                    </div>
                    <div className="text-xs text-gray-500">
                        since last restart
                    </div>
                </div>
            </div>

            {/* System Health Indicators */}
            <div className="space-y-4 mb-8 relative z-10">
                <h3 className="text-lg font-semibold text-white">System Health</h3>
                <div className="grid grid-cols-1 gap-3">
                    {/* API Response Time */}
                    <div className="glass-strong p-4 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                <span className="text-sm text-gray-300">API Response</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-white">
                                    {liveData.apiResponseTime || 'N/A'}ms
                                </span>
                                <div className={`w-2 h-2 rounded-full ${(liveData.apiResponseTime || 0) < 100 ? 'bg-green-500' :
                                    (liveData.apiResponseTime || 0) < 300 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`} />
                            </div>
                        </div>
                    </div>

                    {/* Database Connection */}
                    <div className="glass-strong p-4 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <Database className="w-4 h-4 text-blue-400" />
                                <span className="text-sm text-gray-300">Database</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className={`text-sm font-medium ${liveData.databaseConnected ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                    {liveData.databaseConnected ? 'Connected' : 'Disconnected'}
                                </span>
                                <div className={`w-2 h-2 rounded-full ${liveData.databaseConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                                    }`} />
                            </div>
                        </div>
                    </div>

                    {/* Queue Status */}
                    <div className="glass-strong p-4 rounded-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <BarChart3 className="w-4 h-4 text-purple-400" />
                                <span className="text-sm text-gray-300">Message Queue</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className={`text-sm font-medium ${liveData.queueHealthy ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                    {liveData.queueHealthy ? 'Healthy' : 'Issues'}
                                </span>
                                <div className={`w-2 h-2 rounded-full ${liveData.queueHealthy ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                                    }`} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white mb-4">Recent System Events</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {liveData.recentEvents && liveData.recentEvents.length > 0 ? (
                        liveData.recentEvents.slice(0, 5).map((event, index) => (
                            <div key={index} className="glass-strong p-3 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-2 h-2 rounded-full ${event.type === 'success' ? 'bg-green-500' :
                                            event.type === 'warning' ? 'bg-yellow-500' :
                                                event.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                            } animate-pulse`} />
                                        <span className="text-sm text-gray-300">{event.message}</span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="glass-strong p-6 rounded-xl text-center">
                            <Monitor className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                            <div className="text-sm text-gray-500">
                                {isConnected ? 'Monitoring system events...' : 'Connect to view live events'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Status */}
            <div className="mt-8 pt-6 border-t border-white/10 relative z-10">
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-4">
                        <span className="text-gray-500">Last update:</span>
                        <span className={connectionStatus.color}>
                            {isConnected ? 'Live' : 'Disconnected'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className={`w-1 h-1 rounded-full ${connectionStatus.color.replace('text-', 'bg-')} ${connectionStatus.pulse ? 'animate-ping' : ''}`} />
                        <span className="text-gray-500">
                            {isConnected ? 'Real-time monitoring active' : 'Reconnecting...'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveMetrics;