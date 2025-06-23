import React, { useState } from 'react';
import {
    Clock,
    DollarSign,
    Eye,
    RotateCcw,
    Trash2,
    Search,
    Filter,
    PlayCircle,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Calendar,
    Zap,
    TrendingUp,
    Cpu,
    FileText
} from 'lucide-react';

const JobHistory = ({ jobs = [], onViewJob, onRetryJob, onDeleteJob }) => {
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    const getStatusConfig = (status) => {
        const configs = {
            completed: {
                badge: 'bg-green-500/20 text-green-400 border-green-500/30',
                icon: CheckCircle,
                color: 'text-green-400',
                bgColor: 'bg-green-500/10'
            },
            running: {
                badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                icon: PlayCircle,
                color: 'text-blue-400',
                bgColor: 'bg-blue-500/10'
            },
            failed: {
                badge: 'bg-red-500/20 text-red-400 border-red-500/30',
                icon: XCircle,
                color: 'text-red-400',
                bgColor: 'bg-red-500/10'
            },
            scheduled: {
                badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                icon: Clock,
                color: 'text-yellow-400',
                bgColor: 'bg-yellow-500/10'
            },
            cancelled: {
                badge: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                icon: XCircle,
                color: 'text-gray-400',
                bgColor: 'bg-gray-500/10'
            }
        };
        return configs[status] || configs.scheduled;
    };

    const getJobTypeIcon = (jobType) => {
        switch (jobType) {
            case 'deep-research': return Cpu;
            case 'github-analysis': return FileText;
            case 'document-summary': return FileText;
            default: return Zap;
        }
    };

    const getJobTypeColor = (jobType) => {
        switch (jobType) {
            case 'deep-research': return 'from-purple-500 to-pink-500';
            case 'github-analysis': return 'from-blue-500 to-cyan-500';
            case 'document-summary': return 'from-green-500 to-emerald-500';
            default: return 'from-gray-500 to-gray-600';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    const formatDuration = (start, end) => {
        if (!start || !end) return 'N/A';
        const diff = new Date(end) - new Date(start);
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    };

    const getRelativeTime = (dateString) => {
        if (!dateString) return 'Unknown';
        const now = new Date();
        const date = new Date(dateString);
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    // Filter and sort jobs
    const filteredJobs = jobs
        .filter(job => {
            const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
            const matchesType = filterType === 'all' || job.name === filterType;
            const matchesSearch = !searchTerm ||
                (job.data?.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    job.data?.repository?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    job.name?.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesStatus && matchesType && matchesSearch;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                case 'oldest':
                    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
                case 'duration':
                    const aDuration = a.lastFinishedAt && a.lastRunAt
                        ? new Date(a.lastFinishedAt) - new Date(a.lastRunAt) : 0;
                    const bDuration = b.lastFinishedAt && b.lastRunAt
                        ? new Date(b.lastFinishedAt) - new Date(b.lastRunAt) : 0;
                    return bDuration - aDuration;
                case 'cost':
                    return (b.metrics?.cost_usd || 0) - (a.metrics?.cost_usd || 0);
                default:
                    return 0;
            }
        });

    const jobTypes = [...new Set(jobs.map(job => job.name).filter(Boolean))];

    return (
        <div className="glass p-8 rounded-3xl relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl" />

            {/* Header */}
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Job History</h2>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <span>{filteredJobs.length} of {jobs.length} jobs</span>
                        <div className="flex items-center space-x-2">
                            <TrendingUp className="w-4 h-4" />
                            <span>Live updates</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="glass-strong px-4 py-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-blue-400" />
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="space-y-4 mb-8 relative z-10">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search jobs by topic, repository, or type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl glass-strong border border-white/20 focus:border-blue-400 focus:outline-none text-white placeholder-gray-400 transition-all"
                    />
                </div>

                {/* Filter controls */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl glass-strong border border-white/20 focus:border-blue-400 focus:outline-none text-white text-sm"
                        >
                            <option value="all">All Status</option>
                            <option value="completed">Completed</option>
                            <option value="running">Running</option>
                            <option value="failed">Failed</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Type</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl glass-strong border border-white/20 focus:border-blue-400 focus:outline-none text-white text-sm"
                        >
                            <option value="all">All Types</option>
                            {jobTypes.map(type => (
                                <option key={type} value={type}>
                                    {type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Sort By</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl glass-strong border border-white/20 focus:border-blue-400 focus:outline-none text-white text-sm"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="duration">By Duration</option>
                            <option value="cost">By Cost</option>
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={() => {
                                setFilterStatus('all');
                                setFilterType('all');
                                setSearchTerm('');
                                setSortBy('newest');
                            }}
                            className="w-full px-4 py-3 rounded-xl glass-strong hover:bg-white/10 transition-colors text-sm font-medium text-gray-300 hover:text-white"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Jobs List */}
            <div className="space-y-4 max-h-96 overflow-y-auto relative z-10">
                {filteredJobs.length > 0 ? (
                    filteredJobs.map((job) => {
                        const statusConfig = getStatusConfig(job.status);
                        const StatusIcon = statusConfig.icon;
                        const TypeIcon = getJobTypeIcon(job.name);
                        const typeColor = getJobTypeColor(job.name);

                        return (
                            <div
                                key={job.id}
                                className="glass-strong p-6 rounded-2xl hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden"
                            >
                                {/* Hover gradient effect */}
                                <div className={`absolute inset-0 bg-gradient-to-r ${typeColor} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                                <div className="relative z-10">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-start space-x-4 flex-1">
                                            {/* Job type icon */}
                                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${typeColor} flex items-center justify-center shadow-lg flex-shrink-0`}>
                                                <TypeIcon className="w-6 h-6 text-white" />
                                            </div>

                                            {/* Job details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <h3 className="font-semibold text-white text-lg truncate">
                                                        {job.name?.split('-').map(word =>
                                                            word.charAt(0).toUpperCase() + word.slice(1)
                                                        ).join(' ')}
                                                    </h3>

                                                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-xs font-medium ${statusConfig.badge}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        <span>{job.status?.toUpperCase()}</span>
                                                    </div>
                                                </div>

                                                <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                                                    {job.data?.topic || job.data?.repository || job.data?.document || 'No description available'}
                                                </p>

                                                <div className="flex items-center space-x-6 text-xs text-gray-400">
                                                    <div className="flex items-center space-x-1">
                                                        <Calendar className="w-3 h-3" />
                                                        <span>{getRelativeTime(job.createdAt)}</span>
                                                    </div>

                                                    {job.lastFinishedAt && job.lastRunAt && (
                                                        <div className="flex items-center space-x-1">
                                                            <Clock className="w-3 h-3" />
                                                            <span>{formatDuration(job.lastRunAt, job.lastFinishedAt)}</span>
                                                        </div>
                                                    )}

                                                    {job.metrics && (
                                                        <div className="flex items-center space-x-1">
                                                            <Zap className="w-3 h-3" />
                                                            <span>{job.metrics.tokens_used || 0} tokens</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions and metrics */}
                                        <div className="flex items-center space-x-4 ml-4">
                                            {/* Cost display */}
                                            {job.metrics && (
                                                <div className="text-right">
                                                    <div className="flex items-center space-x-1 text-green-400 text-sm font-medium">
                                                        <DollarSign className="w-3 h-3" />
                                                        <span>${job.metrics.cost_usd?.toFixed(4) || '0.0000'}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {job.metrics.tokens_used || 0} tokens
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action buttons */}
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => onViewJob(job)}
                                                    className="p-2 glass-strong hover:bg-white/20 rounded-xl transition-colors group/btn"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4 text-gray-400 group-hover/btn:text-white transition-colors" />
                                                </button>

                                                {job.status === 'failed' && (
                                                    <button
                                                        onClick={() => onRetryJob(job)}
                                                        className="p-2 glass-strong hover:bg-blue-500/20 rounded-xl transition-colors group/btn"
                                                        title="Retry Job"
                                                    >
                                                        <RotateCcw className="w-4 h-4 text-blue-400 group-hover/btn:text-blue-300 transition-colors" />
                                                    </button>
                                                )}

                                                {['completed', 'failed', 'cancelled'].includes(job.status) && (
                                                    <button
                                                        onClick={() => onDeleteJob(job.id)}
                                                        className="p-2 glass-strong hover:bg-red-500/20 rounded-xl transition-colors group/btn"
                                                        title="Delete Job"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-400 group-hover/btn:text-red-300 transition-colors" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress bar for running jobs */}
                                    {job.status === 'running' && (
                                        <div className="mt-4">
                                            <div className="flex justify-between text-xs mb-2">
                                                <span className="text-gray-400">Progress</span>
                                                <span className="text-blue-400 font-medium">{job.progress || 0}%</span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 relative"
                                                    style={{ width: `${job.progress || 0}%` }}
                                                >
                                                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 bg-gradient-to-r from-gray-600 to-gray-700 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <Clock className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No jobs found</h3>
                        <p className="text-gray-400 mb-6">
                            {searchTerm || filterStatus !== 'all' || filterType !== 'all'
                                ? 'Try adjusting your filters or search terms'
                                : 'Create your first research job to get started'
                            }
                        </p>
                        {(searchTerm || filterStatus !== 'all' || filterType !== 'all') && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterStatus('all');
                                    setFilterType('all');
                                }}
                                className="glass-strong px-6 py-3 rounded-xl hover:bg-white/10 transition-colors text-blue-400 font-medium"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobHistory;