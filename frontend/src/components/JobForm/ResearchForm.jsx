import React, { useState } from 'react';
import { Play, Square } from 'lucide-react';

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

    return (
        <div className="glass p-8 rounded-2xl">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Deep Research Agent</h2>
                <p className="text-gray-300">Configure your AI-powered research parameters</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Topic Input */}
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-200">
                        Research Topic
                    </label>
                    <textarea
                        name="topic"
                        value={formData.topic}
                        onChange={handleInputChange}
                        disabled={isRunning}
                        placeholder="Enter your research topic..."
                        className="w-full px-4 py-4 rounded-xl resize-none text-white placeholder-gray-400 text-base leading-relaxed"
                        rows={3}
                        required
                    />
                </div>

                {/* Research Depth */}
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-200">
                        Research Depth
                    </label>
                    <select
                        name="researchDepth"
                        value={formData.researchDepth}
                        onChange={handleInputChange}
                        disabled={isRunning}
                        className="w-full px-4 py-4 rounded-xl text-white text-base"
                    >
                        <option value="shallow">Shallow (~15 min)</option>
                        <option value="medium">Medium (~30 min)</option>
                        <option value="deep">Deep (~45 min)</option>
                    </select>
                </div>

                {/* Deliverables */}
                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-200">
                        Deliverables
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {['summary', 'report', 'recommendations', 'citations'].map(deliverable => (
                            <label
                                key={deliverable}
                                className="flex items-center space-x-3 p-4 rounded-xl glass-strong hover:bg-white/10 transition-all duration-200 cursor-pointer group"
                            >
                                <input
                                    type="checkbox"
                                    checked={formData.deliverables.includes(deliverable)}
                                    onChange={() => handleDeliverablesChange(deliverable)}
                                    disabled={isRunning}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm font-medium text-gray-200 capitalize group-hover:text-white transition-colors">
                                    {deliverable}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-200">
                        Priority
                    </label>
                    <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleInputChange}
                        disabled={isRunning}
                        className="w-full px-4 py-4 rounded-xl text-white text-base"
                    >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                    </select>
                </div>

                {/* Submit/Cancel Button */}
                <div className="pt-4">
                    {!isRunning ? (
                        <button
                            type="submit"
                            disabled={!formData.topic.trim()}
                            className="w-full flex items-center justify-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl transition-all duration-300 font-semibold text-lg shadow-xl"
                        >
                            <Play size={20} />
                            <span>Start Research</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onCancel(currentJobId)}
                            className="w-full flex items-center justify-center space-x-3 px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl transition-all duration-300 font-semibold text-lg shadow-xl"
                        >
                            <Square size={20} />
                            <span>Stop Research</span>
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
};

export default ResearchForm;