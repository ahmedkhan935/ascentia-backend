const User = require("../../models/User");
const { createLog } = require("../../middleware/logger");
const Family = require("../../models/Family");
const Class = require("../../models/Class");
const bcrypt = require("bcryptjs");
const Payment = require("../../models/Payment");
const ClassSession = require("../../models/ClassSession");
const TutorProfile = require("../../models/Tutor");
const Request = require("../../models/Request");
const Activity = require("../../models/Activity");
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
          console.log(shift);
          if (
            !shift ||
            shift.dayOfWeek == null ||
            !shift.startTime ||
            !shift.endTime
          ) {
            return res.status(400).json({
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
              return res.status(400).json({
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
          const newActivity = new Activity({
            name: "Shift Reschedule Request",
            description: `Requested to reschedule shift.`,
            tutor: user._id,
          });
          await newActivity.save();
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
          const newAcitivity2 = new Activity({
            name: "Session Cancel Request",
            description: `Requested to cancel session.`,
            tutorId: user._id,
          });
          await newAcitivity2.save();

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
          requestData.subject = `Session reschedule request for ${sessionToReschedule.date} to ${newSession.date}`;
          const newAcitivity = new Activity({
            name: "Session Reschedule Request",
            description: `Requested to reschedule session.`,
            tutorId: user._id,
          });
          await newAcitivity.save();
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
      console.log("Here");
      const requestId = req.params.id;
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
      if (status == "accepted") {
        switch (request.type) {
          case "shift_reschedule":
            const tutor = await TutorProfile.findById(request.tutor);
            if (request.oldShiftId) {
              const oldShift = tutor.shifts.id(request.oldShiftId);
              oldShift.dayOfWeek = request.shift.dayOfWeek;
              oldShift.startTime = request.shift.startTime;
              oldShift.endTime = request.shift.endTime;

              //modify the shift
            } else {
              tutor.shifts.push(request.shift);
            }
            const newAcitivity = new Activity({
              name: "Shift Reschedule Request Accepted",
              description: `Shift reschedule request was accepted for ${request.shift.dayOfWeek}`,
              tutorId: req.user._id,
            });
            await newAcitivity.save();

            // Add new shift

            await tutor.save();
            break;

          case "session_cancel":
            await ClassSession.findByIdAndUpdate(request.sessionId, {
              status: "cancelled",
              cancelledBy: req.user._id,
              cancelledAt: new Date(),
              cancellationReason: request.message,
            });
            const newActivity = new Activity({
              name: "Session Cancelled",
              description: `Session cancel request accepted for session on ${request.date} from ${request.startTime} to ${request.endTime}`,
              tutorId: req.user._id,
            });
            await newActivity.save();
            break;

          case "session_reschedule":
            //create the new session
            const newSession = new ClassSession({
              date: request.newSession.date,
              startTime: request.newSession.startTime,
              endTime: request.newSession.endTime,
              class: request.classId,
              status: "scheduled",
            });
            await newSession.save();
            await ClassSession.findByIdAndUpdate(request.sessionId, {
              rescheduledTo: newSession._id,
              status: "rescheduled",
            });

            const newActivity2 = new Activity({
              name: "Session Reschedule Request Accepted",
              description: `Session reschedule request was accepted for session on ${request.date} from ${request.startTime} to ${request.endTime}`,
              tutorId: req.user._id,
            });
            await newActivity2.save();

            break;
        }
      }
      if (status == "rejected") {
        switch (request.type) {
          case "shift_reschedule":
            const newAcitivity = new Activity({
              name: "Shift Reschedule Request Rejected",
              description: `Shift reschedule request was rejected for ${request.shift.dayOfWeek}`,
              tutorId: req.user._id,
            });
            await newAcitivity.save();
            break;
          case "session_cancel":
            const newActivity = new Activity({
              name: "Session Cancel Request Rejected",
              description: `Session cancel request was rejected for session on ${request.date} from ${request.startTime} to ${request.endTime}`,
              tutorId: req.user._id,
            });
            await newActivity.save();
            break;
          case "session_reschedule":
            const newActivity2 = new Activity({
              name: "Session Reschedule Request Rejected",
              description: `Session reschedule request was rejected for session on ${request.date} from ${request.startTime} to ${request.endTime}`,
              tutorId: req.user._id,
            });
            await newActivity2.save();
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
      const session = await ClassSession.findById(req.params.id).populate(
        "class"
      );
      if (!session) {
        return res.status(404).json({
          message: "Session not found",
          status: "Error",
        });
      }
      session.status = "completed"; //mark session as completed
      await session.save();
      const newActivity = new Activity({
        name: "Session Completed",
        description: `Session ${session.class.subject} for ${session.date} ${session.startTime} - ${session.endTime} marked as completed`,
        tutorId: req.user._id,
      });
      res.status(200).json({ session, status: "success" });
    } catch (error) {
      console.log(error);
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
      console.log("a", studentId);
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
  getPayments: async (req, res) => {
    try {
      const tutor = await TutorProfile.findOne({ user: req.user._id });
      const payments = await Payment.find({ user: tutor._id }).populate("user");
      res.status(200).json({ payments, status: "success" });
    } catch (error) {
      res.status(500).json({
        message: "Error fetching payments",
        error: error.message,
        status: "Error",
      });
    }
  },
  getTutorActivities: async (req, res) => {
    try {
      const activities = await Activity.find({ tutorId: req.user._id })
        .populate("studentId")
        .populate("tutorId")
        .populate("classId")
        .populate("classSessionId")
        .sort({ createdAt: -1 });
      res.json({ status: "success", activities });
    } catch (error) {
      res
        .status(500)
        .json({
          status: "failed",
          message: "Error fetching activities",
          error: error.message,
        });
    }
  },
  getStats: async (req, res) => {
    try {
      const tutorId = req.user._id;
      const tutor = await TutorProfile.findOne({ user: tutorId }).populate(
        "user"
      );

      if (!tutor) {
        return res.status(404).json({
          status: "failed",
          message: "Tutor not found",
        });
      }

      // Get all classes for this tutor
      const classes = await Class.find({ tutor: tutor._id });
      const classIds = classes.map((c) => c._id);

      // Get all sessions
      const sessions = await ClassSession.find({ class: { $in: classIds } });

      // Get all payments
      const payments = await Payment.find({ user: tutor._id });

      // Calculate total work hours from shifts
      const totalWorkHours =
        tutor.shifts?.reduce((total, shift) => {
          const [startHour, startMinute] = shift.startTime
            .split(":")
            .map(Number);
          const [endHour, endMinute] = shift.endTime.split(":").map(Number);
          const startTime = startHour + startMinute / 60;
          const endTime = endHour + endMinute / 60;
          return total + (endTime - startTime);
        }, 0) || 0;

      // Calculate total earnings
      const totalEarnings = payments.reduce((total, payment) => {
        return total + (payment.amount || 0);
      }, 0);

      // Calculate monthly earnings (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const monthlyEarnings = payments
        .filter((payment) => new Date(payment.createdAt) > thirtyDaysAgo)
        .reduce((total, payment) => total + (payment.amount || 0), 0);

      // Get total students count (unique students across all classes)
      const totalStudents = new Set(
        classes.flatMap((c) => c.students.map((s) => s.id.toString()))
      ).size;

      // Get recent activities
      const recentActivities = await Activity.find({ tutorId: tutorId })
        .sort({ createdAt: -1 })
        .limit(5);

      // Get attendance data for chart
      const sessionsByDate = sessions.reduce((acc, session) => {
        const date = new Date(session.date).toISOString().split("T")[0];
        const attendanceCount =
          session.attendance?.filter((a) => a.status === "present").length || 0;

        if (!acc[date]) {
          acc[date] = {
            date,
            attendance: attendanceCount,
            total: session.attendance?.length || 0,
          };
        } else {
          acc[date].attendance += attendanceCount;
          acc[date].total += session.attendance?.length || 0;
        }
        return acc;
      }, {});

      const attendanceData = Object.values(sessionsByDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-7); // Last 7 days

      res.status(200).json({
        status: "success",
        data: {
          totalClasses: classes.length,
          totalStudents,
          weeklyHours: totalWorkHours.toFixed(1),
          totalEarnings,
          monthlyEarnings,
          recentActivities,
          attendanceData,
          upcomingSessions: sessions.filter(
            (s) => new Date(s.date) > new Date() && s.status === "scheduled"
          ).length,
          completedSessions: sessions.filter((s) => s.status === "completed")
            .length,
        },
      });
    } catch (error) {
      res.status(500).json({
        status: "failed",
        message: "Error fetching tutor statistics",
        error: error.message,
      });
    }
  },
};

module.exports = tutorController;
