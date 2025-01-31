const User = require("../../models/User");
const { createLog } = require("../../middleware/logger");
const Family = require("../../models/Family");
const Class = require("../../models/Class");
const bcrypt = require("bcryptjs");
const Payment = require("../../models/Payment");
const TutorProfile = require("../../models/Tutor");
const ClassSession = require("../../models/ClassSession");
const tutorController = {
  getTutorSessions: async (req, res) => {
    try {
      const classes = await Class.find({ tutor: req.user._id });
      const sessions = await ClassSession.find({ class: { $in: classes } })
        .populate("class")
        .populate("room");

      res.status(200).json({ sessions, status: "success" });
    } catch (error) {
      res.status(500).json({
        message: "Error fetching sessions",
        error: error.message,
        status: "Error",
      });
    }
  },
  //route to mark session as completed
  markSessionCompleted: async (req, res) => {
    try {
      const session = await ClassSession.findById(req.params.id);
      if (!session) {
        return res.status(404).json({
          message: "Session not found",
          status: "Error",
        });
      }
      session.status = "completed"; //mark session as completed
      await session.save();
      res.status(200).json({ session, status: "success" });
    } catch (error) {
      res.status(500).json({
        message: "Error marking session as completed",
        error: error.message,
        status: "Error",
      });
    }
  },
  //mark student as present
  markStudentPresent: async (req, res) => {
    try {
      const session = await ClassSession.findById(req.params.id);
      const attendanceStatus = req.body.attendance;
      const studentId = req.body.student;
      console.log(attendanceStatus);
      if (!session) {
        return res.status(404).json({
          message: "Session not found",
          status: "Error",
        });
      }
      const student = await User.findById(studentId);
      if (!student) {
        return res.status(404).json({
          message: "Student not found",
          status: "Error",
        });
      }
      const attendance = session.attendance.find(
        (a) => a.student.toString() === student._id.toString()
      );
      if (attendance) {
        attendance.status = attendanceStatus;
      } else {
        session.attendance.push({
          student: student._id,
          status: attendanceStatus,
          markedBy: req.user._id,
          markedAt: new Date(),
        });
      }
      await session.save();
      res.status(200).json({ session, status: "success" });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        message: "Error marking student as present",
        error: error.message,
        status: "Error",
      });
    }
  },
};
module.exports = tutorController;
