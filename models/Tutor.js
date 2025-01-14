const mongoose = require('mongoose');
const tutorProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subjects: [{
      name: String,
      levels: [String], // e.g., ["Year 7", "Year 8"]
    }],
    qualifications: [{
      degree: String,
      institution: String,
      year: Number,
    }],
    experience: String,
    reviews: [{
      student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      date: { type: Date, default: Date.now },
    }],
    defaultSchedule: [{
      dayOfWeek: { type: Number, required: true }, // 0-6 (Sunday-Saturday)
      startTime: { type: String, required: true }, // HH:mm format
      endTime: { type: String, required: true },
    }],
    weeklyHours: { type: Number, default: 0 }, // To track minimum hours requirement
    hourlyRate: Number,
    active: { type: Boolean, default: true },
  });

const TutorProfile = mongoose.model('TutorProfile', tutorProfileSchema);
module.exports = TutorProfile;