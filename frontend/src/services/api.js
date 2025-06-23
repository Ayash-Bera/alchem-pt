import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://35.209.5.151:8080/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

export const jobsAPI = {
    createJob: (jobData) => api.post('/jobs', jobData),
    getJobs: (params = {}) => api.get('/jobs', { params }),
    getJob: (id) => api.get(`/jobs/${id}`),
    getJobProgress: (id) => api.get(`/jobs/${id}/progress`),
    cancelJob: (id) => api.delete(`/jobs/${id}`),
    retryJob: (id) => api.post(`/jobs/${id}/retry`),
    getJobStats: (timeRange = '24h') => api.get('/jobs/stats/overview', { params: { timeRange } }),
    getSystemStatus: () => api.get('/jobs/system-status'),
    clearAllJobs: () => api.post('/jobs/clear-all')
};

export const metricsAPI = {
    getConcurrencyMetrics: () => api.get('/metrics/concurrency'),
    getCostMetrics: (timeRange = '24h') => api.get('/metrics/costs', { params: { timeRange } }),
    getPerformanceMetrics: (timeRange = '24h') => api.get('/metrics/performance', { params: { timeRange } }),
    getSystemMetrics: () => api.get('/metrics/system'),
    getDashboardMetrics: () => api.get('/metrics/dashboard')
};

export const healthAPI = {
    getHealth: () => api.get('/health'),
    getDetailedHealth: () => api.get('/health/detailed'),
    testAlchemyst: () => api.get('/health/alchemyst-test')
};

export default api;