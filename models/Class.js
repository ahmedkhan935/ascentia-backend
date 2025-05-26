const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
  type: { type: String, enum: ["individual", "group"], required: true },
  subject: { type: String, required: true },
  sessionType: { 
    type: String, 
    enum: ["online", "our-space", "student-place"], 
    required: true,
    default: "our-space"
  },
  sessions: {
    type: [{
      dayOfWeek: Number,
      startTime: String,
      endTime: String,
      recurrence: {
        type: String,
        enum: ["weekly", "fortnightly", "one-off"],
        default: "weekly"
      },
      isTrial: {
        type: Boolean,
        default: false
      },
      organizingCost: {
        type: Number,
        default: 0
      },
      teacherPayout: {
        type: Number,
        default: 0
      },
      specificDate: Date // For one-off sessions
    }]
  },
  allocatedRoom: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Room",
    required: function() {
      return this.sessionType === 'our-space';
    }
  },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: "TutorProfile", required: true },
  students: [{
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pricePerSession: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["paid", "pending"], default: "pending" }
  }],
  status: {
    type: String,
    enum: ["active", "cancelled", "completed"],
    default: "active",
  },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
});

const Class = mongoose.model("Class", classSchema);
module.exports = Class;