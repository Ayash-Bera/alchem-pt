import React, { useState } from 'react';
import { Play, Square, Loader2 } from 'lucide-react';

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
        <div className="glass p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-6">Deep Research Agent</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Topic Input */}
                <div>
                    <label className="block text-sm font-medium mb-2">Research Topic</label>
                    <textarea
                        name="topic"
                        value={formData.topic}
                        onChange={handleInputChange}
                        disabled={isRunning}
                        placeholder="Enter your research topic..."
                        className="w-full px-4 py-3 rounded-lg glass border border-white/20 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 resize-none text-white placeholder-gray-400"
                        rows={3}
                        required
                    />
                </div>

                {/* Research Depth */}
                <div>
                    <label className="block text-sm font-medium mb-2">Research Depth</label>
                    <select
                        name="researchDepth"
                        value={formData.researchDepth}
                        onChange={handleInputChange}
                        disabled={isRunning}
                        className="w-full px-4 py-3 rounded-lg glass border border-white/20 focus:border-blue-400 focus:outline-none text-white"
                    >
                        <option value="shallow">Shallow (~15 min)</option>
                        <option value="medium">Medium (~30 min)</option>
                        <option value="deep">Deep (~45 min)</option>
                    </select>
                </div>

                {/* Deliverables */}
                <div>
                    <label className="block text-sm font-medium mb-2">Deliverables</label>
                    <div className="grid grid-cols-2 gap-3">
                        {['summary', 'report', 'recommendations', 'citations'].map(deliverable => (
                            <label key={deliverable} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.deliverables.includes(deliverable)}
                                    onChange={() => handleDeliverablesChange(deliverable)}
                                    disabled={isRunning}
                                    className="rounded border-white/20 bg-transparent"
                                />
                                <span className="text-sm capitalize">{deliverable}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Priority */}
                <div>
                    <label className="block text-sm font-medium mb-2">Priority</label>
                    <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleInputChange}
                        disabled={isRunning}
                        className="w-full px-4 py-3 rounded-lg glass border border-white/20 focus:border-blue-400 focus:outline-none text-white"
                    >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                    </select>
                </div>

                {/* Submit/Cancel Buttons */}
                <div className="flex space-x-4">
                    {!isRunning ? (
                        <button
                            type="submit"
                            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        >
                            <Play size={18} />
                            <span>Start Research</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onCancel(currentJobId)}
                            className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
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