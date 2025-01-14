// middleware/logger.js
const Log = require('../models/Log');

const createLog = async (action, entityType, entityId, user, req, details = {}) => {
    try {
        const log = new Log({
            action,
            entityType,
            entityId,
            performedBy: user._id,
            details,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });
        await log.save();
    } catch (error) {
        console.error('Logging error:', error);
    }
};

module.exports = { createLog };