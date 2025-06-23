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
                    <div className="space-y-3">
                        {depthOptions.map((option) => (
                            <label
                                key={option.value}
                                className={`block p-4 rounded-xl border transition-all cursor-pointer ${formData.researchDepth === option.value
                                    ? 'border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                                    : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
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
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-white">{option.label}</div>
                                        <div className="text-sm text-gray-300">{option.description}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-blue-400">{option.time}</div>
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Deliverables */}
                <div className="form-section">
                    <label className="form-label">Deliverables</label>
                    <div className="deliverables-grid">
                        {deliverableOptions.map((option) => (
                            <label
                                key={option.id}
                                className={`deliverable-item ${formData.deliverables.includes(option.id) ? 'selected' : ''
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="checkbox"
                                        checked={formData.deliverables.includes(option.id)}
                                        onChange={() => handleDeliverablesChange(option.id)}
                                        disabled={isRunning}
                                        className="custom-checkbox"
                                    />
                                    <span className="text-2xl">{option.icon}</span>
                                    <span className="text-sm font-medium text-white">{option.label}</span>
                                </div>
                            </label>
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
                        className="w-full px-6 py-4 rounded-2xl glass-input text-white text-base"
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