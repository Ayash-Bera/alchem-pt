import React, { useState } from 'react';
import { Play, Square, Sparkles } from 'lucide-react';

const ResearchForm = ({ onSubmit, isRunning, onCancel, currentJobId }) => {
    const [formData, setFormData] = useState({
        topic: '',
        researchDepth: 'medium',
        deliverables: ['summary', 'report', 'recommendations'],
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
        { id: 'summary', label: 'Executive Summary', icon: '📋' },
        { id: 'report', label: 'Full Report', icon: '📄' },
        { id: 'recommendations', label: 'Recommendations', icon: '💡' },
        { id: 'citations', label: 'Citations & Sources', icon: '📚' }
    ];

    const depthOptions = [
        { value: 'shallow', label: 'Quick Analysis', time: '~15 min', description: 'Fast overview with key insights' },
        { value: 'medium', label: 'Standard Research', time: '~30 min', description: 'Balanced depth and speed' },
        { value: 'deep', label: 'Comprehensive Study', time: '~45 min', description: 'Thorough multi-perspective analysis' }
    ];

    return (
        <div className="glass p-8 rounded-3xl shadow-2xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Deep Research Agent</h2>
                        <p className="text-sm text-gray-300">Configure your AI-powered research parameters</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Topic Input */}
                <div className="form-section">
                    <label className="form-label">Research Topic</label>
                    <textarea
                        name="topic"
                        value={formData.topic}
                        onChange={handleInputChange}
                        disabled={isRunning}
                        placeholder="Enter your research topic or question..."
                        className="w-full px-6 py-4 rounded-2xl glass-input resize-none text-white placeholder-gray-400 text-base leading-relaxed"
                        rows={4}
                        required
                    />
                    <p className="text-xs text-gray-400 mt-2">
                        Be specific for better results. Example: "Impact of artificial intelligence on healthcare outcomes"
                    </p>
                </div>

                {/* Research Depth */}
                <div className="form-section">
                    <label className="form-label">Research Depth</label>
                    <div className="space-y-4">
                        {depthOptions.map((option) => (
                            <div
                                key={option.value}
                                className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${formData.researchDepth === option.value
                                    ? 'border-blue-400 bg-blue-500/20 shadow-lg shadow-blue-500/25'
                                    : 'border-white/20 bg-white/5 hover:border-blue-300 hover:bg-white/10'
                                    }`}
                                onClick={() => !isRunning && setFormData(prev => ({ ...prev, researchDepth: option.value }))}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.researchDepth === option.value
                                            ? 'border-blue-400 bg-blue-400'
                                            : 'border-white/40'
                                            }`}>
                                            {formData.researchDepth === option.value && (
                                                <div className="w-2 h-2 bg-white rounded-full"></div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-lg font-semibold text-white mb-1">{option.label}</div>
                                            <div className="text-sm text-gray-300">{option.description}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-blue-400">{option.time}</div>
                                    </div>
                                </div>
                                <input
                                    type="radio"
                                    name="researchDepth"
                                    value={option.value}
                                    checked={formData.researchDepth === option.value}
                                    onChange={() => { }} // Handled by onClick above
                                    disabled={isRunning}
                                    className="sr-only"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Deliverables */}
                <div className="form-section">
                    <label className="form-label">Deliverables</label>
                    <div className="grid grid-cols-2 gap-4">
                        {deliverableOptions.map((option) => (
                            <div
                                key={option.id}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${formData.deliverables.includes(option.id)
                                    ? 'border-green-400 bg-green-500/20 shadow-lg shadow-green-500/25'
                                    : 'border-white/20 bg-white/5 hover:border-green-300 hover:bg-white/10'
                                    }`}
                                onClick={() => !isRunning && handleDeliverablesChange(option.id)}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${formData.deliverables.includes(option.id)
                                        ? 'border-green-400 bg-green-400'
                                        : 'border-white/40'
                                        }`}>
                                        {formData.deliverables.includes(option.id) && (
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="text-2xl">{option.icon}</span>
                                    <span className="text-sm font-medium text-white">{option.label}</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formData.deliverables.includes(option.id)}
                                    onChange={() => { }} // Handled by onClick above
                                    disabled={isRunning}
                                    className="sr-only"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Priority */}
                <div className="form-section">
                    <label className="form-label">Priority Level</label>
                    <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleInputChange}
                        disabled={isRunning}
                        className="w-full px-6 py-4 rounded-2xl glass-input text-white text-base appearance-none bg-no-repeat bg-right-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0xIDFMNiA2TDExIDEiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+')]"
                    >
                        <option value="low">Low Priority</option>
                        <option value="normal">Normal Priority</option>
                        <option value="high">High Priority</option>
                    </select>
                </div>

                {/* Submit/Cancel Button */}
                <div className="pt-6">
                    {!isRunning ? (
                        <button
                            type="submit"
                            disabled={!formData.topic.trim()}
                            className="w-full flex items-center justify-center space-x-3 px-8 py-5 btn-primary rounded-2xl font-semibold text-lg shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Play size={22} />
                            <span>Start Research</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onCancel(currentJobId)}
                            className="w-full flex items-center justify-center space-x-3 px-8 py-5 btn-danger rounded-2xl font-semibold text-lg shadow-xl"
                        >
                            <Square size={22} />
                            <span>Stop Research</span>
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default ResearchForm;