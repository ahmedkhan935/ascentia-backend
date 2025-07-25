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
      // Find the tutor profile for the current user
      const tutor = await TutorProfile.findOne({ user: req.user._id });
      
      if (!tutor) {
        return res.status(404).json({
          message: "Tutor profile not found",
          status: "Error",
        });
      }
  
      // Get all classes that belong to this tutor
      const classes = await Class.find({ tutor: tutor._id });
      
      if (classes.length === 0) {
        return res.status(200).json({ 
          sessions: [], 
          status: "success",
          message: "No classes found for this tutor" 
        });
      }
  
      // Extract class IDs
      const classIds = classes.map(cls => cls._id);
  
      // Find sessions that belong to these classes only
      const sessions = await ClassSession.find({ 
        class: { $in: classIds } 
      })
      .populate({
        path: "class",
        populate: [
          {
            path: "students.id",
            select: "firstName lastName email phone"
          },
          {
            path: "allocatedRoom",
            select: "name"
          }
        ],
      })
      .populate({
        path: "attendance.student",
        select: "firstName lastName"
      })
      .sort({ createdAt: -1 }); // Sort by newest first
  
      // Create flattened response
      const flattenedSessions = sessions.map(session => {
        const sessionObj = session.toObject();
        
        // Filter bookings for this specific class
        let roomBookings = [];
        if (sessionObj.class?.allocatedRoom?.bookings) {
          const sessionClassId = sessionObj.class._id.toString();
          roomBookings = sessionObj.class.allocatedRoom.bookings.filter(booking => {
            return booking.class.toString() === sessionClassId;
          });
        }
  
        // Flatten students array
        const students = sessionObj.class?.students?.map(student => ({
          studentId: student.id._id,
          firstName: student.id.firstName,
          lastName: student.id.lastName,
          email: student.id.email,
          phone: student.id.phone,
        })) || [];
  
        // Return flattened structure
        return {
          sessionId: sessionObj._id,
          classId: sessionObj.class._id,
          subject: sessionObj.class.subject,
          type: sessionObj.class.type,
          sessionType: sessionObj.class.sessionType,
          status: sessionObj.class.status,
          classCap: sessionObj.class.classCap,
          startDate: sessionObj.class.startDate,
          endDate: sessionObj.class.endDate,
          
          // Room details
          roomId: sessionObj.class.allocatedRoom?._id,
          roomName: sessionObj.class.allocatedRoom?.name,
          
          // Session details
          sessionDate: sessionObj.date,
          sessionStartTime: sessionObj.startTime,
          sessionEndTime: sessionObj.endTime,
          sessionStatus: sessionObj.status,
          markedCompletedByTutor: sessionObj.markedCompletedByTutor,
          
          // ADD THESE LINES - Include the marking flags
          markCancelByTutor: sessionObj.markCancelByTutor || false,
          markRescheduleByTutor: sessionObj.markRescheduleByTutor || false,
          
          // Students and attendance
          students: students,
          attendance: sessionObj.attendance || []
        };
      });
  
      res.status(200).json({ 
        sessions: flattenedSessions, 
        status: "success",
        total: flattenedSessions.length 
      });
      
    } catch (error) {
      console.error('Error fetching tutor sessions:', error);
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
          // Set markCancelByTutor to true
          session.markCancelByTutor = true;
          await session.save();
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
          // Set markRescheduleByTutor to true
          sessionToReschedule.markRescheduleByTutor = true;
          await sessionToReschedule.save();

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
      // Fetch all requests as before
      const requests = await Request.find({ user: req.user._id })
        .populate("tutor")
        .populate("sessionId")
        .populate({
          path: "classId",
          populate: {
            path: "students.id",
            select: "firstName lastName email phone"
          }
        })
        .sort({ createdAt: -1 });

      // Flatten and transform requests
      const flattenedRequests = requests.map(request => {
        let session = request.sessionId;
        let classData = request.classId;
        let type = request.type;
        // Only use the request's own status
        let requestStatus = request.status; // Only 'pending', 'accepted', 'rejected'
        let sessionStatus = session?.status; // Session status if needed
        // Flatten students with all details
        const students = classData?.students?.map(student => ({
          studentId: student.id._id,
          firstName: student.id.firstName,
          lastName: student.id.lastName,
          email: student.id.email,
          phone: student.id.phone,
        })) || [];
        // Compose base object
        const base = {
          id: request._id,
          type,
          status: requestStatus, // Only pending/accepted/rejected
          sessionStatus,         // Show session status separately if needed
          createdAt: request.createdAt,
          reason: request.reason,
          subject: classData?.subject || request.subject || "Unknown Subject",
          sessionId: session?._id,
          classId: classData?._id,
          sessionDate: session?.date,
          sessionStartTime: session?.startTime,
          sessionEndTime: session?.endTime,
          students,
        };
        // Add extra fields for reschedule
        if (type === 'session_reschedule') {
          base.newSession = request.newSession;
        }
        // Add extra fields for shift
        if (type === 'shift_reschedule') {
          base.shift = request.shift;
        }
        return base;
      });

      // Now, also fetch sessions marked as completed by tutor and pending admin approval
      const tutor = await TutorProfile.findOne({ user: req.user._id });
      let markCompleteRequests = [];
      if (tutor) {
        // Get all classes for this tutor
        const classes = await Class.find({ tutor: tutor._id });
        const classIds = classes.map(cls => cls._id);
        // Find sessions marked as completed by tutor and either pending, completed, rejected, or cancelled
        const sessions = await ClassSession.find({
          class: { $in: classIds },
          markedCompletedByTutor: true,
          status: { $in: ['pending', 'completed', 'rejected', 'cancelled'] },
        })
        .populate({
          path: "class",
          populate: [
            {
              path: "students.id",
              select: "firstName lastName email phone"
            },
            {
              path: "allocatedRoom",
              select: "name"
            }
          ],
        });
        // Flatten these sessions as mark_complete requests
        markCompleteRequests = sessions.map(session => {
          const classObj = session.class;
          const students = classObj?.students?.map(student => ({
            studentId: student.id._id,
            firstName: student.id.firstName,
            lastName: student.id.lastName,
            email: student.id.email,
            phone: student.id.phone,
          })) || [];
          // Map session status to request status
          let requestStatus = 'pending';
          if (session.status === 'completed') requestStatus = 'accepted';
          else if (session.status === 'rejected' || session.status === 'cancelled') requestStatus = 'rejected';
          else if (session.status === 'pending') requestStatus = 'pending';
          const result = {
            id: session._id,
            type: 'mark_complete',
            status: requestStatus, 
            sessionStatus: session.status,
            createdAt: session.updatedAt || session.createdAt,
            subject: classObj?.subject || "Unknown Subject",
            classId: classObj?._id,
            sessionId: session._id,
            sessionDate: session.date,
            sessionStartTime: session.startTime,
            sessionEndTime: session.endTime,
            students,
          };
          if (session.status === 'cancelled' && session.cancellationReason) {
            result.cancellationReason = session.cancellationReason;
          }
          return result;
        });
      }

      // Merge and sort all requests by createdAt desc
      const allRequests = [...flattenedRequests, ...markCompleteRequests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.status(200).json({
        status: "success",
        requests: allRequests,
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  },

  getCancellationRequests: async (req, res) => {
    try {
      const requests = await Request.find({ 
        user: req.user._id,
        type: "session_cancel"
      })
        .populate("sessionId")
        .populate("classId")
        .populate({
          path: "classId",
          populate: {
            path: "students.id",
            select: "firstName lastName email phone"
          }
        })
        .sort({ createdAt: -1 });

      // Transform the data to match frontend expectations
      const transformedRequests = requests.map(request => {
        const session = request.sessionId;
        const classData = request.classId;
        // Only use the request's own status
        let requestStatus = request.status; // Only 'pending', 'accepted', 'rejected'
        let sessionStatus = session?.status; // Session status if needed
        return {
          id: request._id,
          sessionId: request.sessionId?._id,
          classId: request.classId?._id,
          subject: classData?.subject || "Unknown Subject",
          sessionDate: session?.date,
          sessionStartTime: session?.startTime,
          sessionEndTime: session?.endTime,
          reason: request.reason,
          status: requestStatus, // Only pending/accepted/rejected
          sessionStatus,         // Show session status separately if needed
          createdAt: request.createdAt,
          type: "cancellation",
          students: classData?.students?.map(student => ({
            studentId: student.id._id,
            firstName: student.id.firstName,
            lastName: student.id.lastName,
            email: student.id.email,
            phone: student.id.phone,
          })) || []
        };
      });

      res.status(200).json({
        status: "success",
        requests: transformedRequests,
      });
    } catch (error) {
      console.error("Error fetching cancellation requests:", error);
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  },

  getRescheduleRequests: async (req, res) => {
    try {
      const requests = await Request.find({ 
        user: req.user._id,
        type: "session_reschedule"
      })
        .populate("sessionId")
        .populate("classId")
        .populate({
          path: "classId",
          populate: {
            path: "students.id",
            select: "firstName lastName email phone"
          }
        })
        .populate("newSession.room")
        .sort({ createdAt: -1 });

      // Transform the data to match frontend expectations
      const transformedRequests = requests.map(request => {
        const session = request.sessionId;
        const classData = request.classId;
        // Only use the request's own status
        let requestStatus = request.status; // Only 'pending', 'accepted', 'rejected'
        let sessionStatus = session?.status; // Session status if needed
        return {
          id: request._id,
          sessionId: request.sessionId?._id,
          classId: request.classId?._id,
          subject: classData?.subject || "Unknown Subject",
          sessionDate: session?.date,
          sessionStartTime: session?.startTime,
          sessionEndTime: session?.endTime,
          reason: request.reason,
          newSession: request.newSession,
          status: requestStatus, // Only pending/accepted/rejected
          sessionStatus,         // Show session status separately if needed
          createdAt: request.createdAt,
          type: "reschedule",
          students: classData?.students?.map(student => ({
            studentId: student.id._id,
            firstName: student.id.firstName,
            lastName: student.id.lastName,
            email: student.id.email,
            phone: student.id.phone,
          })) || []
        };
      });

      res.status(200).json({
        status: "success",
        requests: transformedRequests,
      });
    } catch (error) {
      console.error("Error fetching reschedule requests:", error);
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
              markedCompletedByTutor: false,
              markCancelByTutor: false // reset the flag
            });
            const newActivity = new Activity({
              name: "Session Cancelled",
              description: `Session cancel request accepted for session on ${request.date} from ${request.startTime} to ${request.endTime}`,
              tutorId: req.user._id,
            });
            await newActivity.save();
            break;

          case "session_reschedule":
            // Update the existing session instead of creating a new one
            await ClassSession.findByIdAndUpdate(request.sessionId, {
              date: request.newSession.date,
              startTime: request.newSession.startTime,
              endTime: request.newSession.endTime,
              room: request.newSession.room || undefined,
              sessionType: request.newSession.sessionType,
              status: "rescheduled", // set status to rescheduled
              markedCompletedByTutor: false,
              markRescheduleByTutor: false // reset the flag
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
            await ClassSession.findByIdAndUpdate(request.sessionId, {
              markCancelByTutor: false,
              status: "scheduled"
            });
            const newActivity = new Activity({
              name: "Session Cancel Request Rejected",
              description: `Session cancel request was rejected for session on ${request.date} from ${request.startTime} to ${request.endTime}`,
              tutorId: req.user._id,
            });
            await newActivity.save();
            break;
          case "session_reschedule":
            await ClassSession.findByIdAndUpdate(request.sessionId, {
              markRescheduleByTutor: false,
              status: "scheduled"
            });
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
      session.status = "pending"; //mark session as completed
      session.markedCompletedByTutor = true;
      await session.save();
      const newActivity = new Activity({
        name: "Session Completed. Waiting for admin approval",
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
      if (!tutor) {
        return res.status(404).json({ status: "error", message: "Tutor profile not found" });
      }
      // Build query for teacher payouts
      const query = {
        user: req.user._id,
        type: "Payout"
      };
      // Optionally filter by classId and classSessionId if provided
      if (req.query.classId) {
        query.classId = req.query.classId;
      }
      if (req.query.sessionId) {
        query.classSessionId = req.query.sessionId;
      }
      const payments = await Payment.find(query)
        .populate({
          path: "classId",
          populate: {
            path: "students.id",
            model: "User",
            select: "firstName lastName"
          }
        })
        .populate("classSessionId", "date startTime endTime")
        .sort({ createdAt: -1 });
      // Format response
      const formatted = payments.map(payment => {
        // Flatten class details
        const classObj = payment.classId || {};
        // Flatten students array
        const students = (classObj.students || []).map(s => s.id && typeof s.id === 'object' ? {
          name: `${s.id.firstName} ${s.id.lastName}`
        } : null).filter(Boolean);
        return {
          paymentId: payment._id,
          amount: payment.amount,
          status: payment.status,
          createdAt: payment.createdAt,
          reason: payment.reason,
          // Class details (flattened)
          classSubject: classObj.subject,
          classType: classObj.type,
          sessionType: classObj.sessionType,
          startDate: classObj.startDate,
          endDate: classObj.endDate,
          allocatedRoom: classObj.allocatedRoom,
          // Session details
          sessionDate: payment.classSessionId?.date,
          sessionStartTime: payment.classSessionId?.startTime,
          sessionEndTime: payment.classSessionId?.endTime,
          // Students (array of flattened student objects)
          students
        };
      });
      res.status(200).json({ payments: formatted, status: "success" });
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
      const tutor = await TutorProfile.findOne({ user: tutorId }).populate("user");
      if (!tutor) {
        return res.status(404).json({
          status: "failed",
          message: "Tutor not found",
        });
      }
  
      // Get all classes for this tutor
      const classes = await Class.find({ tutor: tutor._id });
      const classIds = classes.map((c) => c._id);
  
      // Get all sessions for this tutor
      const sessions = await ClassSession.find({ class: { $in: classIds } });
  
      // Get all payments (only completed payouts for earnings) - use tutor.user (User's _id)
      const payments = await Payment.find({ user: tutor.user, type: "Payout", status: "completed" });
  
      // Helper: get start of today, week, month
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
  
      // --- Hours Calculation (from sessions) - CORRECTED ---
      // Only count sessions that are scheduled, completed, rescheduled (not cancelled)
      const validSessionStatuses = ["scheduled", "completed", "rescheduled"];
      const sessionsForHours = sessions.filter(s => validSessionStatuses.includes(s.status));
  
      function getSessionDuration(session) {
        if (!session.startTime || !session.endTime) return 0;
        const [sh, sm] = session.startTime.split(":").map(Number);
        const [eh, em] = session.endTime.split(":").map(Number);
        return (eh + em / 60) - (sh + sm / 60);
      }
  
      // Calculate hours for each time period separately
      let dailyHours = 0, weeklyHours = 0, monthlyHours = 0;
  
      // Daily hours - sessions scheduled for today
      const todaySessions = sessionsForHours.filter(session => {
        const sessionDate = new Date(session.date);
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        return sessionDate >= startOfDay && sessionDate < endOfDay;
      });
      dailyHours = todaySessions.reduce((total, session) => total + getSessionDuration(session), 0);
  
      // Weekly hours - sessions scheduled this week
      const weekSessions = sessionsForHours.filter(session => {
        const sessionDate = new Date(session.date);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return sessionDate >= startOfWeek && sessionDate < endOfWeek;
      });
      weeklyHours = weekSessions.reduce((total, session) => total + getSessionDuration(session), 0);
  
      // Monthly hours - sessions scheduled this month
      const monthSessions = sessionsForHours.filter(session => {
        const sessionDate = new Date(session.date);
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);
        return sessionDate >= startOfMonth && sessionDate <= endOfMonth;
      });
      monthlyHours = monthSessions.reduce((total, session) => total + getSessionDuration(session), 0);
  
      // --- Earnings Calculation ---
      let dailyEarning = 0, weeklyEarning = 0, monthlyEarning = 0, totalEarnings = 0;
      payments.forEach(payment => {
        const created = new Date(payment.createdAt);
        totalEarnings += payment.amount || 0;
        if (created >= startOfDay) dailyEarning += payment.amount || 0;
        if (created >= startOfWeek) weeklyEarning += payment.amount || 0;
        if (created >= startOfMonth) monthlyEarning += payment.amount || 0;
      });
  
      // --- Attendance Overview (per student) ---
      // Map: studentId -> { present, absent, total }
      const attendanceOverview = {};
      sessions.forEach(session => {
        (session.attendance || []).forEach(a => {
          const sid = a.student.toString();
          if (!attendanceOverview[sid]) attendanceOverview[sid] = { present: 0, absent: 0, total: 0 };
          if (a.status === "present") attendanceOverview[sid].present++;
          else if (a.status === "absent") attendanceOverview[sid].absent++;
          attendanceOverview[sid].total++;
        });
      });
      
      // Attach student info
      const studentIdSet = new Set(classes.flatMap(c => c.students.map(s => s.id.toString())));
      const studentInfoMap = {};
      const students = await User.find({ _id: { $in: Array.from(studentIdSet) } });
      students.forEach(stu => {
        studentInfoMap[stu._id.toString()] = {
          firstName: stu.firstName,
          lastName: stu.lastName,
          email: stu.email,
          phone: stu.phone,
        };
      });
      const attendanceOverviewArr = Object.entries(attendanceOverview).map(([sid, stats]) => ({
        studentId: sid,
        ...studentInfoMap[sid],
        ...stats
      }));
  
      // --- Session Counts ---
      const totalSessions = sessions.length;
      const completedSessions = sessions.filter(s => s.status === "completed").length;
      const rescheduledSessions = sessions.filter(s => s.status === "rescheduled").length;
      const cancelledSessions = sessions.filter(s => s.status === "cancelled").length;
  
      // --- Session Overview (status breakdown) ---
      const sessionOverview = sessions.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {});
  
      // --- Attendance Data for Charts ---
      
      // Last 7 days attendance data
      const sessionsByDate = sessions.reduce((acc, session) => {
        const date = new Date(session.date).toISOString().split("T")[0];
        const presentCount = session.attendance?.filter((a) => a.status === "present").length || 0;
        const absentCount = session.attendance?.filter((a) => a.status === "absent").length || 0;
        const totalCount = presentCount + absentCount;
        
        if (!acc[date]) {
          acc[date] = {
            date,
            present: presentCount,
            absent: absentCount,
            total: totalCount,
            attendanceRate: totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : 0
          };
        } else {
          acc[date].present += presentCount;
          acc[date].absent += absentCount;
          acc[date].total += totalCount;
          acc[date].attendanceRate = acc[date].total > 0 ? 
            ((acc[date].present / acc[date].total) * 100).toFixed(1) : 0;
        }
        return acc;
      }, {});
      
      const attendanceData = Object.values(sessionsByDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-7); // Last 7 days
  
      // Weekly attendance trends (last 4 weeks)
      const weeklyAttendanceData = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(startOfWeek);
        weekStart.setDate(startOfWeek.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59);
        
        const weekSessions = sessions.filter(session => {
          const sessionDate = new Date(session.date);
          return sessionDate >= weekStart && sessionDate <= weekEnd;
        });
        
        const weekPresent = weekSessions.reduce((sum, session) => 
          sum + (session.attendance?.filter(a => a.status === "present").length || 0), 0);
        const weekAbsent = weekSessions.reduce((sum, session) => 
          sum + (session.attendance?.filter(a => a.status === "absent").length || 0), 0);
        const weekTotal = weekPresent + weekAbsent;
        
        weeklyAttendanceData.push({
          week: `Week ${4 - i}`,
          weekStart: weekStart.toISOString().split("T")[0],
          weekEnd: weekEnd.toISOString().split("T")[0],
          present: weekPresent,
          absent: weekAbsent,
          total: weekTotal,
          attendanceRate: weekTotal > 0 ? ((weekPresent / weekTotal) * 100).toFixed(1) : 0
        });
      }
  
      // Monthly attendance summary (last 6 months)
      const monthlyAttendanceData = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        
        const monthSessions = sessions.filter(session => {
          const sessionDate = new Date(session.date);
          return sessionDate >= monthStart && sessionDate <= monthEnd;
        });
        
        const monthPresent = monthSessions.reduce((sum, session) => 
          sum + (session.attendance?.filter(a => a.status === "present").length || 0), 0);
        const monthAbsent = monthSessions.reduce((sum, session) => 
          sum + (session.attendance?.filter(a => a.status === "absent").length || 0), 0);
        const monthTotal = monthPresent + monthAbsent;
        
        monthlyAttendanceData.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          monthStart: monthStart.toISOString().split("T")[0],
          monthEnd: monthEnd.toISOString().split("T")[0],
          present: monthPresent,
          absent: monthAbsent,
          total: monthTotal,
          attendanceRate: monthTotal > 0 ? ((monthPresent / monthTotal) * 100).toFixed(1) : 0
        });
      }
  
      // Overall attendance statistics
      const overallAttendanceStats = {
        totalPresent: sessions.reduce((sum, session) => 
          sum + (session.attendance?.filter(a => a.status === "present").length || 0), 0),
        totalAbsent: sessions.reduce((sum, session) => 
          sum + (session.attendance?.filter(a => a.status === "absent").length || 0), 0),
      };
      overallAttendanceStats.totalRecords = overallAttendanceStats.totalPresent + 
        overallAttendanceStats.totalAbsent;
      overallAttendanceStats.overallAttendanceRate = overallAttendanceStats.totalRecords > 0 ? 
        ((overallAttendanceStats.totalPresent / overallAttendanceStats.totalRecords) * 100).toFixed(1) : 0;
  
      // Student attendance ranking (for performance insights)
      const studentAttendanceRanking = attendanceOverviewArr
        .map(student => ({
          ...student,
          attendanceRate: student.total > 0 ? ((student.present / student.total) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => parseFloat(b.attendanceRate) - parseFloat(a.attendanceRate))
        .slice(0, 10); // Top 10 students by attendance
  
      // --- Tutor Shifts ---
      const tutorShifts = tutor.shifts || [];
  
      res.status(200).json({
        status: "success",
        data: {
          totalClasses: classes.length,
          totalStudents: studentIdSet.size,
          totalSessions,
          completedSessions,
          rescheduledSessions,
          cancelledSessions,
          sessionOverview,
          weeklyHours: weeklyHours.toFixed(1),
          dailyHours: dailyHours.toFixed(1),
          monthlyHours: monthlyHours.toFixed(1),
          totalEarnings,
          dailyEarning,
          weeklyEarning,
          monthlyEarning,
          attendanceOverview: attendanceOverviewArr,
          weeklyAttendanceData, // Last 4 weeks attendance trends
          monthlyAttendanceData, // Last 6 months attendance summary
          overallAttendanceStats, // Overall attendance statistics
          studentAttendanceRanking, // Top 10 students by attendance rate
          tutorShifts,
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
  getTutorClasses: async (req, res) => {
    try {
      const tutor = await TutorProfile.findOne({ user: req.user._id });
      if (!tutor) {
        return res.status(404).json({ status: "error", message: "Tutor profile not found" });
      }
  
      // Find all classes for this tutor and populate students and allocatedRoom
      const classes = await Class.find({ tutor: tutor._id })
        .populate({
          path: "students.id",
          select: "firstName lastName email phone"
        })
        .populate({
          path: "allocatedRoom",
          select: "name capacity"
        });
  
      // Get session counts for each class
      const classIds = classes.map(cls => cls._id);
      const sessionCounts = await ClassSession.aggregate([
        { $match: { class: { $in: classIds } } },
        { $group: { _id: "$class", count: { $sum: 1 } } }
      ]);
  
      // Create a map for quick lookup
      const sessionCountMap = sessionCounts.reduce((acc, item) => {
        acc[item._id.toString()] = item.count;
        return acc;
      }, {});
  
      // Create flattened response
      const flattenedClasses = classes.map(classObj => {
        const classData = classObj.toObject();
        
        // Filter bookings for this specific class
        let roomBookings = [];
        if (classData.allocatedRoom?.bookings) {
          const classId = classData._id.toString();
          roomBookings = classData.allocatedRoom.bookings.filter(booking => {
            return booking.class.toString() === classId;
          });
        }
  
        // Flatten students array
        const students = classData.students?.map(student => ({
          studentId: student.id._id,
          firstName: student.id.firstName,
          lastName: student.id.lastName,
          email: student.id.email,
          phone: student.id.phone,
        })) || [];
  
        // Get actual session count for this class
        const sessionCount = sessionCountMap[classData._id.toString()] || 0;
  
        // Return flattened structure
        return {
          classId: classData._id,
          subject: classData.subject,
          type: classData.type,
          sessionType: classData.sessionType,
          status: classData.status,
          classCap: classData.classCap,
          startDate: classData.startDate,
          endDate: classData.endDate,
          
          // Room details (only for our-space classes)
          roomId: classData.allocatedRoom?._id || null,
          roomName: classData.allocatedRoom?.name || null,
          roomCapacity: classData.allocatedRoom?.capacity || null,
          
          // Students
          students: students,
          
          // Counts for quick reference
          totalStudents: students.length,
          totalSessions: sessionCount
        };
      });
  
      res.status(200).json({ 
        status: "success", 
        classes: flattenedClasses,
        total: flattenedClasses.length 
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  },
  cancelSession: async (req, res) => {
    try {
      const { classId, sessionId, reason } = req.body;
      const user = req.user;
  
      // Validate tutor existence
      const tutor = await TutorProfile.findOne({ user: user._id });
      if (!tutor) {
        return res
          .status(404)
          .json({ status: "error", message: "Tutor profile not found" });
      }
  
      // Validate required fields
      if (!sessionId) {
        return res
          .status(400)
          .json({ status: "error", message: "Session ID is required" });
      }
  
      // Find and validate session
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
      // Set markCancelByTutor to true
      session.markCancelByTutor = true;
      await session.save();
  
      // Create request data
      const requestData = {
        user: user._id,
        type: "session_cancel",
        tutor: tutor._id,
        classId,
        reason,
        sessionId,
        message: "Class cancellation request for " + session.date.toDateString(),
        subject: "Class cancellation",
      };
  
      // Create activity log
      const newActivity = new Activity({
        name: "Session Cancel Request",
        description: "Requested to cancel session.",
        tutorId: user._id,
      });
      await newActivity.save();
  
      // Create and save the request
      const request = new Request(requestData);
      await request.save();
  
      res.status(200).json({
        status: "success",
        message: "Session cancellation request sent successfully",
        request,
      });
    } catch (error) {
      console.error("Error in cancelSession:", error);
      res.status(500).json({
        status: "error",
        message: error.message || "Internal server error",
      });
    }
  },
  
  // Session Rescheduling Function
  rescheduleSession: async (req, res) => {
    try {
      const { classId, sessionId, reason, newSession } = req.body;
      const user = req.user;
  
      // Validate tutor existence
      const tutor = await TutorProfile.findOne({ user: user._id });
      if (!tutor) {
        return res
          .status(404)
          .json({ status: "error", message: "Tutor profile not found" });
      }
  
      // Validate required fields
      if (!sessionId || !newSession) {
        return res.status(400).json({
          status: "error",
          message: "Session ID and new session details are required",
        });
      }
  
      // Find and validate session
      const sessionToReschedule = await ClassSession.findById(sessionId);
      if (!sessionToReschedule) {
        return res
          .status(400)
          .json({ status: "error", message: "Session not found" });
      }
      // Set markRescheduleByTutor to true
      sessionToReschedule.markRescheduleByTutor = true;
      await sessionToReschedule.save();
  
      // Check room availability for new session time
      if (newSession.room) {
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
      }
  
      // Create request data
      const requestData = {
        user: user._id,
        type: "session_reschedule",
        tutor: tutor._id,
        classId,
        reason,
        sessionId,
        newSession: {
          ...newSession,
          sessionType: newSession.sessionType || sessionToReschedule.sessionType
        },
        oldSession: {
          date: sessionToReschedule.date,
          startTime: sessionToReschedule.startTime,
          endTime: sessionToReschedule.endTime,
          room: sessionToReschedule.room,
          sessionType: sessionToReschedule.sessionType
        },
        message: `Session reschedule from ${sessionToReschedule.startTime} - ${sessionToReschedule.endTime} to ${newSession.startTime} - ${newSession.endTime}`,
        subject: `Session reschedule request for ${sessionToReschedule.date} to ${newSession.date}`,
      };
  
      // Create activity log
      const newActivity = new Activity({
        name: "Session Reschedule Request",
        description: "Requested to reschedule session.",
        tutorId: user._id,
      });
      await newActivity.save();
  
      // Create and save the request
      const request = new Request(requestData);
      await request.save();
  
      res.status(200).json({
        status: "success",
        message: "Session reschedule request sent successfully",
        request,
      });
    } catch (error) {
      console.error("Error in rescheduleSession:", error);
      res.status(500).json({
        status: "error",
        message: error.message || "Internal server error",
      });
    }
  },
  
  // Shift Rescheduling Function
  rescheduleShift: async (req, res) => {
    try {
      const { classId, reason, shift, oldShiftId } = req.body;
      const user = req.user;
  
      // Validate tutor existence
      const tutor = await TutorProfile.findOne({ user: user._id });
      if (!tutor) {
        return res
          .status(404)
          .json({ status: "error", message: "Tutor profile not found" });
      }
  
      // Validate shift details
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
  
      // Helper function to convert time to minutes
      const convertTimeToMinutes = (timeString) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
      };
  
      // Check for conflicts with existing shifts
      const hasShiftConflict = tutor.shifts.some((existingShift) => {
        if (existingShift._id.toString() === oldShiftId) return false;
  
        if (existingShift.dayOfWeek === shift.dayOfWeek) {
          // Convert times to minutes for easier comparison
          const existingStart = convertTimeToMinutes(existingShift.startTime);
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
          message: "This shift conflicts with an existing availability slot",
        });
      }
  
      // Create base request data
      const requestData = {
        user: user._id,
        type: "shift_reschedule",
        tutor: tutor._id,
        classId,
        reason,
        shift,
      };
  
      // Handle old shift validation and messaging
      if (oldShiftId) {
        const oldShift = tutor.shifts.id(oldShiftId);
        if (!oldShift) {
          return res
            .status(400)
            .json({ status: "error", message: "Old shift not found" });
        }
  
        if (oldShift.dayOfWeek != shift.dayOfWeek) {
          return res.status(400).json({
            status: "error",
            message: "Please request the change for same day.",
          });
        }
  
        requestData.oldShiftId = oldShiftId;
        requestData.message = `Shift reschedule from ${oldShift.startTime} - ${oldShift.endTime} to ${shift.startTime} - ${shift.endTime}`;
        requestData.subject = `Shift reschedule request for ${oldShift.dayOfWeek}`;
      } else {
        requestData.message = `Shift addition for ${shift.startTime} - ${shift.endTime}`;
        requestData.subject = `Shift addition for ${shift.dayOfWeek}`;
      }
  
      // Create activity log
      const newActivity = new Activity({
        name: "Shift Reschedule Request",
        description: "Requested to reschedule shift.",
        tutor: user._id,
      });
      await newActivity.save();
  
      // Create and save the request
      const request = new Request(requestData);
      await request.save();
  
      res.status(200).json({
        status: "success",
        message: "Shift reschedule request sent successfully",
        request,
      });
    } catch (error) {
      console.error("Error in rescheduleShift:", error);
      res.status(500).json({
        status: "error",
        message: error.message || "Internal server error",
      });
    }
  },
};

module.exports = tutorController;
