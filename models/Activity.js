const mongoose = require('mongoose');
const ClassSession = require('./ClassSession');
const activitySchema = new mongoose.Schema({
    name: {
        type: String,
        
    },
    description: {
        type: String,
        
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        
    },
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        
    },

    classSessionId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClassSession',

    },
    createdAt:{
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const Activity = mongoose.model('Activity', activitySchema);
module.exports = Activity;



