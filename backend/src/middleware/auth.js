// Simple auth middleware - can be enhanced later
const auth = (req, res, next) => {
    // For now, just pass through
    // TODO: Implement proper authentication when needed
    next();
};

module.exports = auth;