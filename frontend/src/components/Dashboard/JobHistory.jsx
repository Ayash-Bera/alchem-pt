import React, { useState } from 'react';
import { Clock, DollarSign, Eye, RotateCcw, Trash2, Search } from 'lucide-react';

const JobHistory = ({ jobs = [], onViewJob, onRetryJob, onDeleteJob }) => {
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const getStatusBadge = (status) => {
        const styles = {
            completed: 'bg-green-500/20 text-green-400 border-green-500/30',
            running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            failed: 'bg-red-500/20 text-red-400 border-red-500/30',
            scheduled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        };

        return (
            <span className={`px-2 py-1 text-xs rounded-full border ${styles[status] || styles.scheduled}`}>
                {status?.toUpperCase()}
            </span>
        );
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
        return `${minutes}m ${seconds}s`;
    };

    const filteredJobs = jobs.filter(job => {
        const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
        const matchesSearch = !searchTerm ||
            (job.data?.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.name?.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesStatus && matchesSearch;
    });

    return (
        <div className="glass p-6 rounded-lg">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Job History</h2>
                <div className="text-sm text-gray-400">
                    {filteredJobs.length} of {jobs.length} jobs
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search jobs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg glass border border-white/20 focus:border-blue-400 focus:outline-none text-white placeholder-gray-400"
                    />
                </div>

                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 rounded-lg glass border border-white/20 focus:border-blue-400 focus:outline-none text-white"
                >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="running">Running</option>
                    <option value="failed">Failed</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {/* Jobs List */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredJobs.length > 0 ? (
                    filteredJobs.map((job) => (
                        <div key={job.id} className="glass-strong p-4 rounded-lg">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <h3 className="font-medium text-white">{job.name}</h3>
                                        {getStatusBadge(job.status)}
                                    </div>

                                    <p className="text-sm text-gray-300 mb-2">
                                        {job.data?.topic || job.data?.repository || 'No description'}
                                    </p>

                                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                                        <span>Created: {formatDate(job.createdAt)}</span>
                                        {job.lastFinishedAt && (
                                            <span>Duration: {formatDuration(job.lastRunAt, job.lastFinishedAt)}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 ml-4">
                                    {job.metrics && (
                                        <div className="text-right text-xs space-y-1 mr-3">
                                            <div className="flex items-center space-x-1 text-green-400">
                                                <DollarSign size={12} />
                                                <span>${job.metrics.cost_usd?.toFixed(4) || '0.00'}</span>
                                            </div>
                                            <div className="text-gray-400">
                                                {job.metrics.tokens_used || 0} tokens
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => onViewJob(job)}
                                        className="p-2 hover:glass rounded-lg transition-colors"
                                        title="View Details"
                                    >
                                        <Eye size={16} />
                                    </button>

                                    {job.status === 'failed' && (
                                        <button
                                            onClick={() => onRetryJob(job)}
                                            className="p-2 hover:glass rounded-lg transition-colors text-blue-400"
                                            title="Retry Job"
                                        >
                                            <RotateCcw size={16} />
                                        </button>
                                    )}

                                    {['completed', 'failed', 'cancelled'].includes(job.status) && (
                                        <button
                                            onClick={() => onDeleteJob(job.id)}
                                            className="p-2 hover:glass rounded-lg transition-colors text-red-400"
                                            title="Delete Job"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Progress bar for running jobs */}
                            {job.status === 'running' && (
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span>Progress</span>
                                        <span>{job.progress || 0}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-1">
                                        <div
                                            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                                            style={{ width: `${job.progress || 0}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 text-gray-400">
                        <Clock size={32} className="mx-auto mb-3 opacity-50" />
                        <p>No jobs found</p>
                        <p className="text-sm">Create your first research job to get started</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobHistory;