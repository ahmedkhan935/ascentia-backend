const mongoose = require('mongoose');
const classSchema = new mongoose.Schema({
    type: { type: String, enum: ['individual', 'group'], required: true },
    subject: { type: String, required: true },
    level: {
      grade: String, // e.g., "Year 7", "Year 12"
      subject: String,
    },
    price: {
      hourly: Number,
      monthly: Number,
      term: Number,
      yearly: Number,
    },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    maxStudents: { type: Number, default: 1 }, // 1 for individual, >1 for group
    schedule: {
      startDate: { type: Date, required: true },
      endDate: Date,
      recurringDays: [{
        dayOfWeek: Number,
        startTime: String,
        endTime: String,
      }],
      holidays: [{
        startDate: Date,
        endDate: Date,
        description: String,
      }],
    },
    status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
  });
const Class = mongoose.model('Class', classSchema);
module.exports = Class;  