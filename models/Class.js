// Modified Class Schema to align with tutor shift patterns
const mongoose = require("mongoose");
const classSchema = new mongoose.Schema({
  type: { type: String, enum: ["individual", "group"], required: true },
  subject: { type: String, required: true },
  price: {
    perClass: Number,
    Monthly: Number,
    TermWise: Number,
  },
  tutorPayout: Number,
  sessionCosts: [{
    dayOfWeek: Number,
    cost: Number
  }],
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
      specificDate: Date // For one-off sessions
    }]
  },
  allocatedRoom: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: "TutorProfile", required: true },
  students: [{
    type: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      price: Number,
      paymentStatus: { type: String, enum: ["paid", "pending"], default: "pending" },
    }
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