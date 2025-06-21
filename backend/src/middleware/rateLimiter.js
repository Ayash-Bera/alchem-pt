const rateLimit = require('express-rate-limit');

// Basic rate limiting middleware
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
    return rateLimit({
        windowMs, // 15 minutes by default
        max, // limit each IP to max requests per windowMs
        message: {
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

module.exports = {
    defaultLimiter: createRateLimiter(),
    strictLimiter: createRateLimiter(15 * 60 * 1000, 20), // 20 requests per 15 min
    createRateLimiter
};