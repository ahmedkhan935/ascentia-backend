const mongoose = require("mongoose");
const Class = require("../../models/Class");
const User = require("../../models/User");
const ClassSession = require("../../models/ClassSession");
const Room = require("../../models/Room");
const Payment = require("../../models/Payment");
const Tutor = require("../../models/Tutor");
const Activity = require("../../models/Activity");
const TutorProfile = require("../../models/Tutor");

// Helper function to check if a room is available for a specific time slot
async function checkRoomAvailability(roomId, date, startTime, endTime) {
  if (!roomId) return true; // If no room specified, consider it available

  const room = await Room.findById(roomId);
  if (!room) return false;

  // Check existing bookings for conflicts
  const conflictingBooking = room.bookings.find((booking) => {
    const sameDate =
      booking.date.toDateString() === new Date(date).toDateString();
    if (!sameDate) return false;

    // Convert times to minutes for easier comparison
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const [bookingStartHour, bookingStartMin] = booking.startTime
      .split(":")
      .map(Number);
    const [bookingEndHour, bookingEndMin] = booking.endTime
      .split(":")
      .map(Number);

    const sessionStart = startHour * 60 + startMin;
    const sessionEnd = endHour * 60 + endMin;
    const bookingStart = bookingStartHour * 60 + bookingStartMin;
    const bookingEnd = bookingEndHour * 60 + bookingEndMin;

    // Check for overlap
    return sessionStart < bookingEnd && sessionEnd > bookingStart;
  });

  return !conflictingBooking;
}

// Helper function to generate dates between start and end date for a specific day of week
function generateSessionDates(startDate, endDate, dayOfWeek) {
  const dates = [];
  let currentDate = new Date(startDate);

  // Ensure we're working with date objects
  const endDateTime = new Date(endDate);

  while (currentDate <= endDateTime) {
    if (currentDate.getDay() === parseInt(dayOfWeek)) {
      dates.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

// Helper function to check if a time falls within a shift
const isTimeWithinShift = (time, shiftStart, shiftEnd) => {
  const [timeHours, timeMinutes] = time.split(":").map(Number);
  const [startHours, startMinutes] = shiftStart.split(":").map(Number);
  const [endHours, endMinutes] = shiftEnd.split(":").map(Number);

  const timeValue = timeHours * 60 + timeMinutes;
  const startValue = startHours * 60 + startMinutes;
  const endValue = endHours * 60 + endMinutes;

  return timeValue >= startValue && timeValue <= endValue;
};

// Helper function to check tutor availability for a specific time slot
const checkTutorAvailability = async (tutorId, date, startTime, endTime) => {
  // Get all classes for this tutor on the given date
  const existingClasses = await Class.find({
    tutor: tutorId,
    status: "active",
  });

  // Get all sessions for these classes
  const existingSessions = await ClassSession.find({
    class: { $in: existingClasses.map((c) => c._id) },
    $expr: {
      $eq: [
        { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        { $dateToString: { format: "%Y-%m-%d", date: new Date(date) } },
      ],
    },
    status: { $in: ["scheduled"] },
  });

  // Check for time conflicts
  for (const session of existingSessions) {
    const sessionStart = session.startTime;
    const sessionEnd = session.endTime;

    // Convert all times to minutes for easier comparison
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const [sessionStartHour, sessionStartMin] = sessionStart
      .split(":")
      .map(Number);
    const [sessionEndHour, sessionEndMin] = sessionEnd.split(":").map(Number);

    const newStartTime = startHour * 60 + startMin;
    const newEndTime = endHour * 60 + endMin;
    const existingStartTime = sessionStartHour * 60 + sessionStartMin;
    const existingEndTime = sessionEndHour * 60 + sessionEndMin;

    // Check if the new time slot overlaps with existing session
    if (newStartTime < existingEndTime && newEndTime > existingStartTime) {
      return false;
    }
  }

  return true;
};
// Helper function to create a class session
async function createClassSession(classId, date, startTime, endTime, roomId) {
  // Check room availability
  const isRoomAvailable = await checkRoomAvailability(
    roomId,
    date,
    startTime,
    endTime
  );

  // Create the session
  const session = new ClassSession({
    class: classId,
    date: date,
    startTime: startTime,
    endTime: endTime,
    room: isRoomAvailable ? roomId : null,
    status: "scheduled",
  });

  const savedSession = await session.save();

  // If room is available and specified, update room bookings
  if (isRoomAvailable && roomId) {
    await Room.findByIdAndUpdate(roomId, {
      $push: {
        bookings: {
          date: date,
          startTime: startTime,
          endTime: endTime,
          class: classId,
          classSession: savedSession._id,
        },
      },
    });
  }

  return savedSession;
}

const ClassController = {
  async createClass(req, res) {
    try {
      const {
        subject,
        price,
        tutor,
        students,
        sessions,
        room,
        tutorPayout,
        startDate,
        endDate,
      } = req.body;
      const type = students.length > 1 ? "group" : "individual";
      if (startDate > endDate) {
        return res.status(400).json({
          status: "failed",
          message: "Start date cannot be greater than end date",
        });
      }

      // Get tutor's shifts
      const tutorProfile = await Tutor.findOne({ _id: tutor });
      if (!tutorProfile) {
        return res.status(400).json({
          status: "failed",
          message: "Tutor profile not found",
        });
      }
      if (!tutorProfile.shifts || tutorProfile.shifts.length === 0) {
        return res.status(400).json({
          status: "failed",
          message: "Tutor has no shifts set",
        });
      }

      // Validate each session against tutor's shifts
      for (const session of sessions) {
        const dayShifts = tutorProfile.shifts.filter(
          (shift) => shift.dayOfWeek == session.dayOfWeek
        );

        if (dayShifts.length === 0) {
          return res.status(400).json({
            status: "failed",
            message: `Tutor is not available on day ${session.dayOfWeek}`,
          });
        }

        const isTimeValid = dayShifts.some(
          (shift) =>
            isTimeWithinShift(
              session.startTime,
              shift.startTime,
              shift.endTime
            ) &&
            isTimeWithinShift(session.endTime, shift.startTime, shift.endTime)
        );

        if (!isTimeValid) {
          return res.status(400).json({
            status: "failed",
            message: `Session time ${session.startTime}-${session.endTime} is outside tutor's availability`,
          });
        }
      }

      // Create the class
      const newClass = new Class({
        subject,
        price,
        tutor,
        students,
        sessions,
        allocatedRoom: room,
        tutorPayout,
        startDate,
        endDate,
        type,
      });

      const savedClass = await newClass.save();

      // Generate and validate sessions for each scheduled day
      const generatedSessions = [];
      for (const session of sessions) {
        const sessionDates = generateSessionDates(
          startDate,
          endDate,
          session.dayOfWeek
        );

        // Check availability for each date
        for (const date of sessionDates) {
          const isAvailable = await checkTutorAvailability(
            tutor,
            date,
            session.startTime,
            session.endTime
          );

          if (!isAvailable) {
            // If conflict found, delete the class and any created sessions
            await Class.findByIdAndDelete(savedClass._id);
            await ClassSession.deleteMany({ class: savedClass._id });

            return res.status(400).json({
              status: "failed",
              message: `Tutor has a scheduling conflict on ${
                date.toISOString().split("T")[0]
              } at ${session.startTime}-${session.endTime}`,
            });
          }   

          const classSession = await createClassSession(
            savedClass._id,
            date,
            session.startTime,
            session.endTime,
            room
          );
          const newSessionActivity = new Activity({
            name: "New Session",
            description: `New session created for ${subject} on ${
              date.toISOString().split("T")[0]
            } at ${session.startTime}-${session.endTime}`,
            class: savedClass._id,
            classSession: classSession._id,
          });
          await newSessionActivity.save();
          generatedSessions.push(classSession);
        }
      }

      const tutorUser = await TutorProfile.findOne({ _id: tutor });

      const tutorPayment = new Payment({
        user: tutorUser.user,
        amount: tutorPayout,
        class: savedClass._id,
        status: "pending",
        type: "Payout",
        paymentMethod: "stripe",
        reason: "Tutor payout for class",
      });
      await tutorPayment.save();
      const newActivity = new Activity({
        name: "New Class",
        description: `New class created for ${subject}`,
        class: savedClass._id,
      });

      const newActivity3 = new Activity({
        name: "New Payout",
        description: `New payout created for ${subject}`,
        class: savedClass._id,
        tutorId: tutorUser.user,
      });
      const newActivity4 = new Activity({
        name: "New Class Assignment",
        description: `New class assigned to you`,
        class: savedClass._id,
        tutorId: tutorUser.user,
      });
      await newActivity3.save();
      await newActivity4.save();
      for (const student of students) {
        const newActivity5 = new Activity({
          name: "New Class Assignment",
          description: `New class assigned to you`,
          class: savedClass._id,
          studentId: student.id,
        });
        await newActivity5.save();
        const newActivity2 = new Activity({
          name: "New Payment",
          description: `New pending payment created for ${subject}`,
          class: savedClass._id,
          studentId: student.id,
        });
        await newActivity2.save();
      }

      await newActivity.save();

      res.status(201).json({
        status: "success",
        data: {
          class: savedClass,
          sessions: generatedSessions,
          payments: [tutorPayment],
        },
      });
    } catch (error) {
      res.status(400).json({ message: error.message, status: "failed" });
    }
  },
  addSession: async (req, res) => {
    try {
      const { classId, dayOfWeek, startTime, endTime } = req.body;
      const exsistingClass = await Class.findById(classId);
      if (!exsistingClass) {
        return res
          .status(404)
          .json({ message: "Class not found", status: "failed" });
      }
      const tutorProfile = await Tutor.findOne({ _id: exsistingClass.tutor });
      if (!tutorProfile) {
        return res.status(400).json({
          status: "failed",
          message: "Tutor profile not found",
        });
      }
      const dayShifts = tutorProfile.shifts.filter(
        (shift) => shift.dayOfWeek == dayOfWeek
      );
      if (dayShifts.length === 0) {
        return res.status(400).json({
          status: "failed",
          message: `Tutor is not available on day ${dayOfWeek}`,
        });
      }
      const isTimeValid = dayShifts.some(
        (shift) =>
          isTimeWithinShift(startTime, shift.startTime, shift.endTime) &&
          isTimeWithinShift(endTime, shift.startTime, shift.endTime)
      );

      if (!isTimeValid) {
        return res.status(400).json({
          status: "failed",
          message: `Session time ${startTime}-${endTime} is outside tutor's availability`,
        });
      }

      //now check tutor conflicts

      exsistingClass.sessions.push({
        dayOfWeek,
        startTime,
        endTime,
      });
      await exsistingClass.save();

      //now create sessions for each date
      const generatedSessions = [];
      const startOfDay = new Date(new Date().toISOString().slice(0, 10));

      const sessionDates = generateSessionDates(
        //current dates,
        startOfDay,
        exsistingClass.endDate,
        dayOfWeek
      );
      //check availability for each date

      for (const date of sessionDates) {
        const isAvailable = await checkTutorAvailability(
          exsistingClass.tutor,
          date,
          startTime,
          endTime
        );
        if (!isAvailable) {
          return res.status(400).json({
            status: "failed",
            message: `Tutor has a scheduling conflict on ${
              date.toISOString().split("T")[0]
            } at ${startTime}-${endTime}`,
          });
        }

        const classSession = await createClassSession(
          classId,
          date,
          startTime,
          endTime,
          exsistingClass.allocatedRoom
        );
        const newSessionActivity = new Activity({
          name: "New Session",
          description: `New session created for ${exsistingClass.subject} on ${
            date.toISOString().split("T")[0]
          } at ${startTime}-${endTime}`,
          class: classId,
          classSession: classSession._id,
        });
        await newSessionActivity.save();
        generatedSessions.push(classSession);
      }

      res.status(201).json({ generatedSessions, status: "success" });
    } catch (error) {
      res.status(500).json({
        message: "Error creating session",
        error: error.message,
        status: "Error",
      });
    }
  },
  deleteSession: async (req, res) => {
    try {
      const { classId, sessionId } = req.body;
      const exsistingClass = await Class.findById(classId);
      if (!exsistingClass) {
        return res
          .status(404)
          .json({ message: "Class not found", status: "failed" });
      }
      const sessionIndex = exsistingClass.sessions.findIndex(
        (session) => session._id.toString() === sessionId
      );
      if (sessionIndex < 0) {
        return res
          .status(404)
          .json({ message: "Session not found", status: "failed" });
      }
      const startOfDay = new Date(new Date().toISOString().slice(0, 10));

      const sessionDates = generateSessionDates(
        startOfDay,
        exsistingClass.endDate,
        exsistingClass.sessions[sessionIndex].dayOfWeek
      );

      sessionDates.forEach(async (date) => {
        const session = await ClassSession.findOne({
          class: classId,
          $expr: {
            $eq: [
              { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
              { $dateToString: { format: "%Y-%m-%d", date: new Date(date) } },
            ],
          },
          startTime: exsistingClass.sessions[sessionIndex].startTime,
          endTime: exsistingClass.sessions[sessionIndex].endTime,
        });
        if (session) {
          await Room.findByIdAndUpdate(session.room, {
            $pull: {
              bookings: {
                date: session.date,
                startTime: session.startTime,
                endTime: session.endTime,
                class: session.class,
                classSession: session._id,
              },
            },
          });
          await ClassSession.findByIdAndDelete(session._id);
        }
      });
      //now pull
      exsistingClass.sessions.splice(sessionIndex, 1);
      await exsistingClass.save();
      const newActivity = new Activity({
        name: "Session Deleted",
        description: `Session deleted from ${exsistingClass.subject}`,
        class: classId,
      });
      await newActivity.save();
      res.status(200).json({ status: "success", message: "Session deleted" });

      //now remove all sessions for this date
    } catch (error) {
      res.status(500).json({
        message: "Error deleting session",
        error: error.message,
        status: "Error",
      });
    }
  },

  getClasses: async (req, res) => {
    try {
      const classes = await Class.find()
        .populate({
          path: "tutor",
          populate: {
            path: "user",
            select: "firstName lastName email",
          },
        })
        .populate("students.id")
        .populate("allocatedRoom");

      res.status(200).json({ classes, status: "success" });
    } catch (error) {
      res.status(500).json({
        message: "Error fetching classes",
        error: error.message,
        status: "Error",
      });
    }
  },
  getAllSessions: async (req, res) => {
    try {
      const sessions = await ClassSession.find()
        // only the top‐level session props we care about
        .select('date startTime endTime status class room')
        // populate and limit the class sub‐doc to the essentials
        .populate({
          path: 'class',
          select: 'subject startDate endDate tutor students',
          populate: [
            // pull in just the tutor’s User info
            {
              path: 'tutor',
              model: 'TutorProfile',
              select: 'user',
              populate: {
                path: 'user',
                model: 'User',
                select: 'firstName lastName email'
              }
            },
            // pull in just each student’s User info
            {
              path: 'students.id',
              model: 'User',
              select: 'firstName lastName email'
            }
          ]
        })
        // populate only the room’s name & description
        .populate('room', 'name description')
        .lean();

      return res.status(200).json({ status: 'success', sessions });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Error fetching sessions',
        error: error.message
      });
    }
  },
  assignRoomToSession: async (req, res) => {
    try {
      const { roomId, sessionId } = req.body;
      const session = await ClassSession.findById(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ message: "Session not found", status: "failed" });
      }
      //check if already assigned a room if yes then remove the booking from that room
      if (session.room) {
        const room = await Room.findById(session.room);
        const bookingIndex = room.bookings.findIndex(
          (booking) => booking.classSession.toString() === sessionId
        );
        await Room.findByIdAndUpdate(session.room, {
          $pull: {
            bookings: room.bookings[bookingIndex],
          },
        });
      }
      const room = await Room.findById(roomId);
      if (!room) {
        return res
          .status(404)
          .json({ message: "Room not found", status: "failed" });
      }
      const isRoomAvailable = await checkRoomAvailability(
        roomId,
        session.date,
        session.startTime,
        session.endTime
      );
      if (!isRoomAvailable) {
        return res.status(400).json({
          message: "Room not available for this time slot",
          status: "failed",
        });
      }
      await Room.findByIdAndUpdate(roomId, {
        $push: {
          bookings: {
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            class: session.class,
            classSession: session._id,
          },
        },
      });
      const class_name = await Class.findById(session.class);
      await ClassSession.findByIdAndUpdate(sessionId, { room: roomId });
      const newActivity = new Activity({
        name: "Room Assigned",
        description: `Room ${room.name} assigned to session for ${
          class_name.subject
        } on ${session.date.toISOString().split("T")[0]} at ${
          session.startTime
        }-${session.endTime}`,
        class: session.class,
        classSession: session._id,
      });
      await newActivity.save();
      res
        .status(200)
        .json({ message: "Room assigned to session", status: "success" });
    } catch (error) {
      res.status(500).json({
        message: "Error assigning room to session",
        error: error.message,
        status: "Error",
      });
    }
  },
  unassignRoomFromSession: async (req, res) => {
    try {
      const { sessionId } = req.body;
      const session = await ClassSession.findById(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ message: "Session not found", status: "failed" });
      }
      if (!session.room) {
        return res.status(400).json({
          message: "Session is not assigned to any room",
          status: "failed",
        });
      }
      //remove the booking from room
      const room = await Room.findById(session.room);
      const bookingIndex = room.bookings.findIndex(
        (booking) => booking.classSession.toString() === sessionId
      );
      const updatedRoom = await Room.findByIdAndUpdate(session.room, {
        $pull: {
          bookings: room.bookings[bookingIndex],
        },
      });

      const updatedSession = await ClassSession.findByIdAndUpdate(sessionId, {
        room: null,
      });
      const newAcitivity = new Activity({
        name: "Room Unassigned",
        description: `Room ${room.name} unassigned from session for ${
          session.class
        } on ${session.date.toISOString().split("T")[0]} at ${
          session.startTime
        }-${session.endTime}`,
        class: session.class,
        classSession: session._id,
      });
      res
        .status(200)
        .json({ message: "Room unassigned from session", status: "success" });
    } catch (error) {
      res.status(500).json({
        message: "Error unassigning room from session",
        error: error.message,
        status: "Error",
      });
    }
  },
  cancelSession: async (req, res) => {
    try {
      const { sessionId, reason } = req.body;
      // assume you have req.user._id from your auth middleware
      const userId = req.user && req.user._id;

      const session = await ClassSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ status: "failed", message: "Session not found" });
      }

      // remove any room booking
      if (session.room) {
        await Room.findByIdAndUpdate(session.room, {
          $pull: { bookings: { classSession: session._id } }
        });
      }

      // mark cancelled
      session.status             = "cancelled";
      session.cancellationReason = reason || "";
      session.cancelledBy        = userId || null;
      session.cancelledAt        = new Date();
      await session.save();

      // log activity
      await Activity.create({
        name:    "Session Cancelled",
        description: 
          `Session for class ${session.class} on ` +
          `${session.date.toISOString().split("T")[0]} ` +
          `(${session.startTime}-${session.endTime}) cancelled` +
          (reason ? `: ${reason}` : ""),
        class:        session.class,
        classSession: session._id,
        user:         userId
      });

      return res.status(200).json({ status: "success", session });
    } catch (err) {
      console.error("cancelSession Error:", err);
      return res.status(500).json({ status: "failed", message: err.message });
    }
  },


  // RESCHEDULE a session: create a new one, link both docs
  rescheduleSession: async (req, res) => {
    try {
      const { sessionId, newDate, newStartTime, newEndTime } = req.body;
      const userId = req.user && req.user._id;
  
      // 1) Load the existing session
      const session = await ClassSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ status: "failed", message: "Session not found" });
      }
  
      // 2) Load the parent class to know tutor & room
      const classDoc = await Class.findById(session.class);
      if (!classDoc) {
        return res.status(404).json({ status: "failed", message: "Parent class not found" });
      }
      const tutorId = classDoc.tutor;
      const roomId  = session.room;
  
      // 3) Remove the old room booking
      if (roomId) {
        await Room.findByIdAndUpdate(roomId, {
          $pull: { bookings: { classSession: session._id } }
        });
      }
  
      // 4) Validate tutor & room availability on the new slot
      const okTutor = await checkTutorAvailability(tutorId, newDate, newStartTime, newEndTime);
      if (!okTutor) {
        return res.status(400).json({ status: "failed", message: "Tutor unavailable at that time" });
      }
      const okRoom = await checkRoomAvailability(roomId, newDate, newStartTime, newEndTime);
      if (!okRoom) {
        return res.status(400).json({ status: "failed", message: "Room unavailable at that time" });
      }
  
      // 5) Record old values for activity log
      const oldDate      = session.date;
      const oldStartTime = session.startTime;
      const oldEndTime   = session.endTime;
  
      // 6) Update the session in-place
      session.date          = new Date(newDate);
      session.startTime     = newStartTime;
      session.endTime       = newEndTime;
      session.status        = "rescheduled";
      // point back to itself for clarity
      session.rescheduledFrom = session.rescheduledFrom || session._id;
      session.rescheduledTo   = session._id;
      await session.save();
  
      // 7) Re-book the room under the new date/time
      if (roomId) {
        await Room.findByIdAndUpdate(roomId, {
          $push: {
            bookings: {
              date:         session.date,
              startTime:    newStartTime,
              endTime:      newEndTime,
              class:        session.class,
              classSession: session._id
            }
          }
        });
      }
  
      // 8) Log activity
      await Activity.create({
        name:    "Session Rescheduled",
        description:
          `Session for class ${session.class} moved from ` +
          `${oldDate.toISOString().split("T")[0]} (${oldStartTime}-${oldEndTime}) ` +
          `to ${newDate} (${newStartTime}-${newEndTime})`,
        class:        session.class,
        classSession: session._id,
        user:         userId
      });
  
      return res.status(200).json({ status: "success", session });
    } catch (err) {
      console.error("rescheduleSession Error:", err);
      return res.status(500).json({ status: "failed", message: err.message });
    }
  },
  
  getDashboardStats: async (req, res) => {
    try {
      // Get the date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Get basic stats
      const totalClasses = await Class.countDocuments();
      const activeClasses = await Class.countDocuments({ status: "active" });

      // Get all students from active classes
      const classes = await Class.find({ status: "active" });
      const uniqueStudents = new Set();
      classes.forEach((cls) => {
        cls.students.forEach((student) => {
          uniqueStudents.add(student.id.toString());
        });
      });

      // Get payments for revenue calculation
      const payments = await Payment.find({
        createdAt: { $gte: startDate, $lte: endDate },
        type: "Payment",
        status: "completed",
      });

      // Calculate daily revenue for the past week
      const dailyRevenue = {};
      const lastWeekRevenue = {};

      // Initialize days
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        dailyRevenue[dateStr] = 0;
      }

      // Calculate revenue for current week
      payments.forEach((payment) => {
        const dateStr = payment.createdAt.toISOString().split("T")[0];
        if (dailyRevenue[dateStr] !== undefined) {
          dailyRevenue[dateStr] += payment.amount;
        }
      });

      // Get previous week's payments for comparison
      const prevWeekStart = new Date(startDate);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);

      const prevWeekPayments = await Payment.find({
        createdAt: { $gte: prevWeekStart, $lt: startDate },
        type: "Payment",
        status: "completed",
      });

      // Calculate previous week's revenue
      prevWeekPayments.forEach((payment) => {
        const date = new Date(payment.createdAt);
        date.setDate(date.getDate() + 7); // Shift to current week for comparison
        const dateStr = date.toISOString().split("T")[0];
        lastWeekRevenue[dateStr] =
          (lastWeekRevenue[dateStr] || 0) + payment.amount;
      });

      // Get active students data
      const sessions = await ClassSession.find({
        date: { $gte: startDate, $lte: endDate },
      });

      const dailyActiveStudents = {};
      const daysOfWeek = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      sessions.forEach((session) => {
        const dayName = daysOfWeek[session.date.getDay()];
        const presentStudents =
          session.attendance?.filter((a) => a.status === "present").length || 0;
        dailyActiveStudents[dayName] =
          (dailyActiveStudents[dayName] || 0) + presentStudents;
      });

      // Get active tutors for the sidebar
      const activeTutors = await TutorProfile.find()
        .populate("user", "firstName lastName")
        .limit(7);

      const formattedTutors = activeTutors.map((tutor) => ({
        id: tutor._id,
        name: `${tutor.user.firstName} ${tutor.user.lastName}`,
        shift: tutor.shifts?.[0]
          ? `${tutor.shifts[0].startTime} - ${tutor.shifts[0].endTime}`
          : "No shift",
      }));

      // Get recent payments
      const recentPayments = await Payment.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("user", "firstName lastName");

      const formattedPayments = recentPayments.map((payment) => ({
        amount: payment.amount,
        date: payment.createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        description: payment.reason || "Class Payment",
        status: payment.status,
      }));

      // Calculate percentage changes
      const currentWeekTotal = Object.values(dailyRevenue).reduce(
        (a, b) => a + b,
        0
      );
      const lastWeekTotal = Object.values(lastWeekRevenue).reduce(
        (a, b) => a + b,
        0
      );
      const revenueChange = lastWeekTotal
        ? (((currentWeekTotal - lastWeekTotal) / lastWeekTotal) * 100).toFixed(
            2
          )
        : 0;

      res.json({
        status: "success",
        data: {
          stats: {
            newStudents: uniqueStudents.size,
            activeClasses,
            todayRevenue:
              dailyRevenue[new Date().toISOString().split("T")[0]] || 0,
            revenueChange: parseFloat(revenueChange),
          },
          weeklyRevenue: Object.entries(dailyRevenue)
            .map(([day, revenue]) => ({
              day: new Date(day).toLocaleDateString("en-US", {
                weekday: "short",
              }),
              revenue,
              comparison: lastWeekRevenue[day] || 0,
            }))
            .reverse(),
          activeStudents: Object.entries(dailyActiveStudents).map(
            ([day, students]) => ({
              day,
              students,
            })
          ),
          activeTutors: formattedTutors,
          payments: formattedPayments,
        },
      });
    } catch (error) {
      console.error("Dashboard Stats Error:", error);
      res.status(500).json({
        status: "failed",
        message: "Error fetching dashboard statistics",
        error: error.message,
      });
    }
  },
};

const getClassSessions = async (req, res) => {
  try {
    const { classId } = req.params;

    // Find the class first
    const classData = await Class.findById(classId)
      .populate({
        path: "tutor",
        populate: {
          path: "user",
          select: "firstName lastName email",
        },
      })
      .populate("students.id")
      .populate("allocatedRoom");

    if (!classData) {
      return res.status(404).json({
        status: "failed",
        message: "Class not found",
      });
    }

    // Get all sessions for this class
    const sessions = await ClassSession.find({ class: classId })
      .populate("room")
      .populate({
        path: "attendance.student",
        select: "firstName lastName email",
      })
      .populate({
        path: "feedback.student",
        select: "firstName lastName email",
      })
      .sort({ date: 1 }); // Sort by date ascending

    // Format the sessions data
    const formattedSessions = sessions.map((session) => ({
      _id: session._id,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      room: session.room
        ? {
            _id: session.room._id,
            name: session.room.name,
          }
        : null,
      attendance: session.attendance.map((record) => ({
        student: {
          _id: record.student._id,
          firstName: record.student.firstName,
          lastName: record.student.lastName,
        },
        status: record.status,
        markedAt: record.markedAt,
      })),
      feedback: session.feedback.map((fb) => ({
        student: {
          _id: fb.student._id,
          firstName: fb.student.firstName,
          lastName: fb.student.lastName,
        },
        rating: fb.rating,
        comment: fb.comment,
        understanding: fb.understanding,
        pacing: fb.pacing,
        difficulty: fb.difficulty,
        date: fb.date,
      })),
      notes: session.notes,
      cancellationReason: session.cancellationReason,
      isRescheduled: session.status === "rescheduled",
      rescheduledTo: session.rescheduledTo,
    }));

    res.status(200).json({
      status: "success",
      data: {
        class: classData,
        sessions: formattedSessions,
      },
    });
  } catch (error) {
    console.error("Error in getClassSessions:", error);
    res.status(500).json({
      status: "failed",
      message: "Error fetching class sessions",
      error: error.message,
    });
  }
};

// Add sessions summary statistics (optional but useful)
const getClassSessionsStats = async (req, res) => {
  try {
    const { classId } = req.params;

    const sessions = await ClassSession.find({ class: classId });

    const stats = {
      total: sessions.length,
      completed: sessions.filter((s) => s.status === "completed").length,
      scheduled: sessions.filter((s) => s.status === "scheduled").length,
      cancelled: sessions.filter((s) => s.status === "cancelled").length,
      rescheduled: sessions.filter((s) => s.status === "rescheduled").length,

      // Attendance stats
      attendance: {
        present: 0,
        absent: 0,
        total: 0,
      },

      // Feedback stats
      feedback: {
        averageRating: 0,
        totalFeedbacks: 0,
        ratingDistribution: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      },
    };

    // Calculate attendance stats
    sessions.forEach((session) => {
      session.attendance.forEach((record) => {
        stats.attendance.total++;
        if (record.status === "present") stats.attendance.present++;
        else if (record.status === "absent") stats.attendance.absent++;
      });

      // Calculate feedback stats
      session.feedback.forEach((fb) => {
        stats.feedback.totalFeedbacks++;
        stats.feedback.averageRating += fb.rating;
        stats.feedback.ratingDistribution[fb.rating]++;
      });
    });

    if (stats.feedback.totalFeedbacks > 0) {
      stats.feedback.averageRating /= stats.feedback.totalFeedbacks;
    }

    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    console.error("Error in getClassSessionsStats:", error);
    res.status(500).json({
      status: "failed",
      message: "Error fetching class sessions statistics",
      error: error.message,
    });
  }
};

module.exports = {
  ...ClassController,
  getClassSessions,
  getClassSessionsStats,
};
