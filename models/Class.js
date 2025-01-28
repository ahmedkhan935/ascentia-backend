const mongoose = require("mongoose");
const classSchema = new mongoose.Schema({
  type: { type: String, enum: ["individual", "group"], required: true },
  subject: { type: String, required: true },
  price: {
    perClass: Number,
    Monthly: Number,
    TermWise: Number,
  },
  tutorPayout: {
    perClass: Number,
    Monthly: Number,
    TermWise: Number,
  },
  sessions:{type:[{
    dayOfWeek:Number,
    startTime:String,
    endTime:String,

  }]},
  allocatedRoom:{type:mongoose.Schema.Types.ObjectId,ref:"Room"},
  frequency: { type: String },


  tutor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  students: [{ type:{
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    price: Number,
    paymentStatus: { type: String, enum: ["paid", "pending"], default: "pending" },
  } }],
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
