const TutorProfile = require("../../models/Tutor");
const Bonus = require("../../models/Bonus");
const Class = require("../../models/Class");
const User = require("../../models/User");
const Activity = require("../../models/Activity");
const ClassSession = require("../../models/ClassSession");

const studentController = {
  getAllTutors: async (req, res) => {
    try {
      const tutors = await TutorProfile.find().populate("user");

      res.status(200).json(tutors);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  getMyClasses: async (req, res) => {
    try {
      const studentId = req.user.id;

      // Get classes with their schedules and tutor info
      const classes = await Class.find({
        "students.id": studentId,
        status: "active",
      }).populate({
        path: "tutor",
        populate: {
          path: "user",
          select: "firstName lastName",
        },
      });

      // Get all class sessions for these classes
      const classSessions = await ClassSession.find({
        class: { $in: classes.map((c) => c._id) },
        date: { $gte: new Date() },
      })
        .sort({ date: 1 })
        .populate("room");

      // Format the response
      const formattedClasses = classes.map((classItem) => {
        // Find all sessions for this class
        const classSpecificSessions = classSessions.filter(
          (session) => session.class.toString() === classItem._id.toString()
        );

        // Get the next upcoming session
        const nextSession = classSpecificSessions[0];

        // Get the schedule (recurring sessions)
        const schedule = classItem.sessions.map((session) => ({
          dayOfWeek: session.dayOfWeek,
          startTime: session.startTime,
          endTime: session.endTime,
        }));

        // Format class sessions
        const formattedSessions = classSpecificSessions.map((session) => ({
          id: session._id,
          date: session.date,
          time: `${session.startTime} - ${session.endTime}`,
          status: session.status,
          feedback:
            session.feedback?.find((f) => f.student.toString() === studentId) ||
            null,
          room: session.room
            ? {
                id: session.room._id,
                name: session.room.name,
              }
            : null,
          attendance: session.attendance.find(
            (a) => a.student.toString() === studentId
          ),
          isCancelled: session.status === "cancelled",
          cancellationReason: session.cancellationReason,
          isRescheduled: session.status === "rescheduled",
          rescheduledTo: session.rescheduledTo,
          notes: session.notes,
        }));

        return {
          id: classItem._id,
          subject: classItem.subject,
          type: classItem.type,
          tutor: `${classItem.tutor.user.firstName} ${classItem.tutor.user.lastName}`,
          schedule, // Regular weekly schedule
          nextSession: nextSession
            ? {
                id: nextSession._id,
                date: nextSession.date,
                startTime: nextSession.startTime,
                endTime: nextSession.endTime,
                room: nextSession.room
                  ? {
                      id: nextSession.room._id,
                      name: nextSession.room.name,
                    }
                  : null,
                status: nextSession.status,
              }
            : null,
          sessions: formattedSessions, // Actual class sessions with attendance, feedback etc
          price:
            classItem.students.find((s) => s.id.toString() === studentId)
              ?.price || null,
          paymentStatus:
            classItem.students.find((s) => s.id.toString() === studentId)
              ?.paymentStatus || null,
          startDate: classItem.startDate,
          endDate: classItem.endDate,
        };
      });

      res.status(200).json(formattedClasses);
    } catch (error) {
      console.error("Error in getMyClasses:", error);
      res.status(500).json({ error: error.message });
    }
  },

  submitFeedback: async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { rating, comment, understanding, pacing, difficulty } = req.body;
      const studentId = req.user.id;

      const session = await ClassSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Remove any existing feedback from this student
      session.feedback = session.feedback.filter(
        (f) => f.student.toString() !== studentId
      );

      // Add new feedback
      session.feedback.push({
        student: studentId,
        rating,
        comment,
        understanding,
        pacing,
        difficulty,
        date: new Date(),
      });

      await session.save();
      res.status(200).json({ message: "Feedback submitted successfully" });
    } catch (error) {
      console.error("Error in submitFeedback:", error);
      res.status(500).json({ error: error.message });
    }
  },
  getStudentActivities : async (req, res) => {
    try {
      const studentId = req.user._id;
      const activities = await Activity.find({ studentId }).sort({ createdAt: -1 });
      res.status(200).json({status:'success',activities});
    } catch (error) {
      console.error("Error in getStudentActivities:", error);
      res.status(500).json({ error: error.message });
    }
  },
  getStudentSessions: async (req, res) => {
    try {
      const studentId = req.user._id;
      const classes = await Class.find({ "students" : { $elemMatch: { id: studentId } } });
      const sessions = await ClassSession.find({
        class: { $in: classes.map(c => c._id) },
        
      })
        .sort({ date: -1 })
        .populate({
          path: "class",
          populate: {
            path: "students.id",
          },
        })
        .populate("room");

      res.status(200).json({ status: "success", sessions });
    } catch (error) {
      console.error("Error in getStudentSessions:", error);
      res.status(500).json({ error: error.message });
    }
  }

};

module.exports = studentController;
