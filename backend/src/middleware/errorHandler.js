const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    logger.error('Error occurred:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Default error response
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorDetails = null;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = 'Validation error';
        errorDetails = err.message;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorMessage = 'Unauthorized';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        errorMessage = 'Forbidden';
    } else if (err.name === 'NotFoundError') {
        statusCode = 404;
        errorMessage = 'Resource not found';
    } else if (err.code === 'ECONNREFUSED') {
        statusCode = 503;
        errorMessage = 'Service unavailable';
        errorDetails = 'Database or external service connection failed';
    } else if (err.code === 'ENOTFOUND') {
        statusCode = 503;
        errorMessage = 'Service unavailable';
        errorDetails = 'External service not found';
    } else if (err.message) {
        errorMessage = err.message;
    }

    // Prepare response
    const errorResponse = {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        path: req.path
    };

    // Add details in development mode
    if (process.env.NODE_ENV === 'development') {
        errorResponse.details = errorDetails || err.message;
        errorResponse.stack = err.stack;
    } else if (errorDetails) {
        errorResponse.details = errorDetails;
    }

    res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;