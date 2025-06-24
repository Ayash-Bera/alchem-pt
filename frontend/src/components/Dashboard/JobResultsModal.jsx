import React, { useState } from 'react';
import { X, Download, Clock, DollarSign, Zap, CheckCircle } from 'lucide-react';

const JobResultsModal = ({ job, isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('result');

    if (!isOpen || !job) return null;

    const formatContent = (content) => {
        if (!content) return 'No content available';

        return content.split('\n\n').map((paragraph, index) => (
            <div key={index} className="mb-4">
                <p className="text-gray-300 leading-relaxed">{paragraph}</p>
            </div>
        ));
    };

    const downloadResults = () => {
        const data = {
            jobId: job.id,
            type: job.name,
            topic: job.data?.topic,
            result: job.result,
            completedAt: job.lastFinishedAt,
            metrics: job.metrics
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `job-${job.id}-results.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass max-w-4xl w-full max-h-[90vh] rounded-3xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Job Results</h2>
                        <p className="text-gray-400">{job.data?.topic || job.name}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={downloadResults}
                            className="flex items-center space-x-2 px-4 py-2 glass-strong hover:bg-white/20 rounded-xl transition-colors"
                        >
                            <Download size={16} />
                            <span className="text-sm">Download</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 glass-strong hover:bg-white/20 rounded-xl transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {['result', 'metrics', 'details'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${
                                activeTab === tab
                                    ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Scrollable Content Area */}
                <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    {activeTab === 'result' && (
                        <div className="space-y-6">
                            {job.result ? (
                                <div className="space-y-8">
                                    {job.result.deliverables && (
                                        <div className="space-y-6">
                                            {Object.entries(job.result.deliverables).map(([key, content]) => (
                                                <div key={key} className="glass-strong p-6 rounded-2xl">
                                                   <h3 className="text-lg font-semibold text-white mb-4 capitalize">
                                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                                    </h3>
                                                    <div className="prose prose-invert max-w-none overflow-auto">
                                                        {typeof content === 'object' && content.content ? (
                                                            formatContent(content.content)
                                                        ) : typeof content === 'string' ? (
                                                            formatContent(content)
                                                        ) : (
                                                            <pre className="text-sm bg-gray-800 p-4 rounded-xl overflow-auto">
                                                                {JSON.stringify(content, null, 2)}
                                                            </pre>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {job.result.synthesis && (
                                        <div className="glass-strong p-6 rounded-2xl">
                                            <h3 className="text-lg font-semibold text-white mb-4">Research Synthesis</h3>
                                            <div className="prose prose-invert max-w-none overflow-auto">
                                                {formatContent(job.result.synthesis.content)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <CheckCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-white mb-2">No Results Available</h3>
                                    <p className="text-gray-400">This job hasn't completed yet or results aren't available.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'metrics' && (
                        <div className="grid grid-cols-2 gap-6">
                            {[
                                ['Cost', DollarSign, job.metrics?.cost_usd?.toFixed(6) || '0.000000', 'text-green-400'],
                                ['Tokens', Zap, job.metrics?.tokens_used || 0, 'text-yellow-400'],
                                ['Duration', Clock,
                                    job.lastFinishedAt && job.lastRunAt
                                        ? `${Math.floor((new Date(job.lastFinishedAt) - new Date(job.lastRunAt)) / 60000)}m`
                                        : 'N/A',
                                    'text-blue-400'],
                                ['API Calls', CheckCircle, job.metrics?.api_calls || 0, 'text-purple-400']
                            ].map(([label, Icon, value, color], idx) => (
                                <div key={idx} className="glass-strong p-6 rounded-2xl">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <Icon className={`w-6 h-6 ${color}`} />
                                        <h3 className="font-semibold text-white">{label}</h3>
                                    </div>
                                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            <div className="glass-strong p-4 rounded-xl">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-400">Job ID:</span> <span className="text-white ml-2">{job.id}</span></div>
                                    <div><span className="text-gray-400">Type:</span> <span className="text-white ml-2">{job.name}</span></div>
                                    <div><span className="text-gray-400">Status:</span> <span className="text-white ml-2">{job.status}</span></div>
                                    <div><span className="text-gray-400">Created:</span> <span className="text-white ml-2">{job.createdAt ? new Date(job.createdAt).toLocaleString() : 'N/A'}</span></div>
                                </div>
                            </div>

                            {job.data && (
                                <div className="glass-strong p-4 rounded-xl">
                                    <h4 className="font-semibold text-white mb-3">Job Data</h4>
                                    <pre className="text-sm bg-gray-800 p-4 rounded-xl overflow-auto">
                                        {JSON.stringify(job.data, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JobResultsModal;
