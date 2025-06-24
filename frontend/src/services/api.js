import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://34.68.86.10:8080/api';
console.log('🌐 API Base URL:', API_BASE_URL);

// Create axios instance with default configuration
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000, // 60 seconds for long-running operations
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor for logging and authentication
api.interceptors.request.use(
    (config) => {
        const fullUrl = `${config.baseURL}${config.url}`;
        console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${fullUrl}`);
        console.log('Request config:', {
            method: config.method,
            url: fullUrl,
            timeout: config.timeout,
            headers: config.headers
        });
        return config;
    },
    (error) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
    },
    (error) => {
        console.error('API Response Error:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: error.config?.url,
            data: error.response?.data
        });

        // Handle specific error cases
        if (error.response?.status === 401) {
            // Handle unauthorized access
            console.warn('Unauthorized access - redirecting to login');
        } else if (error.response?.status >= 500) {
            // Handle server errors
            console.error('Server error - please try again later');
        }

        return Promise.reject(error);
    }
);

// Job Management API endpoints
export const jobsAPI = {
    // Create a new job
    createJob: (jobData) => {
        return api.post('/jobs', jobData);
    },

    // Get all jobs with optional filtering
    getJobs: (params = {}) => {
        return api.get('/jobs', { params });
    },

    // Get specific job by ID
    getJob: (id) => {
        return api.get(`/jobs/${id}`);
    },

    // Get job progress/status
    getJobProgress: (id) => {
        return api.get(`/jobs/${id}/progress`);
    },

    // Cancel a job
    cancelJob: (id) => {
        return api.delete(`/jobs/${id}`);
    },

    // Retry a failed job
    retryJob: (id) => {
        return api.post(`/jobs/${id}/retry`);
    },

    // Get job statistics
    getJobStats: (timeRange = '24h') => {
        return api.get('/jobs/stats/overview', { params: { timeRange } });
    },

    // Get system status
    getSystemStatus: () => {
        return api.get('/jobs/system-status');
    },

    // Clear all jobs (development utility)
    clearAllJobs: () => {
        return api.post('/jobs/clear-all');
    },

    // Get job types information
    getJobTypes: () => {
        return api.get('/jobs/types/info');
    },

    // Bulk operations
    bulkCancelJobs: (jobIds) => {
        return api.post('/jobs/bulk-cancel', { jobIds });
    },

    // Get job logs
    getJobLogs: (id) => {
        return api.get(`/jobs/${id}/logs`);
    }
};

// Metrics and Analytics API endpoints
export const metricsAPI = {
    // Get concurrency metrics
    getConcurrencyMetrics: () => {
        return api.get('/metrics/concurrency');
    },

    // Get cost metrics
    getCostMetrics: (timeRange = '24h') => {
        return api.get('/metrics/costs', { params: { timeRange } });
    },

    // Get performance metrics
    getPerformanceMetrics: (timeRange = '24h') => {
        return api.get('/metrics/performance', { params: { timeRange } });
    },

    // Get system metrics
    getSystemMetrics: () => {
        return api.get('/metrics/system');
    },

    // Get dashboard metrics (aggregated)
    getDashboardMetrics: () => {
        return api.get('/metrics/dashboard');
    },

    // Get job-specific metrics
    getJobMetrics: (jobId) => {
        return api.get(`/metrics/jobs/${jobId}`);
    },

    // Get cost breakdown by job type
    getCostBreakdown: (timeRange = '24h') => {
        return api.get('/metrics/costs/breakdown', { params: { timeRange } });
    },

    // Get performance trends
    getPerformanceTrends: (timeRange = '7d') => {
        return api.get('/metrics/performance/trends', { params: { timeRange } });
    },

    // Get usage analytics
    getUsageAnalytics: (timeRange = '30d') => {
        return api.get('/metrics/usage', { params: { timeRange } });
    }
};

// Health and System Status API endpoints
export const healthAPI = {
    // Basic health check
    getHealth: () => {
        return api.get('/health');
    },

    // Detailed health check
    getDetailedHealth: () => {
        return api.get('/health/detailed');
    },

    // Test Alchemyst API connection
    testAlchemyst: () => {
        return api.get('/health/alchemyst-test');
    },

    // Readiness probe
    getReadiness: () => {
        return api.get('/health/ready');
    },

    // Liveness probe
    getLiveness: () => {
        return api.get('/health/live');
    },

    // Get system information
    getSystemInfo: () => {
        return api.get('/health/system');
    }
};

// Research and Analysis API endpoints
export const researchAPI = {
    // Create deep research job
    createDeepResearch: (data) => {
        return api.post('/jobs', {
            type: 'deep-research',
            data
        });
    },

    // Create GitHub analysis job
    createGitHubAnalysis: (data) => {
        return api.post('/jobs', {
            type: 'github-analysis',
            data
        });
    },

    // Create document summary job
    createDocumentSummary: (data) => {
        return api.post('/jobs', {
            type: 'document-summary',
            data
        });
    },

    // Get research templates
    getResearchTemplates: () => {
        return api.get('/research/templates');
    },

    // Validate research topic
    validateTopic: (topic) => {
        return api.post('/research/validate', { topic });
    },

    // Get research suggestions
    getResearchSuggestions: (query) => {
        return api.get('/research/suggestions', { params: { query } });
    }
};

// File and Upload API endpoints
export const fileAPI = {
    // Upload file for processing
    uploadFile: (file, type = 'document') => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        return api.post('/files/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            timeout: 120000 // 2 minutes for file uploads
        });
    },

    // Get file status
    getFileStatus: (fileId) => {
        return api.get(`/files/${fileId}/status`);
    },

    // Download processed file
    downloadFile: (fileId) => {
        return api.get(`/files/${fileId}/download`, {
            responseType: 'blob'
        });
    },

    // Delete file
    deleteFile: (fileId) => {
        return api.delete(`/files/${fileId}`);
    }
};

// User and Settings API endpoints
export const userAPI = {
    // Get user preferences
    getPreferences: () => {
        return api.get('/user/preferences');
    },

    // Update user preferences
    updatePreferences: (preferences) => {
        return api.put('/user/preferences', preferences);
    },

    // Get usage statistics
    getUsageStats: (timeRange = '30d') => {
        return api.get('/user/usage', { params: { timeRange } });
    },

    // Get API key information
    getApiKeyInfo: () => {
        return api.get('/user/api-key');
    }
};

// Notifications API endpoints
export const notificationsAPI = {
    // Get notifications
    getNotifications: (params = {}) => {
        return api.get('/notifications', { params });
    },

    // Mark notification as read
    markAsRead: (notificationId) => {
        return api.put(`/notifications/${notificationId}/read`);
    },

    // Mark all notifications as read
    markAllAsRead: () => {
        return api.put('/notifications/read-all');
    },

    // Delete notification
    deleteNotification: (notificationId) => {
        return api.delete(`/notifications/${notificationId}`);
    },

    // Get notification settings
    getSettings: () => {
        return api.get('/notifications/settings');
    },

    // Update notification settings
    updateSettings: (settings) => {
        return api.put('/notifications/settings', settings);
    }
};

// Utility functions
export const apiUtils = {
    // Check if API is available
    checkConnection: async () => {
        try {
            await healthAPI.getHealth();
            return true;
        } catch (error) {
            console.error('API connection check failed:', error);
            return false;
        }
    },

    // Get API status
    getApiStatus: async () => {
        try {
            const response = await healthAPI.getDetailedHealth();
            return {
                connected: true,
                status: response.data.status,
                services: response.data.services
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    },

    // Format error message for user display
    formatError: (error) => {
        if (error.response?.data?.error) {
            return error.response.data.error;
        } else if (error.message) {
            return error.message;
        } else {
            return 'An unexpected error occurred';
        }
    },

    // Retry failed request
    retryRequest: async (requestFunction, maxRetries = 3, delay = 1000) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await requestFunction();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }
};

// Export default api instance for custom requests
export default api;