const mongoose = require("mongoose");
const requestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
        type: String,
        enum: ["pending", "accepted", "rejected"],
        default: "pending",
    },
    reason:{type:String},
    createdAt: { type: Date, default: Date.now },
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: "TutorProfile" },
    type:String,
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSession" },
    shift:{
        dayOfWeek:Number,
        startTime:String,
        endTime:String,

    },
    newSession:{
        date: { type: Date },
        startTime: { type: String },
        endTime: { type: String },
        room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" }
    },
    oldSession:{
        date: { type: Date },
        startTime: { type: String },
        endTime: { type: String },
        room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" }
    },
    oldShiftId:{type:mongoose.Schema.Types.ObjectId}

});
const Request = mongoose.model("Request", requestSchema);
module.exports = Request;



