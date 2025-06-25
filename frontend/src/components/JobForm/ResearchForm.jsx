import React, { useState } from 'react';
import { Play, Square, Sparkles } from 'lucide-react';

const ResearchForm = ({ onSubmit, isRunning, onCancel, currentJobId }) => {
    const [formData, setFormData] = useState({
        topic: '',
        researchDepth: 'medium',
        deliverables: ['summary', 'report'],
        priority: 'normal'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.topic.trim()) return;

        onSubmit({
            type: 'deep-research',
            data: {
                ...formData,
                options: {}
            }
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDeliverablesChange = (deliverable) => {
        setFormData(prev => ({
            ...prev,
            deliverables: prev.deliverables.includes(deliverable)
                ? prev.deliverables.filter(d => d !== deliverable)
                : [...prev.deliverables, deliverable]
        }));
    };

    const deliverableOptions = [
        { id: 'summary', label: 'Summary' },
        { id: 'report', label: 'Report' },
        { id: 'recommendations', label: 'Recommendations' },
        { id: 'citations', label: 'Citations' }
    ];

    const depthOptions = [
        { value: 'shallow', label: 'Quick', time: '15m' },
        { value: 'medium', label: 'Standard', time: '30m' },
        { value: 'deep', label: 'Deep', time: '45m' }
    ];

    return (
        <div className="minimal-card p-6 rounded-2xl">
            {/* Compact Header */}
            <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-white">Research Agent</h2>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Topic Input */}
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                        Topic
                    </label>
                    <textarea
                        name="topic"
                        value={formData.topic}
                        onChange={handleInputChange}
                        disabled={isRunning}
                        placeholder="Enter research topic..."
                        className="w-full px-4 py-3 rounded-xl form-input-minimal resize-none text-sm"
                        rows={3}
                        required
                    />
                </div>

                {/* Research Depth - Compact */}
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                        Depth
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {depthOptions.map((option) => (
                            <label
                                key={option.value}
                                className={`relative p-3 rounded-lg border transition-all cursor-pointer text-center ${formData.researchDepth === option.value
                                    ? 'border-blue-400 bg-blue-500/20'
                                    : 'border-white/10 bg-white/5 hover:border-white/20'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="researchDepth"
                                    value={option.value}
                                    checked={formData.researchDepth === option.value}
                                    onChange={handleInputChange}
                                    disabled={isRunning}
                                    className="sr-only"
                                />
                                <div className="text-sm font-medium text-white">{option.label}</div>
                                <div className="text-xs text-gray-400">{option.time}</div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Deliverables - Compact Grid */}
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                        Deliverables
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        {deliverableOptions.map((option) => (
                            <div
                                key={option.id}
                                onClick={() => !isRunning && handleDeliverablesChange(option.id)}
                                className={`flex items-center space-x-2 p-2 rounded-lg transition-all cursor-pointer minimal-card ${formData.deliverables.includes(option.id)
                                    ? 'border-green-400/50 bg-green-500/10'
                                    : 'hover:bg-white/5'
                                    }`}
                            >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${formData.deliverables.includes(option.id)
                                    ? 'border-green-400 bg-green-400'
                                    : 'border-white/30'
                                    }`}>
                                    {formData.deliverables.includes(option.id) && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-white">{option.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Priority - Compact */}
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                        Priority
                    </label>
                    <div className="relative">
                        <select
                            name="priority"
                            value={formData.priority}
                            onChange={handleInputChange}
                            disabled={isRunning}
                            className="w-full px-4 py-3 rounded-xl minimal-card text-sm text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50"
                        >
                            <option value="low">Low Priority</option>
                            <option value="normal">Normal Priority</option>
                            <option value="high">High Priority</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Submit Button - Compact */}
                <div className="pt-6">
                    {!isRunning ? (
                        <button
                            type="submit"
                            disabled={!formData.topic.trim()}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl font-medium shadow-lg transition-all duration-300 text-white border border-white/20 backdrop-blur-sm"
                            style={{
                                background: !formData.topic.trim()
                                    ? 'linear-gradient(to right, #64748b, #475569)'
                                    : 'linear-gradient(to right, #4f46e5, #6366f1)',
                                opacity: !formData.topic.trim() ? 0.6 : 1,
                                cursor: !formData.topic.trim() ? 'not-allowed' : 'pointer'
                            }}
                            onMouseEnter={(e) => {
                                if (formData.topic.trim()) {
                                    e.target.style.background = 'linear-gradient(to right, #3730a3, #4338ca)';
                                    e.target.style.transform = 'translateY(-1px)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (formData.topic.trim()) {
                                    e.target.style.background = 'linear-gradient(to right, #4f46e5, #6366f1)';
                                    e.target.style.transform = 'translateY(0px)';
                                }
                            }}
                        >
                            <Play size={18} />
                            <span>Start Research</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onCancel(currentJobId)}
                            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl font-medium shadow-lg transition-all duration-300 text-white border border-white/20 backdrop-blur-sm"
                            style={{
                                background: 'linear-gradient(to right, #dc2626, #991b1b)',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = 'linear-gradient(to right, #b91c1c, #7f1d1d)';
                                e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = 'linear-gradient(to right, #dc2626, #991b1b)';
                                e.target.style.transform = 'translateY(0px)';
                            }}
                        >
                            <Square size={18} />
                            <span>Stop Research</span>
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default ResearchForm; 
