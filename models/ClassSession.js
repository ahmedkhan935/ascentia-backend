const mongoose = require("mongoose");
const classSessionSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  status: {
    type: String,
    enum: ["scheduled", "completed", "cancelled", "rescheduled","pending"],
    default: "scheduled",
  },
  sessionCost: { 
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
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
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
const ClassSession = mongoose.model("ClassSession", classSessionSchema);
module.exports = ClassSession;
