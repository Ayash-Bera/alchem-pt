import React from 'react';
import { Clock, DollarSign, Zap } from 'lucide-react';

const ProgressDisplay = ({ job, logs = [] }) => {
    if (!job) return null;

    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'text-blue-400';
            case 'completed': return 'text-green-400';
            case 'failed': return 'text-red-400';
            default: return 'text-yellow-400';
        }
    };

    const formatDuration = (startTime) => {
        if (!startTime) return '0s';
        const diff = Date.now() - new Date(startTime).getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
    };

    return (
        <div className="glass p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Research Progress</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                    {job.status?.toUpperCase()}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span>{job.progress || 0}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress || 0}%` }}
                    />
                </div>
            </div>

            {/* Job Info */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="glass-strong p-3 rounded-lg text-center">
                    <Clock className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                    <div className="text-xs text-gray-400">Duration</div>
                    <div className="text-sm font-medium">
                        {formatDuration(job.lastRunAt)}
                    </div>
                </div>

                <div className="glass-strong p-3 rounded-lg text-center">
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-400" />
                    <div className="text-xs text-gray-400">Cost</div>
                    <div className="text-sm font-medium">
                        ${job.metrics?.cost_usd?.toFixed(4) || '0.00'}
                    </div>
                </div>

                <div className="glass-strong p-3 rounded-lg text-center">
                    <Zap className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                    <div className="text-xs text-gray-400">Tokens</div>
                    <div className="text-sm font-medium">
                        {job.metrics?.tokens_used || 0}
                    </div>
                </div>
            </div>

            {/* Recent Logs */}
            <div>
                <h4 className="text-sm font-medium mb-3">Recent Activity</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                    {logs.length > 0 ? (
                        logs.slice(-5).map((log, index) => (
                            <div key={index} className="text-sm p-2 glass-strong rounded">
                                <div className="flex justify-between items-start">
                                    <span className="text-gray-300 flex-1">{log.message}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-sm text-gray-500 text-center py-4">
                            {job.status === 'running' ? 'Waiting for updates...' : 'No activity logs'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProgressDisplay;