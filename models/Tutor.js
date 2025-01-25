// models/Tutor.js
const mongoose = require('mongoose');

const scheduleExceptionSchema = new mongoose.Schema({
    date: { 
        type: Date, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['unavailable', 'modified'],
        required: true 
    },
    reason: String,
    modifiedSchedule: {
        startTime: String,
        endTime: String
    }
});

const tutorProfileSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    personalDetails: {
        dateOfBirth: Date,
        photoUrl: String,
    },
    education: {
        university: String,
        degree: String,
        graduationDate: Date,
        major: String,
        city: String
    },
    subjects: [
        String
        
    ],
    grade:String,
    classCategories: [{
        type: String,
        enum: ['K-6', '7-10', '11-12']
    }],
    qualifications: [{
        degree: String,
        institution: String,
        startDate: Date,
        endDate: Date
    }],
    shifts: {
        type:[{
        //0 is Sunday, 1 is Monday, 2 is Tuesday, etc.
        dayOfWeek: { 
            type: Number, 
            required: true,
            min: 0,
            max: 6
        },
        startTime: { 
            type: String, 
            required: true,
            match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
        },
        endTime: { 
            type: String, 
            required: true,
            match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
        }
    }],default:[]},
    scheduleExceptions: [scheduleExceptionSchema],
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    reviews: [{
        student: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        rating: { 
            type: Number, 
            min: 1, 
            max: 5 
        },
        comment: String,
        date: { 
            type: Date, 
            default: Date.now 
        }
    }],
    assignedBlogs:Number,
    publishedBlogs:Number,
    creditBalance:{
        type:Number,
        default:0
    },
    category:{
        type:String
    }
    
}, {
    timestamps: true
});

// Methods for schedule management

const TutorProfile = mongoose.model('TutorProfile', tutorProfileSchema);
module.exports = TutorProfile;