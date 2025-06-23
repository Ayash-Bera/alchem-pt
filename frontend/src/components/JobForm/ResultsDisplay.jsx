import React, { useState } from 'react';
import { FileText, Download, ChevronDown, ChevronUp, CheckCircle, Clock, DollarSign } from 'lucide-react';

const ResultsDisplay = ({ job, result }) => {
    const [expandedSections, setExpandedSections] = useState({
        summary: true,
        report: false,
        recommendations: false,
        synthesis: false
    });

    if (!result) return null;

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const formatContent = (content) => {
        if (!content) return 'No content available';

        // Split into paragraphs and format
        return content.split('\n\n').map((paragraph, index) => (
            <p key={index} className="mb-3 text-gray-300 leading-relaxed">
                {paragraph}
            </p>
        ));
    };

    const downloadResults = () => {
        const data = {
            topic: result.topic,
            completedAt: result.metadata?.processedAt,
            deliverables: result.deliverables,
            synthesis: result.synthesis
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `research-${result.topic.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="glass p-6 rounded-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-semibold">Research Complete</h3>
                    <p className="text-gray-400 text-sm mt-1">Topic: {result.topic}</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-green-400">
                        <CheckCircle size={18} />
                        <span className="text-sm">Completed</span>
                    </div>
                    <button
                        onClick={downloadResults}
                        className="flex items-center space-x-2 px-4 py-2 glass-strong hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <Download size={16} />
                        <span className="text-sm">Download</span>
                    </button>
                </div>
            </div>

            {/* Job Metrics */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="glass-strong p-3 rounded-lg text-center">
                    <Clock className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                    <div className="text-xs text-gray-400">Duration</div>
                    <div className="text-sm font-medium">
                        {result.metadata?.totalSteps || 0} steps
                    </div>
                </div>

                <div className="glass-strong p-3 rounded-lg text-center">
                    <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-400" />
                    <div className="text-xs text-gray-400">Total Cost</div>
                    <div className="text-sm font-medium">
                        ${job.metrics?.cost_usd?.toFixed(4) || '0.00'}
                    </div>
                </div>

                <div className="glass-strong p-3 rounded-lg text-center">
                    <FileText className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                    <div className="text-xs text-gray-400">Deliverables</div>
                    <div className="text-sm font-medium">
                        {Object.keys(result.deliverables || {}).length}
                    </div>
                </div>
            </div>

            {/* Deliverables */}
            <div className="space-y-4">
                {result.deliverables && Object.entries(result.deliverables).map(([key, content]) => (
                    <div key={key} className="glass-strong rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleSection(key)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                        >
                            <span className="font-medium capitalize">{key}</span>
                            {expandedSections[key] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {expandedSections[key] && (
                            <div className="px-4 pb-4 border-t border-white/10">
                                <div className="mt-3">
                                    {typeof content === 'object' && content.content ? (
                                        <div>
                                            {formatContent(content.content)}
                                            {content.wordCount && (
                                                <div className="mt-3 text-xs text-gray-500">
                                                    Word count: {content.wordCount}
                                                </div>
                                            )}
                                        </div>
                                    ) : typeof content === 'string' ? (
                                        formatContent(content)
                                    ) : (
                                        <pre className="text-sm bg-gray-800 p-3 rounded overflow-auto">
                                            {JSON.stringify(content, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Synthesis Section */}
                {result.synthesis && (
                    <div className="glass-strong rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleSection('synthesis')}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                        >
                            <span className="font-medium">Research Synthesis</span>
                            {expandedSections.synthesis ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {expandedSections.synthesis && (
                            <div className="px-4 pb-4 border-t border-white/10">
                                <div className="mt-3">
                                    {formatContent(result.synthesis.content)}

                                    {result.synthesis.keyThemes && result.synthesis.keyThemes.length > 0 && (
                                        <div className="mt-4">
                                            <h5 className="text-sm font-medium mb-2">Key Themes:</h5>
                                            <div className="flex flex-wrap gap-2">
                                                {result.synthesis.keyThemes.map((theme, index) => (
                                                    <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                                                        {theme}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {result.synthesis.confidence && (
                                        <div className="mt-3 text-xs text-gray-500">
                                            Confidence Level: {result.synthesis.confidence}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultsDisplay;