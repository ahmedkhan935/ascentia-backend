const mongoose = require('mongoose');
const classSessionSchema = new mongoose.Schema({
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
      default: 'scheduled'
    },
    attendance: [{
      student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['present', 'absent', 'excused'] },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      markedAt: Date,
    }],
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    cancellationReason: String,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    rescheduledTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassSession' },
    rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassSession' },
    notes: String,
  });
const ClassSession = mongoose.model('ClassSession', classSessionSchema);
module.exports = ClassSession;  