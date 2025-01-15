// models/Tutor.js
const mongoose = require('mongoose');
const { timeRangeOverlap } = require('../utils/timeUtils');

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
        photo: Buffer,
        phone: String,
        address: {
            street: String,
            city: String,
            state: String,
            postalCode: String
        }
    },
    education: {
        university: String,
        degree: String,
        graduationDate: Date,
        major: String,
        city: String
    },
    workExperience: [{
        company: String,
        position: String,
        period: {
            start: Date,
            end: Date
        },
        description: String
    }],
    subjects: [{
        name: String,
        
        isActive: { type: Boolean, default: true }
    }],
    grade:String,
    classCategories: [{
        type: String,
        enum: ['K-6', '7-10', '11-12']
    }],
    qualifications: [{
        degree: String,
        institution: String,
        year: Number,
        document: Buffer
    }],
    shifts: [{
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
    }],
    scheduleExceptions: [scheduleExceptionSchema],
    hourlyRate: {
        type: Number,
        min: 0
    },
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
    preferences: {
        maxWeeklyHours: { type: Number, default: 40 },
        preferredSubjects: [String],
        preferredLevels: [String],
        notes: String
    },
    assignedBlogs:Number,
    publishedBlogs:Number,
    
    
}, {
    timestamps: true
});

// Methods for schedule management
tutorProfileSchema.methods.isAvailable = async function(date, startTime, endTime) {
    // Check if date has an exception
    const exception = this.scheduleExceptions.find(ex => 
        ex.date.toDateString() === date.toDateString()
    );

    if (exception) {
        if (exception.type === 'unavailable') return false;
        if (exception.type === 'modified') {
            return !timeRangeOverlap(
                startTime, 
                endTime, 
                exception.modifiedSchedule.startTime, 
                exception.modifiedSchedule.endTime
            );
        }
    }

    // Check default schedule
    const dayOfWeek = date.getDay();
    const defaultScheduleForDay = this.defaultSchedule.find(s => 
        s.dayOfWeek === dayOfWeek
    );

    if (!defaultScheduleForDay) return false;

    return !timeRangeOverlap(
        startTime, 
        endTime, 
        defaultScheduleForDay.startTime, 
        defaultScheduleForDay.endTime
    );
};

tutorProfileSchema.methods.getScheduleForWeek = async function(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const schedule = [];
    let currentDate = new Date(startDate);

    while (currentDate < endDate) {
        const daySchedule = {
            date: new Date(currentDate),
            shifts: []
        };

        // Check for exceptions
        const exception = this.scheduleExceptions.find(ex => 
            ex.date.toDateString() === currentDate.toDateString()
        );

        if (exception) {
            if (exception.type === 'modified') {
                daySchedule.shifts.push({
                    startTime: exception.modifiedSchedule.startTime,
                    endTime: exception.modifiedSchedule.endTime,
                    isException: true
                });
            }
        } else {
            // Get default schedule for this day
            const defaultShifts = this.defaultSchedule.filter(s => 
                s.dayOfWeek === currentDate.getDay()
            );
            daySchedule.shifts = defaultShifts.map(shift => ({
                startTime: shift.startTime,
                endTime: shift.endTime,
                isException: false
            }));
        }

        schedule.push(daySchedule);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return schedule;
};

// Validations
tutorProfileSchema.pre('save', function(next) {
    // Validate schedule times
    this.shifts.forEach(schedule => {
        const start = schedule.startTime.split(':').map(Number);
        const end = schedule.endTime.split(':').map(Number);
        
        if (start[0] > end[0] || (start[0] === end[0] && start[1] >= end[1])) {
            throw new Error('End time must be after start time');
        }
    });

    next();
});

const TutorProfile = mongoose.model('TutorProfile', tutorProfileSchema);
module.exports = TutorProfile;