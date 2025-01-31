const User = require("../../models/User");
const { createLog } = require("../../middleware/logger");
const Family = require("../../models/Family");
const Class = require("../../models/Class");
const bcrypt = require("bcryptjs");
const Payment = require("../../models/Payment");
const ClassSession = require("../../models/ClassSession");
const TutorProfile = require("../../models/Tutor");
const Request = require("../../models/Request");

function convertTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") {
    throw new Error("Invalid time string format");
  }

  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(timeStr)) {
    throw new Error("Time must be in HH:MM format");
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}
const tutorController = {
  getTutorSessions: async (req, res) => {
    try {
      const tutor = await TutorProfile.findOne({ user: req.user._id });
      const classes = await Class.find({ tutor: tutor._id });
      const sessions = await ClassSession.find({ class: { $in: classes } })
        .populate({
          path: "class",
          populate: {
            path: "students.id",
          },
        })
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
  addTutorRequest: async (req, res) => {
    try {
      const {
        classId,
        sessionId,
        reason,
        type,
        shift,
        newSession,
        oldShiftId,
      } = req.body;
      const user = req.user;

      // Validate tutor existence
      const tutor = await TutorProfile.findOne({ user: user._id });
      if (!tutor) {
        return res
          .status(404)
          .json({ status: "error", message: "Tutor profile not found" });
      }

      // Base request object
      const requestData = {
        user: user._id,
        type,
        tutor: tutor._id,
        classId,
        reason,
      };

      // Handle different request types
      switch (type) {
        case "shift_reschedule":
          if (
            !shift ||
            shift.dayOfWeek == null ||
            !shift.startTime ||
            !shift.endTime
          ) {
            return res
              .status(400)
              .json({
                status: "error",
                message: "Complete shift details are required",
              });
          }

          // Check for conflicts with existing shifts
          const hasShiftConflict = tutor.shifts.some((existingShift) => {
            if (existingShift._id.toString() === oldShiftId) return false;

            if (existingShift.dayOfWeek === shift.dayOfWeek) {
              // Convert times to minutes for easier comparison
              const existingStart = convertTimeToMinutes(
                existingShift.startTime
              );
              const existingEnd = convertTimeToMinutes(existingShift.endTime);
              const newStart = convertTimeToMinutes(shift.startTime);
              const newEnd = convertTimeToMinutes(shift.endTime);

              // Check for overlap
              return newStart < existingEnd && newEnd > existingStart;
            }
            return false;
          });

          if (hasShiftConflict) {
            return res.status(400).json({
              status: "error",
              message:
                "This shift conflicts with an existing availability slot",
            });
          }

          if (oldShiftId) {
            const oldShift = tutor.shifts.id(oldShiftId);
            if (!oldShift) {
              return res
                .status(400)
                .json({ status: "error", message: "Old shift not found" });
            }
            requestData.oldShiftId = oldShiftId;
            if (oldShift.dayOfWeek != shift.dayOfWeek) {
              return res
                .status(400)
                .json({
                  status: "error",
                  message: "Please request the change for same day.",
                });
            }
            requestData.message = `Shift reschedule from ${oldShift.startTime} - ${oldShift.endTime} to ${shift.startTime} - ${shift.endTime}`;
            requestData.subject = `Shift reschedule request for ${oldShift.dayOfWeek}`;
          } else {
            requestData.message = `Shift addition for ${shift.startTime} - ${shift.endTime}`;
            requestData.subject = `Shift addition for ${shift.dayOfWeek}`;
          }

          requestData.shift = shift;
          break;

        case "session_cancel":
          if (!sessionId) {
            return res
              .status(400)
              .json({ status: "error", message: "Session ID is required" });
          }

          const session = await ClassSession.findById(sessionId);
          if (!session) {
            return res
              .status(400)
              .json({ status: "error", message: "Session not found" });
          }

          if (session.status !== "scheduled") {
            return res.status(400).json({
              status: "error",
              message: "Can only cancel scheduled sessions",
            });
          }
          requestData.message =
            "Class cancellation request for " + session.date.toDateString();
          requestData.subject = "Class cancellation";
          requestData.sessionId = sessionId;
          break;

        case "session_reschedule":
          if (!sessionId || !newSession) {
            return res.status(400).json({
              status: "error",
              message: "Session ID and new session details are required",
            });
          }

          const sessionToReschedule = await ClassSession.findById(sessionId);
          if (!sessionToReschedule) {
            return res
              .status(400)
              .json({ status: "error", message: "Session not found" });
          }

          // Validate if the room is available for the new session time
          const roomConflict = await ClassSession.findOne({
            room: newSession.room,
            date: newSession.date,
            $or: [
              {
                startTime: { $lt: newSession.endTime },
                endTime: { $gt: newSession.startTime },
              },
            ],
            _id: { $ne: sessionId },
          });

          if (roomConflict) {
            return res.status(400).json({
              status: "error",
              message: "Room is not available at the requested time",
            });
          }

          requestData.sessionId = sessionId;
          requestData.newSession = newSession;
          requestData.oldSession = {
            date: sessionToReschedule.date,
            startTime: sessionToReschedule.startTime,
            endTime: sessionToReschedule.endTime,
            room: sessionToReschedule.room,
          };
          requestData.message = `Session reschedule from ${sessionToReschedule.startTime} - ${sessionToReschedule.endTime} to ${newSession.startTime} - ${newSession.endTime}`;
          requestData.subject = `Session reschedule request for ${sessionToReschedule.date.toDateString()} to ${newSession.date.toDateString()}`;
          break;

        default:
          return res
            .status(400)
            .json({ status: "error", message: "Invalid request type" });
      }
      console.log(requestData);

      // Create and save the request
      const request = new Request(requestData);
      await request.save();

      res.status(200).json({
        status: "success",
        message: "Request sent successfully",
        request,
      });
    } catch (error) {
      console.error("Error in addTutorRequest:", error);
      res.status(500).json({
        status: "error",
        message: error.message || "Internal server error",
      });
    }
  },

  getTutorRequests: async (req, res) => {
    try {
      const requests = await Request.find({ user: req.user._id })
        .populate("tutor")
        .populate("sessionId")

        .sort({ createdAt: -1 });

      res.status(200).json({
        status: "success",
        requests,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  },

  updateRequestStatus: async (req, res) => {
    try {
      const { requestId } = req.params;
      const { status } = req.body;

      const request = await Request.findById(requestId);
      if (!request) {
        return res.status(404).json({
          status: "error",
          message: "Request not found",
        });
      }

      request.status = status;
      await request.save();

      // If request is approved, handle the corresponding action
      if (status === "accepted") {
        switch (request.type) {
          case "shift_reschedule":
            const tutor = await TutorProfile.findById(request.tutor);
            if (request.oldShiftId) {
              // Remove old shift
              tutor.shifts = tutor.shifts.filter(
                (shift) => shift._id.toString() !== request.oldShiftId
              );
            }
            // Add new shift
            tutor.shifts.push(request.shift);
            await tutor.save();
            break;

          case "session_cancel":
            await ClassSession.findByIdAndUpdate(request.sessionId, {
              status: "cancelled",
              cancelledBy: req.user._id,
              cancelledAt: new Date(),
              cancellationReason: request.message,
            });
            break;

          case "session_reschedule":
            await ClassSession.findByIdAndUpdate(request.sessionId, {
              ...request.newSession,
              status: "rescheduled",
            });
            break;
        }
      }

      res.status(200).json({
        status: "success",
        message: "Request status updated",
        request,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  },
  getTutorShifts: async (req, res) => {
    try {
      const tutor = await TutorProfile.findOne({ user: req.user._id });
      res.status(200).json({ data: tutor, status: "success" });
    } catch (error) {
      res.status(500).json({
        message: "Error fetching shifts",
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
