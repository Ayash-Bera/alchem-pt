import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { jobsAPI } from '../services/api';

const JobResult = () => {
    const { jobId } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);

    useEffect(() => {
        const fetchJob = async () => {
            try {
                const response = await jobsAPI.getJob(jobId);
                setJob(response.data.job);
            } catch (error) {
                console.error('Error fetching job:', error);
            }
        };
        fetchJob();
    }, [jobId]);

    if (!job) return <div className="container py-16">Loading...</div>;

    return (
        <div className="container py-16">
            <button onClick={() => navigate('/dashboard')} className="mb-6 glass px-4 py-2 rounded-lg">
                ← Back to Dashboard
            </button>

            <div className="glass p-8 rounded-3xl">
                <h1 className="text-3xl font-bold mb-6">{job.data?.topic}</h1>

                {job.result?.deliverables && Object.entries(job.result.deliverables).map(([key, content]) => (
                    <div key={key} className="mb-8">
                        <h2 className="text-xl font-semibold mb-4 capitalize">{key}</h2>
                        <div className="prose prose-invert max-w-none">
                            <ReactMarkdown>
                                {typeof content === 'object' ? content.content : content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default JobResult;