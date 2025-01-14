const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    action: { 
        type: String, 
        required: true,
        enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']
    },
    entityType: { 
        type: String, 
        required: true,
        enum: ['USER', 'FAMILY', 'CLASS', 'BOOKING', 'PAYMENT', 'CREDIT', 'TUTOR']
    },
    entityId: mongoose.Schema.Types.ObjectId,
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
        type: Date,
        default: Date.now
    },
    ipAddress: String,
    userAgent: String
});

const Log = mongoose.model('Log', logSchema);
module.exports = Log;