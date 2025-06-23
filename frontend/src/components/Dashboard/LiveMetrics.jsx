import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Database, Wifi, WifiOff } from 'lucide-react';

const LiveMetrics = ({ isConnected = false, liveData = {} }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const formatUptime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    const formatMemory = (bytes) => {
        if (!bytes) return '0 MB';
        const mb = bytes / 1024 / 1024;
        return `${Math.round(mb)} MB`;
    };

    const getConnectionStatus = () => {
        return isConnected ? {
            icon: Wifi,
            text: 'Connected',
            color: 'text-green-400',
            bgColor: 'bg-green-500/20'
        } : {
            icon: WifiOff,
            text: 'Disconnected',
            color: 'text-red-400',
            bgColor: 'bg-red-500/20'
        };
    };

    const connectionStatus = getConnectionStatus();
    const ConnectionIcon = connectionStatus.icon;

    return (
        <div className="glass p-6 rounded-lg">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Live System Metrics</h2>
                <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg ${connectionStatus.bgColor}`}>
                        <ConnectionIcon className={`w-4 h-4 ${connectionStatus.color}`} />
                    </div>
                    <span className={`text-sm ${connectionStatus.color}`}>
                        {connectionStatus.text}
                    </span>
                </div>
            </div>

            {/* Current Time */}
            <div className="glass-strong p-3 rounded-lg mb-4">
                <div className="text-center">
                    <div className="text-lg font-mono text-blue-400">
                        {currentTime.toLocaleTimeString()}
                    </div>
                    <div className="text-xs text-gray-400">
                        {currentTime.toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
                {/* Active Jobs */}
                <div className="glass-strong p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-gray-400">Active Jobs</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                        {liveData.activeJobs || 0}
                    </div>
                    <div className="text-xs text-gray-500">
                        {liveData.queuedJobs || 0} queued
                    </div>
                </div>

                {/* System Load */}
                <div className="glass-strong p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                        <Cpu className="w-4 h-4 text-orange-400" />
                        <span className="text-sm text-gray-400">CPU Usage</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                        {(liveData.cpuUsage || 0).toFixed(1)}%
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                        <div
                            className="bg-orange-500 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${liveData.cpuUsage || 0}%` }}
                        />
                    </div>
                </div>

                {/* Memory Usage */}
                <div className="glass-strong p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                        <Database className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-gray-400">Memory</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                        {formatMemory(liveData.memoryUsed)}
                    </div>
                    <div className="text-xs text-gray-500">
                        of {formatMemory(liveData.memoryTotal)}
                    </div>
                </div>

                {/* System Uptime */}
                <div className="glass-strong p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                        <Activity className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-gray-400">Uptime</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                        {formatUptime(liveData.uptime || 0)}
                    </div>
                    <div className="text-xs text-gray-500">
                        since last restart
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="mt-6">
                <h3 className="text-sm font-medium mb-3">Recent System Events</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                    {liveData.recentEvents && liveData.recentEvents.length > 0 ? (
                        liveData.recentEvents.slice(0, 5).map((event, index) => (
                            <div key={index} className="text-xs p-2 glass-strong rounded flex justify-between">
                                <span className="text-gray-300">{event.message}</span>
                                <span className="text-gray-500">
                                    {new Date(event.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-gray-500 text-center py-2">
                            {isConnected ? 'Waiting for events...' : 'Connect to view live events'}
                        </div>
                    )}
                </div>
            </div>

            {/* Connection Status Footer */}
            <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>WebSocket Status</span>
                    <span className={connectionStatus.color}>
                        {isConnected ? 'Real-time updates active' : 'Reconnecting...'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default LiveMetrics;