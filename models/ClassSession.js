const mongoose = require("mongoose");

const classSessionSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  sessionType: { 
    type: String, 
    enum: ["online", "our-space", "student-place"], 
    required: true,
    default: "our-space"
  },
  status: {
    type: String,
    enum: ["scheduled", "completed", "cancelled", "rescheduled", "pending"],
    default: "scheduled",
  },
  organizingCost: {
    type: Number,
    default: 0
  },
  teacherPayout: {
    type: Number,
    default: 0
  },
  totalStudentRevenue: {
    type: Number,
    default: 0
  },
  attendance: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { type: String, enum: ["present", "absent", "excused"] },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      markedAt: Date,
    },
  ],
  feedback: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      date: { type: Date, default: Date.now },
      understanding: { type: String },
      pacing: { type: String },
      difficulty: { type: String },
    },
  ],
  // Fixed room field - only add if sessionType is 'our-space'
  room: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Room",
    required: false, // Remove conditional required
    validate: {
      validator: function(value) {
        // Only validate if sessionType is 'our-space'
        if (this.sessionType === 'our-space') {
          return value != null; // Must have a value for our-space sessions
        }
        return true; // No validation needed for other session types
      },
      message: 'Room is required for our-space sessions'
    }
  },
  cancellationReason: String,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  cancelledAt: Date,
  rescheduledTo: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSession" },
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClassSession",
  },
  notes: String,
});

// Add pre-save middleware to clean up room field for non-our-space sessions
classSessionSchema.pre('save', function(next) {
  // Remove room field if sessionType is not 'our-space'
  if (this.sessionType !== 'our-space') {
    this.room = undefined;
  }
  next();
});

const ClassSession = mongoose.model("ClassSession", classSessionSchema);
module.exports = ClassSession;