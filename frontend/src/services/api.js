// src/services/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
});

export const jobsAPI = {
    createJob: (jobData) => api.post('/jobs', jobData),
    getJobs: () => api.get('/jobs'),
    getJob: (id) => api.get(`/jobs/${id}`),
    cancelJob: (id) => api.delete(`/jobs/${id}`),
};

export const metricsAPI = {
    getConcurrencyMetrics: () => api.get('/metrics/concurrency'),
    getCostMetrics: () => api.get('/metrics/costs'),
    getPerformanceMetrics: () => api.get('/metrics/performance'),
};

export default api;