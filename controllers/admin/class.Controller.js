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

// Helper function to generate dates between start and end date for a specific day of week and recurrence pattern
function generateSessionDates(startDate, endDate, session) {
  const dates = [];
  let currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);
  
  // Handle one-off sessions with a specific date
  if (session.recurrence === 'one-off' && session.specificDate) {
    const specificDate = new Date(session.specificDate);
    // Check if the specific date falls within the class date range
    if (specificDate >= currentDate && specificDate <= endDateTime) {
      dates.push(specificDate);
    }
    return dates;
  }
  
  // For trial sessions, just add one session on the first matching day
  if (session.isTrial) {
    while (currentDate <= endDateTime) {
      if (currentDate.getDay() === parseInt(session.dayOfWeek)) {
        dates.push(new Date(currentDate));
        break; // Just add one date for trial classes
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  }
  
  // For weekly and fortnightly sessions
  while (currentDate <= endDateTime) {
    if (currentDate.getDay() === parseInt(session.dayOfWeek)) {
      dates.push(new Date(currentDate));
      
      // For fortnightly, skip an extra week
      if (session.recurrence === 'fortnightly') {
        currentDate.setDate(currentDate.getDate() + 7); // Skip an extra week
      }
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

// Helper function to create payments for a session
async function createSessionPayments(classId, sessionId, session, students, tutorId, subject) {
  const allPayments = [];
  const sessionDate = new Date(session.date || session.sessionDate);

  // Create teacher payout payment
  const tutorUser = await TutorProfile.findOne({ _id: tutorId });
  if (tutorUser && session.teacherPayout > 0) {
    const teacherPayment = new Payment({
      user: tutorUser.user,
      amount: session.teacherPayout,
      classId: classId,
      classSessionId: sessionId,
      status: "pending",
      type: "Payout",
      paymentMethod: "stripe",
      reason: `Teacher payout for ${subject} session on ${sessionDate.toISOString().split("T")[0]}`,
      sessionDate: sessionDate,
      sessionTime: {
        startTime: session.startTime,
        endTime: session.endTime
      }
    });
    await teacherPayment.save();
    allPayments.push(teacherPayment);
  }

  // Create student payments
  for (const student of students) {
    if (student.pricePerSession > 0) {
      const studentPayment = new Payment({
        user: student.id,
        amount: student.pricePerSession,
        classId: classId,
        classSessionId: sessionId,
        status: "pending",
        type: "Payment",
        paymentMethod: "stripe",
        reason: `Student payment for ${subject} session on ${sessionDate.toISOString().split("T")[0]}`,
        sessionDate: sessionDate,
        sessionTime: {
          startTime: session.startTime,
          endTime: session.endTime
        }
      });
      await studentPayment.save();
      allPayments.push(studentPayment);
    }
  }

  return allPayments;
}

async function createClassSession(
  classId, 
  date, 
  startTime, 
  endTime, 
  roomId, 
  organizingCost = 0, 
  teacherPayout = 0, 
  totalStudentRevenue = 0, 
  sessionType = "our-space"
) {
  // Prepare session data WITHOUT room initially
  const sessionData = {
    class: classId,
    date: date,
    startTime: startTime,
    endTime: endTime,
    status: "scheduled",
    organizingCost: organizingCost,
    teacherPayout: teacherPayout,
    totalStudentRevenue: totalStudentRevenue,
    sessionType: sessionType
  };

  // Only add room field if sessionType is our-space AND roomId is provided
  if (sessionType === 'our-space' && roomId) {
    const isRoomAvailable = await checkRoomAvailability(
      roomId,
      date,
      startTime,
      endTime
    );

    if (isRoomAvailable) {
      sessionData.room = roomId; // Only set room if available
    } else {
      // You can either throw an error or proceed without room
      console.warn(`Room ${roomId} not available, creating session without room assignment`);
    }
  }

  // Create and save the session
  const session = new ClassSession(sessionData);
  const savedSession = await session.save();

  // Update room bookings only if room was assigned
  if (sessionData.room) {
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

// Updated createClass function
const ClassController = {
  async createClass(req, res) {
    try {
      const {
        subject,
        tutor,
        students,
        sessions,
        room,
        startDate,
        endDate,
        sessionType = "our-space"
      } = req.body;

      const type = students.length > 1 ? "group" : "individual";
      
      if (startDate > endDate) {
        return res.status(400).json({
          status: "failed",
          message: "Start date cannot be greater than end date",
        });
      }

      console.log("Tutor ID",tutor)
      // Get tutor's shifts
      const tutorProfile = await TutorProfile.findOne({ _id: tutor });
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

      const enrichedSessions = [];
      for (const session of sessions) {
        // Find matching shifts for this day
        const dayShifts = tutorProfile.shifts.filter(
          (shift) => shift.dayOfWeek == session.dayOfWeek
        );

        if (dayShifts.length === 0) {
          return res.status(400).json({
            status: "failed",
            message: `Tutor is not available on day ${session.dayOfWeek}`,
          });
        }

        const availableShifts = dayShifts.filter(
          (shift) =>
            isTimeWithinShift(
              session.startTime,
              shift.startTime,
              shift.endTime
            ) &&
            isTimeWithinShift(session.endTime, shift.startTime, shift.endTime)
        );

        if (availableShifts.length === 0) {
          return res.status(400).json({
            status: "failed",
            message: `Session time ${session.startTime}-${session.endTime} is outside tutor's availability`,
          });
        }

        const matchedShift = availableShifts[0];
        enrichedSessions.push({
          ...session,
          recurrence: session.recurrence || matchedShift.recurrence || 'weekly',
          isTrial: session.isTrial !== undefined ? session.isTrial : matchedShift.isTrial || false,
          organizingCost: session.organizingCost || 0,
          teacherPayout: session.teacherPayout || 0,
          specificDate: session.specificDate || 
            (matchedShift.recurrence === 'one-off' ? matchedShift.specificDate : undefined)
        });
      }

      // Format students to match new schema structure
      const formattedStudents = students.map(student => ({
        id: student.id,
        pricePerSession: student.cost || student.pricePerSession || 0,
        paymentStatus: "pending"
      }));

      const newClass = new Class({
        subject,
        tutor,
        students: formattedStudents,
        sessions: enrichedSessions,
        allocatedRoom: sessionType === 'our-space' ? room : undefined,
        startDate,
        endDate,
        type,
        sessionType
      });

      const savedClass = await newClass.save();

      const generatedSessions = [];
      const allPayments = [];

      for (const session of enrichedSessions) {
        const sessionDates = generateSessionDates(
          startDate,
          endDate,
          session
        );

        for (const date of sessionDates) {
          const isAvailable = await checkTutorAvailability(
            tutor,
            date,
            session.startTime,
            session.endTime
          );

          if (!isAvailable) {
            await Class.findByIdAndDelete(savedClass._id);
            await ClassSession.deleteMany({ class: savedClass._id });

            return res.status(400).json({
              status: "failed",
              message: `Tutor has a scheduling conflict on ${date.toISOString().split("T")[0]} at ${session.startTime}-${session.endTime}`,
            });
          }

          // Calculate total student revenue for this session
          const totalStudentRevenue = formattedStudents.reduce((sum, student) => 
            sum + (student.pricePerSession || 0), 0
          );

          const classSession = await createClassSession(
            savedClass._id,
            date,
            session.startTime,
            session.endTime,
            sessionType === 'our-space' ? room : null, // Pass null instead of undefined
            session.organizingCost || 0,
            session.teacherPayout || 0,
            totalStudentRevenue,
            sessionType
          );

          // Create payments for this session
          const sessionPayments = await createSessionPayments(
            savedClass._id,
            classSession._id,
            {
              ...session,
              date: date,
              sessionDate: date
            },
            formattedStudents,
            tutor,
            subject
          );
          allPayments.push(...sessionPayments);

          const newSessionActivity = new Activity({
            name: "New Session",
            description: `New session created for ${subject} on ${date.toISOString().split("T")[0]} at ${session.startTime}-${session.endTime}`,
            class: savedClass._id,
            classSession: classSession._id,
          });
          await newSessionActivity.save();
          generatedSessions.push(classSession);
        }
      }

      const tutorUser = await TutorProfile.findOne({ _id: tutor });

      const newActivity = new Activity({
        name: "New Class",
        description: `New class created for ${subject}`,
        class: savedClass._id,
      });

      const newActivity3 = new Activity({
        name: "New Payout Schedule",
        description: `Payout schedule created for ${subject}`,
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
      
      for (const student of formattedStudents) {
        const newActivity5 = new Activity({
          name: "New Class Assignment",
          description: `New class assigned to you`,
          class: savedClass._id,
          studentId: student.id,
        });
        await newActivity5.save();
        
        const newActivity2 = new Activity({
          name: "Payment Schedule Created",
          description: `Payment schedule created for ${subject}`,
          class: savedClass._id,
          studentId: student.id,
        });
        await newActivity2.save();
      }

      await newActivity.save();

      // Return response in the same structure as before
      res.status(201).json({
        status: "success",
        data: {
          class: savedClass,
          sessions: generatedSessions,
          payments: allPayments, // Now includes all session-level payments
        },
      });
    } catch (error) {
      res.status(400).json({ message: error.message, status: "failed" });
    }
  },

  // Updated addSession function with payment creation
  addSession: async (req, res) => {
    try {
      const { 
        classId, 
        dayOfWeek, 
        startTime, 
        endTime, 
        organizingCost = 0, 
        teacherPayout = 0,
        recurrence = 'weekly', 
        isTrial = false, 
        specificDate 
      } = req.body;
      
      const existingClass = await Class.findById(classId);
      if (!existingClass) {
        return res
          .status(404)
          .json({ message: "Class not found", status: "failed" });
      }
      
      const tutorProfile = await TutorProfile.findOne({ _id: existingClass.tutor });
      if (!tutorProfile) {
        return res.status(400).json({
          status: "failed",
          message: "Tutor profile not found",
        });
      }
      
      // Match with tutor shifts
      const dayShifts = tutorProfile.shifts.filter(
        (shift) => shift.dayOfWeek == dayOfWeek
      );
      if (dayShifts.length === 0) {
        return res.status(400).json({
          status: "failed",
          message: `Tutor is not available on day ${dayOfWeek}`,
        });
      }
      
      // Find shifts with matching recurrence pattern
      const matchingShifts = dayShifts.filter(shift => 
        isTimeWithinShift(startTime, shift.startTime, shift.endTime) &&
        isTimeWithinShift(endTime, shift.startTime, shift.endTime) &&
        (recurrence === shift.recurrence || !recurrence)
      );

      if (matchingShifts.length === 0) {
        return res.status(400).json({
          status: "failed",
          message: `No matching shift found for session time ${startTime}-${endTime} with recurrence ${recurrence}`,
        });
      }

      // Add the new session to the class
      const newSession = {
        dayOfWeek,
        startTime,
        endTime,
        recurrence,
        isTrial,
        organizingCost,
        teacherPayout,
        specificDate
      };
      
      existingClass.sessions.push(newSession);
      await existingClass.save();

      // Create class sessions based on the new session recurrence pattern
      const generatedSessions = [];
      const allPayments = [];
      const startOfDay = new Date(new Date().toISOString().slice(0, 10));

      const sessionDates = generateSessionDates(
        startOfDay,
        existingClass.endDate,
        newSession
      );

      // Calculate total student revenue
      const totalStudentRevenue = existingClass.students.reduce((sum, student) => 
        sum + (student.pricePerSession || 0), 0
      );

      // Check availability for each date and create sessions
      for (const date of sessionDates) {
        const isAvailable = await checkTutorAvailability(
          existingClass.tutor,
          date,
          startTime,
          endTime
        );
        
        if (!isAvailable) {
          return res.status(400).json({
            status: "failed",
            message: `Tutor has a scheduling conflict on ${date.toISOString().split("T")[0]} at ${startTime}-${endTime}`,
          });
        }

        const classSession = await createClassSession(
          classId,
          date,
          startTime,
          endTime,
          existingClass.sessionType === 'our-space' ? existingClass.allocatedRoom : undefined,
          organizingCost,
          teacherPayout,
          totalStudentRevenue,
          existingClass.sessionType
        );
        
        // Create payments for this new session
        const sessionPayments = await createSessionPayments(
          classId,
          classSession._id,
          {
            ...newSession,
            date: date,
            sessionDate: date
          },
          existingClass.students,
          existingClass.tutor,
          existingClass.subject
        );
        allPayments.push(...sessionPayments);
        
        const newSessionActivity = new Activity({
          name: "New Session",
          description: `New session created for ${existingClass.subject} on ${date.toISOString().split("T")[0]} at ${startTime}-${endTime}`,
          class: classId,
          classSession: classSession._id,
        });
        
        await newSessionActivity.save();
        generatedSessions.push(classSession);
      }

      res.status(201).json({ 
        status: "success", 
        data: {
          generatedSessions,
          updatedClass: existingClass,
          payments: allPayments
        }
      });
    } catch (error) {
      res.status(500).json({
        message: "Error creating session",
        error: error.message,
        status: "Error",
      });
    }
  },

  // Updated assignRoomToSession function
  assignRoomToSession: async (req, res) => {
    try {
      const { roomId, sessionId } = req.body;
      const session = await ClassSession.findById(sessionId);
      if (!session) {
        return res
          .status(404)
          .json({ message: "Session not found", status: "failed" });
      }
  
      // Check if the session type allows room assignment
      if (session.sessionType !== 'our-space') {
        return res.status(400).json({
          message: "Room assignment is only allowed for 'our-space' sessions",
          status: "failed",
        });
      }
  
      // Check if already assigned a room if yes then remove the booking from that room
      if (session.room) {
        try {
          const oldRoom = await Room.findById(session.room);
          if (oldRoom) {
            // Room exists, remove the booking
            const bookingIndex = oldRoom.bookings.findIndex(
              (booking) => booking.classSession.toString() === sessionId
            );
            if (bookingIndex !== -1) {
              await Room.findByIdAndUpdate(session.room, {
                $pull: {
                  bookings: oldRoom.bookings[bookingIndex],
                },
              });
            }
          }
          // If room doesn't exist (deleted), we just continue without error
        } catch (error) {
          // Log the error but don't stop the process
          console.log(`Old room ${session.room} not found or error removing booking:`, error.message);
        }
      }
  
      // Check if the new room exists
      const room = await Room.findById(roomId);
      if (!room) {
        return res
          .status(404)
          .json({ message: "Room not found", status: "failed" });
      }
  
      // Check room availability
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
  
      // Add booking to the new room
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
  
      // Get class name for activity description
      const class_name = await Class.findById(session.class);
      
      // Update session with new room
      await ClassSession.findByIdAndUpdate(sessionId, { room: roomId });
  
      // Create activity log
      const newActivity = new Activity({
        name: "Room Assigned",
        description: `Room ${room.name} assigned to session for ${class_name.subject} on ${session.date.toISOString().split("T")[0]} at ${session.startTime}-${session.endTime}`,
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

  // Updated rescheduleSession function with payment updates
  rescheduleSession: async (req, res) => {
    try {
      const { sessionId, newDate, newStartTime, newEndTime, newOrganizingCost, newTeacherPayout } = req.body;
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
      const roomId = session.room;

      // 3) Remove the old room booking (only for our-space sessions)
      if (roomId && session.sessionType === 'our-space') {
        await Room.findByIdAndUpdate(roomId, {
          $pull: { bookings: { classSession: session._id } }
        });
      }

      // 4) Validate tutor & room availability on the new slot
      const okTutor = await checkTutorAvailability(tutorId, newDate, newStartTime, newEndTime);
      if (!okTutor) {
        return res.status(400).json({ status: "failed", message: "Tutor unavailable at that time" });
      }
      
      // Only check room availability for our-space sessions
      if (session.sessionType === 'our-space' && roomId) {
        const okRoom = await checkRoomAvailability(roomId, newDate, newStartTime, newEndTime);
        if (!okRoom) {
          return res.status(400).json({ status: "failed", message: "Room unavailable at that time" });
        }
      }

      // 5) Record old values for activity log
      const oldDate = session.date;
      const oldStartTime = session.startTime;
      const oldEndTime = session.endTime;
      const oldOrganizingCost = session.organizingCost;
      const oldTeacherPayout = session.teacherPayout;

      // 6) Update the session in-place
      session.date = new Date(newDate);
      session.startTime = newStartTime;
      session.endTime = newEndTime;
      session.status = "rescheduled";
      
      // Update costs if provided
      if (newOrganizingCost !== undefined) {
        session.organizingCost = newOrganizingCost;
      }
      if (newTeacherPayout !== undefined) {
        session.teacherPayout = newTeacherPayout;
      }
      
      // point back to itself for clarity
      session.rescheduledFrom = session.rescheduledFrom || session._id;
      session.rescheduledTo = session._id;
      await session.save();

      // 7) Update payments with new session date and time
      await Payment.updateMany(
        { classSessionId: sessionId },
        {
          $set: {
            sessionDate: new Date(newDate),
            'sessionTime.startTime': newStartTime,
            'sessionTime.endTime': newEndTime,
            reason: `${session.type === 'Payout' ? 'Teacher payout' : 'Student payment'} for ${classDoc.subject} session on ${newDate} (Rescheduled)`
          }
        }
      );

      // Update teacher payout amount if changed
      if (newTeacherPayout !== undefined && newTeacherPayout !== oldTeacherPayout) {
        const tutorUser = await TutorProfile.findOne({ _id: tutorId });
        if (tutorUser) {
          await Payment.updateOne(
            { 
              classSessionId: sessionId, 
              type: "Payout", 
              user: tutorUser.user 
            },
            { 
              $set: { 
                amount: newTeacherPayout,
                reason: `Teacher payout for ${classDoc.subject} session on ${newDate} (Rescheduled & Amount Updated)`
              }
            }
          );
        }
      }

      // 8) Re-book the room under the new date/time (only for our-space sessions)
      if (roomId && session.sessionType === 'our-space') {
        await Room.findByIdAndUpdate(roomId, {
          $push: {
            bookings: {
              date: session.date,
              startTime: newStartTime,
              endTime: newEndTime,
              class: session.class,
              classSession: session._id
            }
          }
        });
      }

      // 9) Log activity
      const costChangeInfo = [];
      if (newOrganizingCost !== undefined && newOrganizingCost !== oldOrganizingCost) {
        costChangeInfo.push(`organizing cost updated from ${oldOrganizingCost} to ${newOrganizingCost}`);
      }
      if (newTeacherPayout !== undefined && newTeacherPayout !== oldTeacherPayout) {
        costChangeInfo.push(`teacher payout updated from ${oldTeacherPayout} to ${newTeacherPayout}`);
      }
      
      const costInfo = costChangeInfo.length > 0 ? ` and ${costChangeInfo.join(', ')}` : '';
        
      await Activity.create({
        name: "Session Rescheduled",
        description:
          `Session for class ${session.class} moved from ` +
          `${oldDate.toISOString().split("T")[0]} (${oldStartTime}-${oldEndTime}) ` +
          `to ${newDate} (${newStartTime}-${newEndTime})${costInfo}`,
        class: session.class,
        classSession: session._id,
        user: userId
      });

      return res.status(200).json({ status: "success", session });
    } catch (err) {
      console.error("rescheduleSession Error:", err);
      return res.status(500).json({ status: "failed", message: err.message });
    }
  },

  // Updated cancelSession function with payment deletion
  cancelSession: async (req, res) => {
    try {
      const { sessionId, reason } = req.body;
      // assume you have req.user._id from your auth middleware
      const userId = req.user && req.user._id;

      const session = await ClassSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ status: "failed", message: "Session not found" });
      }

      // Delete all payments associated with this session
      const deletedPayments = await Payment.deleteMany({ classSessionId: sessionId });
      console.log(`Deleted ${deletedPayments.deletedCount} payments for cancelled session`);

      // remove any room booking (only for our-space sessions)
      if (session.room && session.sessionType === 'our-space') {
        await Room.findByIdAndUpdate(session.room, {
          $pull: { bookings: { classSession: session._id } }
        });
      }

      // mark cancelled
      session.status = "cancelled";
      session.cancellationReason = reason || "";
      session.cancelledBy = userId || null;
      session.cancelledAt = new Date();
      await session.save();

      // log activity
      await Activity.create({
        name: "Session Cancelled",
        description:
          `Session for class ${session.class} on ` +
          `${session.date.toISOString().split("T")[0]} ` +
          `(${session.startTime}-${session.endTime}) cancelled` +
          (reason ? `: ${reason}` : "") +
          `. Associated payments have been removed.`,
        class: session.class,
        classSession: session._id,
        user: userId
      });

      return res.status(200).json({ 
        status: "success", 
        session,
        deletedPayments: deletedPayments.deletedCount
      });
    } catch (err) {
      console.error("cancelSession Error:", err);
      return res.status(500).json({ status: "failed", message: err.message });
    }
  },
  cancelFutureSessions: async (req, res) => {
    try {
      const { classId, reason, startFromDate } = req.body;
      const userId = req.user && req.user._id;
  
      // Validate inputs
      if (!classId || !reason) {
        return res.status(400).json({
          status: "failed",
          message: "Class ID and cancellation reason are required"
        });
      }
  
      // Use provided date or default to today
      const fromDate = startFromDate ? new Date(startFromDate) : new Date();
      fromDate.setHours(0, 0, 0, 0); // Set to start of day
  
      // Find the class to get end date
      const classData = await Class.findById(classId);
      if (!classData) {
        return res.status(404).json({
          status: "failed",
          message: "Class not found"
        });
      }
  
      // Find all future sessions for this class that are not already cancelled or completed
      const futureSessions = await ClassSession.find({
        class: classId,
        date: { 
          $gte: fromDate,
          $lte: classData.endDate
        },
        status: { $in: ["scheduled", "rescheduled", "pending"] }
      });
  
      if (futureSessions.length === 0) {
        return res.status(400).json({
          status: "failed",
          message: "No future sessions found to cancel"
        });
      }
  
      const cancelledSessions = [];
      let totalDeletedPayments = 0;
  
      // Process each session
      for (const session of futureSessions) {
        try {
          // Delete all payments associated with this session
          const deletedPayments = await Payment.deleteMany({ 
            classSessionId: session._id 
          });
          totalDeletedPayments += deletedPayments.deletedCount;
  
          // Remove room booking (only for our-space sessions)
          if (session.room && session.sessionType === 'our-space') {
            await Room.findByIdAndUpdate(session.room, {
              $pull: { bookings: { classSession: session._id } }
            });
          }
  
          // Update session status
          session.status = "cancelled";
          session.cancellationReason = reason;
          session.cancelledBy = userId || null;
          session.cancelledAt = new Date();
          await session.save();
  
          cancelledSessions.push({
            sessionId: session._id,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime
          });
  
          // Create individual activity log for each cancelled session
          await Activity.create({
            name: "Session Cancelled (Bulk)",
            description: `Session for class ${classData.subject} on ${session.date.toISOString().split("T")[0]} (${session.startTime}-${session.endTime}) cancelled as part of bulk cancellation: ${reason}`,
            class: session.class,
            classSession: session._id,
            user: userId
          });
  
        } catch (sessionError) {
          console.error(`Error cancelling session ${session._id}:`, sessionError);
          // Continue with other sessions even if one fails
        }
      }
  
      // Create a summary activity log
      await Activity.create({
        name: "Bulk Sessions Cancelled",
        description: `${cancelledSessions.length} future sessions cancelled for ${classData.subject} from ${fromDate.toISOString().split("T")[0]} onwards. Reason: ${reason}. ${totalDeletedPayments} associated payments removed.`,
        class: classId,
        user: userId
      });
  
      // Check if class should be marked as completed (if no more active sessions)
      const remainingActiveSessions = await ClassSession.find({
        class: classId,
        status: { $in: ["scheduled", "rescheduled", "pending"] }
      });
  
      if (remainingActiveSessions.length === 0) {
        await Class.findByIdAndUpdate(classId, { status: "completed" });
      }
  
      return res.status(200).json({
        status: "success",
        message: `Successfully cancelled ${cancelledSessions.length} future sessions`,
        data: {
          cancelledSessionsCount: cancelledSessions.length,
          cancelledSessions: cancelledSessions,
          deletedPayments: totalDeletedPayments,
          fromDate: fromDate.toISOString().split("T")[0],
          toDate: classData.endDate.toISOString().split("T")[0]
        }
      });
  
    } catch (error) {
      console.error("cancelFutureSessions Error:", error);
      return res.status(500).json({
        status: "failed",
        message: "Error cancelling future sessions",
        error: error.message
      });
    }
  },

  // Keep all other existing functions unchanged
  markClassAsCompleted: async (req, res) => {
    try {
      const { classId } = req.params;

      // Find the class
      const classData = await Class.findById(classId);

      if (!classData) {
        return res.status(404).json({
          status: "failed",
          message: "Class not found"
        });
      }

      // Check if class is already completed
      if (classData.status === "completed") {
        return res.status(400).json({
          status: "failed",
          message: "Class is already marked as completed"
        });
      }

      // Check if all sessions are completed
      const sessions = await ClassSession.find({ class: classId });
      const pendingSessions = sessions.filter(
        session => session.status === "scheduled"
      );

      if (pendingSessions.length > 0) {
        return res.status(400).json({
          status: "failed",
          message: `There are still ${pendingSessions.length} pending sessions for this class`
        });
      }

      // Update class status to completed
      classData.status = "completed";
      await classData.save();

      // Create activity log
      const newActivity = new Activity({
        name: "Class Completed",
        description: `Class ${classData.subject} has been marked as completed`,
        class: classId
      });
      await newActivity.save();

      // Notify tutor
      const tutorUser = await TutorProfile.findOne({ _id: classData.tutor });
      if (tutorUser) {
        const tutorActivity = new Activity({
          name: "Class Completed",
          description: `Your class ${classData.subject} has been marked as completed`,
          class: classId,
          tutorId: tutorUser.user
        });
        await tutorActivity.save();
      }

      // Notify students
      for (const student of classData.students) {
        const studentActivity = new Activity({
          name: "Class Completed",
          description: `Your class ${classData.subject} has been marked as completed`,
          class: classId,
          studentId: student.id
        });
        await studentActivity.save();
      }

      res.status(200).json({
        status: "success",
        message: "Class marked as completed successfully",
        data: classData
      });
    } catch (error) {
      console.error("markClassAsCompleted Error:", error);
      res.status(500).json({
        status: "failed",
        message: "Error marking class as completed",
        error: error.message
      });
    }
  },

  // Updated markSessionAsCompleted function with payment completion
  markSessionAsCompleted: async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user && req.user._id;
  
      // 1) Find the session
      const session = await ClassSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          status: "failed",
          message: "Session not found"
        });
      }
  
      // 2) Guard: already completed?
      if (session.status === "completed") {
        return res.status(400).json({
          status: "failed",
          message: "Session is already marked as completed"
        });
      }
  
      // 3) Mark the session itself completed
      session.status = "completed";
      session.completedAt = new Date();
      session.completedBy = userId || null;
      await session.save();
  
      // 4) Fetch parent class for logging and notifications
      const classData = await Class.findById(session.class);
  
      // 5) Create a general activity log
      const newActivity = new Activity({
        name: "Session Completed",
        description: `Session for ${classData ? classData.subject : 'class'} on ${session.date
          .toISOString()
          .split("T")[0]} (${session.startTime}-${session.endTime}) has been marked as completed.`,
        class: session.class,
        classSession: session._id,
        user: userId
      });
      await newActivity.save();
  
      // 6) Notify tutor
      if (classData) {
        const tutorProfile = await TutorProfile.findById(classData.tutor);
        if (tutorProfile) {
          const tutorActivity = new Activity({
            name: "Session Completed",
            description: `Your session for ${classData.subject} on ${session.date
              .toISOString()
              .split("T")[0]} (${session.startTime}-${session.endTime}) has been marked as completed.`,
            class: session.class,
            classSession: session._id,
            tutorId: tutorProfile.user
          });
          await tutorActivity.save();
        }
  
        // 7) Notify each student
        for (const student of classData.students) {
          const studentActivity = new Activity({
            name: "Session Completed",
            description: `Your session for ${classData.subject} on ${session.date
              .toISOString()
              .split("T")[0]} (${session.startTime}-${session.endTime}) has been marked as completed.`,
            class: session.class,
            classSession: session._id,
            studentId: student.id
          });
          await studentActivity.save();
        }
      }
  
      // 8) Check if *all* sessions for this class are now completed or cancelled
      const allClassSessions = await ClassSession.find({ class: session.class });
      const pendingSessions = allClassSessions.filter(
        (s) => s.status !== "completed" && s.status !== "cancelled"
      );
      if (pendingSessions.length === 0) {
        await Class.findByIdAndUpdate(session.class, { status: "completed" });
      }
  
      // 9) Return success (no payments data)
      res.status(200).json({
        status: "success",
        message: "Session marked as completed successfully",
        data: { session }
      });
    } catch (error) {
      console.error("markSessionAsCompleted Error:", error);
      res.status(500).json({
        status: "failed",
        message: "Error marking session as completed",
        error: error.message
      });
    }
  },
  

  deleteSession: async (req, res) => {
    try {
      const { classId, sessionId } = req.body;
      const existingClass = await Class.findById(classId);
      if (!existingClass) {
        return res
          .status(404)
          .json({ message: "Class not found", status: "failed" });
      }
      const sessionIndex = existingClass.sessions.findIndex(
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
        existingClass.endDate,
        existingClass.sessions[sessionIndex]
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
          startTime: existingClass.sessions[sessionIndex].startTime,
          endTime: existingClass.sessions[sessionIndex].endTime,
        });
        if (session) {
          // Delete payments for this session
          await Payment.deleteMany({ classSessionId: session._id });
          
          // Only remove room bookings for our-space sessions
          if (session.room && session.sessionType === 'our-space') {
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
          }
          await ClassSession.findByIdAndDelete(session._id);
        }
      });
      
      //now pull
      existingClass.sessions.splice(sessionIndex, 1);
      await existingClass.save();
      const newActivity = new Activity({
        name: "Session Deleted",
        description: `Session deleted from ${existingClass.subject} and associated payments removed`,
        class: classId,
      });
      await newActivity.save();
      res.status(200).json({ status: "success", message: "Session deleted" });
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
        .select('date startTime endTime status class room sessionType organizingCost teacherPayout totalStudentRevenue')
        // populate and limit the class sub‐doc to the essentials
        .populate({
          path: 'class',
          select: 'subject startDate endDate tutor students sessionType',
          populate: [
            // pull in just the tutor's User info
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
            // pull in just each student's User info
            {
              path: 'students.id',
              model: 'User',
              select: 'firstName lastName email'
            }
          ]
        })
        // populate only the room's name & description
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
  
      // Check if the session type allows room unassignment
      if (session.sessionType !== 'our-space') {
        return res.status(400).json({
          message: "Room unassignment is only allowed for 'our-space' sessions",
          status: "failed",
        });
      }
  
      let roomName = "Unknown Room"; // Default fallback name
  
      // Remove the booking from room (if room still exists)
      try {
        const room = await Room.findById(session.room);
        if (room) {
          roomName = room.name; // Store room name for activity log
          const bookingIndex = room.bookings.findIndex(
            (booking) => booking.classSession.toString() === sessionId
          );
          if (bookingIndex !== -1) {
            await Room.findByIdAndUpdate(session.room, {
              $pull: {
                bookings: room.bookings[bookingIndex],
              },
            });
          }
        } else {
          // Room was deleted, but we can still unassign it from the session
          console.log(`Room ${session.room} not found (possibly deleted), proceeding with unassignment`);
        }
      } catch (error) {
        // Log the error but don't stop the unassignment process
        console.log(`Error accessing room ${session.room}:`, error.message);
      }
  
      // Always unassign the room from the session, regardless of whether the room exists
      await ClassSession.findByIdAndUpdate(sessionId, {
        room: null,
      });
  
      // Get class name for activity description
      const class_name = await Class.findById(session.class);
      
      // Create activity log
      const newActivity = new Activity({
        name: "Room Unassigned",
        description: `Room ${roomName} unassigned from session for ${class_name?.subject || 'Unknown Class'} on ${session.date.toISOString().split("T")[0]} at ${session.startTime}-${session.endTime}`,
        class: session.class,
        classSession: session._id,
      });
      await newActivity.save();
  
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

  getDashboardStats: async (req, res) => {
    try {
      const timeframe = req.query.timeframe || "Week";
      const currentDate = new Date();
      
      // FIXED: Helper function to get date ranges - includes both past and future
      const getDateRange = (period) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();
        
        switch (period) {
          case "Day":
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
          case "Week":
            // FIXED: Get current week (Sunday to Saturday) or last 7 days including future
            start.setDate(today.getDate() - 3); // 3 days back
            end.setDate(today.getDate() + 4);   // 4 days forward (total 7 days)
            break;
          case "Month":
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
          case "Year":
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
          default:
            start.setDate(today.getDate() - 3);
            end.setDate(today.getDate() + 4);
        }
        
        return { start, end };
      };
  
      // Get all time ranges for comprehensive stats
      const dailyRange = getDateRange("Day");
      const weeklyRange = getDateRange("Week");
      const monthlyRange = getDateRange("Month");
      const yearlyRange = getDateRange("Year");
      const selectedRange = getDateRange(timeframe);
  
      console.log(`Selected range for ${timeframe}:`, selectedRange);
  
      // ======================
      // BASIC ENTITY COUNTS
      // ======================
      const totalClasses = await Class.countDocuments();
      const activeClasses = await Class.countDocuments({ status: "active" });
      const completedClasses = await Class.countDocuments({ status: "completed" });
      const totalTutors = await TutorProfile.countDocuments();
      const activeTutors = await TutorProfile.countDocuments({ isActive: true });
      const totalRooms = await Room.countDocuments();
      const activeRooms = await Room.countDocuments({ isActive: true });
  
      // Get unique students from all classes
      const allClasses = await Class.find({});
      const uniqueStudents = new Set();
      const activeStudents = new Set();
      
      allClasses.forEach(cls => {
        cls.students.forEach(student => {
          uniqueStudents.add(student.id.toString());
          if (cls.status === "active") {
            activeStudents.add(student.id.toString());
          }
        });
      });
      const totalStudents = uniqueStudents.size;
      const totalActiveStudents = activeStudents.size;
  
      // New students in selected timeframe
      const newStudents = await User.countDocuments({
        role: "student",
        createdAt: { $gte: selectedRange.start, $lte: selectedRange.end }
      });
  
      // New tutors in selected timeframe
      const newTutors = await TutorProfile.countDocuments({
        createdAt: { $gte: selectedRange.start, $lte: selectedRange.end }
      });
  
      // New classes in selected timeframe
      const newClasses = await Class.countDocuments({
        createdAt: { $gte: selectedRange.start, $lte: selectedRange.end }
      });
  
      // ======================
      // FINANCIAL DATA FETCHING
      // ======================
      
      // FIXED: Helper function with better date matching logic
      const getFinancialData = async (startDate, endDate) => {
        console.log(`Getting financial data for: ${startDate} to ${endDate}`);
        
        // Get all student payments (revenue) - using createdAt
        const revenuePayments = await Payment.find({
          createdAt: { $gte: startDate, $lte: endDate },
          type: "Payment",
          status: "completed"
        });
  
        // Get all tutor payouts (expenses) - using createdAt
        const payoutPayments = await Payment.find({
          createdAt: { $gte: startDate, $lte: endDate },
          type: "Payout",
          status: "completed"
        });
  
        // FIXED: Get sessions using date field AND include broader statuses
        const sessions = await ClassSession.find({
          date: { $gte: startDate, $lte: endDate },
          status: { $in: ["completed", "cancelled", "scheduled"] } // Include scheduled sessions too
        });
  
        console.log(`Found ${sessions.length} sessions in date range`);
        sessions.forEach(session => {
          console.log(`Session ${session._id}: date=${session.date}, status=${session.status}, organizingCost=${session.organizingCost}`);
        });
  
        const revenue = revenuePayments.reduce((sum, payment) => sum + payment.amount, 0);
        const tutorPayouts = payoutPayments.reduce((sum, payment) => sum + payment.amount, 0);
        
        // FIXED: Better organizing costs calculation
        const organizingCosts = sessions.reduce((sum, session) => {
          const cost = session.organizingCost;
          if (typeof cost === 'number' && !isNaN(cost) && cost >= 0) {
            console.log(`Adding organizing cost: ${cost} from session ${session._id}`);
            return sum + cost;
          }
          console.log(`Skipping session ${session._id} - invalid organizingCost: ${cost}`);
          return sum;
        }, 0);
        
        console.log(`Total organizing costs: ${organizingCosts}`);
        
        const totalExpenses = tutorPayouts + organizingCosts;
        const profit = revenue - totalExpenses;
  
        return {
          revenue,
          tutorPayouts,
          organizingCosts,
          totalExpenses,
          profit,
          revenuePayments: revenuePayments.length,
          payoutPayments: payoutPayments.length,
          sessionsCount: sessions.length
        };
      };
  
      // Get financial data for all time periods
      const dailyFinancials = await getFinancialData(dailyRange.start, dailyRange.end);
      const weeklyFinancials = await getFinancialData(weeklyRange.start, weeklyRange.end);
      const monthlyFinancials = await getFinancialData(monthlyRange.start, monthlyRange.end);
      const yearlyFinancials = await getFinancialData(yearlyRange.start, yearlyRange.end);
      const selectedFinancials = await getFinancialData(selectedRange.start, selectedRange.end);
  
      // Get all-time totals
      const allTimeRevenue = await Payment.aggregate([
        { $match: { type: "Payment", status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
  
      const allTimeTutorPayouts = await Payment.aggregate([
        { $match: { type: "Payout", status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
  
      // FIXED: All-time organizing costs with better filtering
      const allTimeOrgCosts = await ClassSession.aggregate([
        { 
          $match: { 
            organizingCost: { $exists: true, $type: "number", $gte: 0 },
            status: { $in: ["completed", "cancelled", "scheduled"] }
          } 
        },
        { $group: { _id: null, total: { $sum: "$organizingCost" } } }
      ]);
  
      const totalRevenue = allTimeRevenue[0]?.total || 0;
      const totalTutorPayouts = allTimeTutorPayouts[0]?.total || 0;
      const totalOrgCosts = allTimeOrgCosts[0]?.total || 0;
      const totalExpenses = totalTutorPayouts + totalOrgCosts;
      const totalProfit = totalRevenue - totalExpenses;
  
      console.log(`All-time totals: Revenue=${totalRevenue}, TutorPayouts=${totalTutorPayouts}, OrgCosts=${totalOrgCosts}`);
  
      // ======================
      // GROWTH CALCULATIONS
      // ======================
      
      const prevPeriodStart = new Date(selectedRange.start);
      const prevPeriodEnd = new Date(selectedRange.start);
      const periodLength = selectedRange.end - selectedRange.start;
      prevPeriodStart.setTime(prevPeriodStart.getTime() - periodLength);
  
      const prevPeriodFinancials = await getFinancialData(prevPeriodStart, prevPeriodEnd);
  
      const revenueGrowth = prevPeriodFinancials.revenue > 0 
        ? ((selectedFinancials.revenue - prevPeriodFinancials.revenue) / prevPeriodFinancials.revenue * 100)
        : selectedFinancials.revenue > 0 ? 100 : 0;
  
      const profitGrowth = prevPeriodFinancials.profit !== 0
        ? ((selectedFinancials.profit - prevPeriodFinancials.profit) / Math.abs(prevPeriodFinancials.profit) * 100)
        : selectedFinancials.profit > 0 ? 100 : selectedFinancials.profit < 0 ? -100 : 0;
  
      // ======================
      // DETAILED BREAKDOWNS
      // ======================
  
      const generateTimeSeriesData = (startDate, endDate, interval = 'day') => {
        const data = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
          let dateKey, displayName;
          const nextPeriod = new Date(current);
          
          if (interval === 'day') {
            dateKey = current.toISOString().split('T')[0];
            displayName = current.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            nextPeriod.setDate(nextPeriod.getDate() + 1);
          } else if (interval === 'week') {
            dateKey = current.toISOString().split('T')[0];
            displayName = `Week ${Math.ceil(current.getDate() / 7)}`;
            nextPeriod.setDate(nextPeriod.getDate() + 7);
          } else if (interval === 'month') {
            dateKey = `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`;
            displayName = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            nextPeriod.setMonth(nextPeriod.getMonth() + 1);
          }
          
          data.push({
            date: dateKey,
            displayName,
            revenue: 0,
            expenses: 0,
            profit: 0,
            tutorPayouts: 0,
            organizingCosts: 0,
            sessions: 0
          });
          
          current.setTime(nextPeriod.getTime());
        }
        
        return data;
      };
  
      const getInterval = () => {
        switch (timeframe) {
          case "Week": return 'day';
          case "Month": return 'day';
          case "Year": return 'month';
          default: return 'day';
        }
      };
  
      let timeSeriesData = generateTimeSeriesData(selectedRange.start, selectedRange.end, getInterval());
  
      // FIXED: Get all sessions with their associated payments for consistent date mapping
      const periodSessions = await ClassSession.find({
        date: { $gte: selectedRange.start, $lte: selectedRange.end },
        status: { $in: ["completed", "cancelled", "scheduled"] }
      }).populate({
        path: 'class',
        select: 'tutor students'
      });
  
      // Get all payments within the selected period
      const allPayments = await Payment.find({
        createdAt: { $gte: selectedRange.start, $lte: selectedRange.end },
        status: "completed"
      }).populate('classSessionId');
  
      console.log(`Time series data: Found ${allPayments.length} payments, ${periodSessions.length} sessions`);
  
      // FIXED: Use SESSION DATE for all financial data to ensure consistency
      periodSessions.forEach(session => {
        const sessionDate = new Date(session.date);
        let dateKey;
        
        if (getInterval() === 'day') {
          dateKey = sessionDate.toISOString().split('T')[0];
        } else {
          dateKey = `${sessionDate.getFullYear()}-${(sessionDate.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        
        const dataPoint = timeSeriesData.find(d => d.date === dateKey);
        if (dataPoint) {
          // Add organizing costs
          const orgCost = session.organizingCost;
          if (typeof orgCost === 'number' && !isNaN(orgCost) && orgCost >= 0) {
            dataPoint.organizingCosts += orgCost;
            dataPoint.expenses += orgCost;
            console.log(`Added ${orgCost} organizing cost to ${dateKey} for session ${session._id}`);
          }
  
          // Add tutor payouts for this session
          const sessionPayouts = allPayments.filter(payment => 
            payment.type === "Payout" && 
            payment.classSessionId && 
            payment.classSessionId._id.toString() === session._id.toString()
          );
          
          sessionPayouts.forEach(payout => {
            dataPoint.tutorPayouts += payout.amount;
            dataPoint.expenses += payout.amount;
            console.log(`Added ${payout.amount} tutor payout to ${dateKey} for session ${session._id}`);
          });
  
          // Add revenue for this session
          const sessionRevenue = allPayments.filter(payment => 
            payment.type === "Payment" && 
            payment.classSessionId && 
            payment.classSessionId._id.toString() === session._id.toString()
          );
          
          sessionRevenue.forEach(payment => {
            dataPoint.revenue += payment.amount;
            console.log(`Added ${payment.amount} revenue to ${dateKey} for session ${session._id}`);
          });
  
          dataPoint.sessions += 1;
        }
      });
  
      // FIXED: Also handle payments that might not be linked to specific sessions
      // This ensures all payments are captured even if session linking is incomplete
      const unlinkedPayments = allPayments.filter(payment => 
        !payment.classSessionId || 
        !periodSessions.find(session => session._id.toString() === payment.classSessionId._id?.toString())
      );
  
      unlinkedPayments.forEach(payment => {
        const paymentDate = new Date(payment.createdAt);
        let dateKey;
        
        if (getInterval() === 'day') {
          dateKey = paymentDate.toISOString().split('T')[0];
        } else {
          dateKey = `${paymentDate.getFullYear()}-${(paymentDate.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        
        const dataPoint = timeSeriesData.find(d => d.date === dateKey);
        if (dataPoint) {
          if (payment.type === "Payment") {
            dataPoint.revenue += payment.amount;
            console.log(`Added ${payment.amount} unlinked revenue to ${dateKey}`);
          } else if (payment.type === "Payout") {
            dataPoint.tutorPayouts += payment.amount;
            dataPoint.expenses += payment.amount;
            console.log(`Added ${payment.amount} unlinked payout to ${dateKey}`);
          }
        }
      });
  
      // Calculate profit for each data point
      timeSeriesData.forEach(dataPoint => {
        dataPoint.profit = dataPoint.revenue - dataPoint.expenses;
      });
  
      // VALIDATION: Ensure daily totals match weekly totals
      const dailyTotals = timeSeriesData.reduce((totals, point) => {
        totals.revenue += point.revenue;
        totals.expenses += point.expenses;
        totals.profit += point.profit;
        totals.tutorPayouts += point.tutorPayouts;
        totals.organizingCosts += point.organizingCosts;
        totals.sessions += point.sessions;
        return totals;
      }, { revenue: 0, expenses: 0, profit: 0, tutorPayouts: 0, organizingCosts: 0, sessions: 0 });
  
      console.log('=== VALIDATION ===');
      console.log('Weekly totals from getFinancialData:', {
        revenue: selectedFinancials.revenue,
        expenses: selectedFinancials.totalExpenses,
        profit: selectedFinancials.profit,
        tutorPayouts: selectedFinancials.tutorPayouts,
        organizingCosts: selectedFinancials.organizingCosts,
        sessions: selectedFinancials.sessionsCount
      });
      console.log('Daily totals from time series:', dailyTotals);
      
      // If there's a mismatch, adjust the data to match weekly totals
      if (Math.abs(dailyTotals.revenue - selectedFinancials.revenue) > 0.01 ||
          Math.abs(dailyTotals.expenses - selectedFinancials.totalExpenses) > 0.01) {
        
        console.log('MISMATCH DETECTED - Adjusting time series to match weekly totals');
        
        // Find the day with the highest activity to add any missing amounts
        const mostActiveDay = timeSeriesData.reduce((max, point) => 
          (point.revenue + point.expenses) > (max.revenue + max.expenses) ? point : max
        );
        
        // Adjust to match weekly totals
        const revenueDiff = selectedFinancials.revenue - dailyTotals.revenue;
        const expensesDiff = selectedFinancials.totalExpenses - dailyTotals.expenses;
        
        if (mostActiveDay && (Math.abs(revenueDiff) > 0.01 || Math.abs(expensesDiff) > 0.01)) {
          mostActiveDay.revenue += revenueDiff;
          mostActiveDay.expenses += expensesDiff;
          mostActiveDay.profit = mostActiveDay.revenue - mostActiveDay.expenses;
          
          console.log(`Adjusted ${mostActiveDay.date}: revenue +${revenueDiff}, expenses +${expensesDiff}`);
        }
      }
  
      // ======================
      // ADVANCED METRICS
      // ======================
  
      const averageRevenuePerStudent = totalStudents > 0 ? totalRevenue / totalStudents : 0;
      const averageProfitPerSession = selectedFinancials.sessionsCount > 0 ? selectedFinancials.profit / selectedFinancials.sessionsCount : 0;
      const averageRevenuePerSession = selectedFinancials.sessionsCount > 0 ? selectedFinancials.revenue / selectedFinancials.sessionsCount : 0;
      
      const profitMargin = selectedFinancials.revenue > 0 ? (selectedFinancials.profit / selectedFinancials.revenue * 100) : 0;
      const totalProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0;
  
      const sessionsPerTutor = activeTutors > 0 ? selectedFinancials.sessionsCount / activeTutors : 0;
      const revenuePerTutor = activeTutors > 0 ? selectedFinancials.revenue / activeTutors : 0;
  
      // ======================
      // TOP PERFORMERS
      // ======================
  
      const topTutorsByRevenue = await Payment.aggregate([
        {
          $match: {
            type: "Payment",
            status: "completed",
            createdAt: { $gte: selectedRange.start, $lte: selectedRange.end }
          }
        },
        {
          $lookup: {
            from: "classsessions",
            localField: "classSessionId",
            foreignField: "_id",
            as: "session"
          }
        },
        { $unwind: "$session" },
        {
          $lookup: {
            from: "classes",
            localField: "session.class",
            foreignField: "_id",
            as: "class"
          }
        },
        { $unwind: "$class" },
        {
          $lookup: {
            from: "tutorprofiles",
            localField: "class.tutor",
            foreignField: "_id",
            as: "tutor"
          }
        },
        { $unwind: "$tutor" },
        {
          $lookup: {
            from: "users",
            localField: "tutor.user",
            foreignField: "_id",
            as: "tutorUser"
          }
        },
        { $unwind: "$tutorUser" },
        {
          $group: {
            _id: "$tutor._id",
            tutorName: { $first: { $concat: ["$tutorUser.firstName", " ", "$tutorUser.lastName"] } },
            totalRevenue: { $sum: "$amount" },
            sessionCount: { $sum: 1 },
            subjects: { $addToSet: "$class.subject" }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ]);
      
      // NEW: Get revenue by subject
      const subjectsByRevenue = await Payment.aggregate([
        {
          $match: {
            type: "Payment",
            status: "completed",
            createdAt: { $gte: selectedRange.start, $lte: selectedRange.end }
          }
        },
        {
          $lookup: {
            from: "classsessions",
            localField: "classSessionId",
            foreignField: "_id",
            as: "session"
          }
        },
        { $unwind: { path: "$session", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "classes",
            localField: "session.class",
            foreignField: "_id",
            as: "class"
          }
        },
        { $unwind: { path: "$class", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$class.subject",
            totalRevenue: { $sum: "$amount" },
            sessionCount: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]);
      
      // Filter out null/undefined subjects and format
      const formattedSubjectsByRevenue = subjectsByRevenue
        .filter(item => item._id) // Filter out null/undefined subjects
        .map(item => ({
          subject: item._id,
          revenue: item.totalRevenue,
          sessions: item.sessionCount,
          averagePerSession: item.sessionCount > 0 ? (item.totalRevenue / item.sessionCount).toFixed(2) : 0
        }));
      
      // Find the top revenue-generating subject
      const topRevenueSubject = formattedSubjectsByRevenue.length > 0 ? formattedSubjectsByRevenue[0] : {
        subject: 'No data available',
        revenue: 0,
        sessions: 0,
        averagePerSession: 0
      };
  
      // Recent activities
      const recentPayments = await Payment.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("user", "firstName lastName")
        .populate({
          path: "classId",
          select: "subject"
        });
  
      const formattedPayments = recentPayments.map(payment => ({
        id: payment._id,
        amount: payment.amount,
        type: payment.type,
        status: payment.status,
        date: payment.createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        user: payment.user ? `${payment.user.firstName} ${payment.user.lastName}` : 'Unknown',
        subject: payment.classId?.subject || 'N/A',
        description: payment.reason || `${payment.type} - ${payment.classId?.subject || 'Class'}`
      }));
  
      // ======================
      // RESPONSE STRUCTURE
      // ======================
  
      const response = {
        status: "success",
        data: {
          mainKPIs: {
            totalRevenue,
            totalProfit,
            totalExpenses,
            totalProfitMargin: totalProfitMargin.toFixed(2),
            totalStudents,
            activeStudents: totalActiveStudents,
            totalTutors,
            activeTutors,
            totalClasses,
            activeClasses,
            totalRooms,
            activeRooms,
            totalSessions: await ClassSession.countDocuments(),
            newStudents,
            newTutors,
            newClasses,
            topRevenueSubject: topRevenueSubject.subject // NEW: Added top revenue subject
          },
  
          timeBasedMetrics: {
            daily: {
              revenue: dailyFinancials.revenue,
              profit: dailyFinancials.profit,
              expenses: dailyFinancials.totalExpenses,
              sessions: dailyFinancials.sessionsCount,
              profitMargin: dailyFinancials.revenue > 0 ? (dailyFinancials.profit / dailyFinancials.revenue * 100).toFixed(2) : 0,
              organizingCosts: dailyFinancials.organizingCosts,
              tutorPayouts: dailyFinancials.tutorPayouts
            },
            weekly: {
              revenue: weeklyFinancials.revenue,
              profit: weeklyFinancials.profit,
              expenses: weeklyFinancials.totalExpenses,
              sessions: weeklyFinancials.sessionsCount,
              profitMargin: weeklyFinancials.revenue > 0 ? (weeklyFinancials.profit / weeklyFinancials.revenue * 100).toFixed(2) : 0,
              organizingCosts: weeklyFinancials.organizingCosts,
              tutorPayouts: weeklyFinancials.tutorPayouts
            },
            monthly: {
              revenue: monthlyFinancials.revenue,
              profit: monthlyFinancials.profit,
              expenses: monthlyFinancials.totalExpenses,
              sessions: monthlyFinancials.sessionsCount,
              profitMargin: monthlyFinancials.revenue > 0 ? (monthlyFinancials.profit / monthlyFinancials.revenue * 100).toFixed(2) : 0,
              organizingCosts: monthlyFinancials.organizingCosts,
              tutorPayouts: monthlyFinancials.tutorPayouts
            },
            yearly: {
              revenue: yearlyFinancials.revenue,
              profit: yearlyFinancials.profit,
              expenses: yearlyFinancials.totalExpenses,
              sessions: yearlyFinancials.sessionsCount,
              profitMargin: yearlyFinancials.revenue > 0 ? (yearlyFinancials.profit / yearlyFinancials.revenue * 100).toFixed(2) : 0,
              organizingCosts: yearlyFinancials.organizingCosts,
              tutorPayouts: yearlyFinancials.tutorPayouts
            }
          },
  
          selectedPeriod: {
            timeframe,
            revenue: selectedFinancials.revenue,
            profit: selectedFinancials.profit,
            expenses: selectedFinancials.totalExpenses,
            tutorPayouts: selectedFinancials.tutorPayouts,
            organizingCosts: selectedFinancials.organizingCosts,
            sessions: selectedFinancials.sessionsCount,
            profitMargin: profitMargin.toFixed(2),
            newStudents,
            revenueGrowth: revenueGrowth.toFixed(2),
            profitGrowth: profitGrowth.toFixed(2),
            topRevenueSubject: topRevenueSubject.subject // NEW: Added top revenue subject
          },
  
          advancedMetrics: {
            averageRevenuePerStudent: averageRevenuePerStudent.toFixed(2),
            averageProfitPerSession: averageProfitPerSession.toFixed(2),
            averageRevenuePerSession: averageRevenuePerSession.toFixed(2),
            sessionsPerTutor: sessionsPerTutor.toFixed(2),
            revenuePerTutor: revenuePerTutor.toFixed(2),
            classCompletionRate: totalClasses > 0 ? ((completedClasses / totalClasses) * 100).toFixed(2) : 0,
            studentRetentionRate: totalStudents > 0 ? ((totalActiveStudents / totalStudents) * 100).toFixed(2) : 0,
            averageClassSize: totalClasses > 0 ? (totalStudents / totalClasses).toFixed(1) : 0,
            tutorUtilizationRate: totalTutors > 0 ? ((activeTutors / totalTutors) * 100).toFixed(2) : 0,
            roomUtilizationRate: totalRooms > 0 ? ((activeRooms / totalRooms) * 100).toFixed(2) : 0,
            studentsPerTutor: activeTutors > 0 ? (totalActiveStudents / activeTutors).toFixed(1) : 0,
            classesPerRoom: totalRooms > 0 ? (activeClasses / totalRooms).toFixed(1) : 0,
            activeStudentRate: totalStudents > 0 ? ((totalActiveStudents / totalStudents) * 100).toFixed(2) : 0,
            activeClassRate: totalClasses > 0 ? ((activeClasses / totalClasses) * 100).toFixed(2) : 0
          },
  
          charts: {
            timeSeries: timeSeriesData.map(point => ({
              period: point.displayName,
              date: point.date,
              revenue: point.revenue,
              expenses: point.expenses,
              profit: point.profit,
              tutorPayouts: point.tutorPayouts,
              organizingCosts: point.organizingCosts,
              sessions: point.sessions
            })),
            topTutors: topTutorsByRevenue.map(tutor => ({
              id: tutor._id,
              name: tutor.tutorName,
              revenue: tutor.totalRevenue,
              sessions: tutor.sessionCount,
              subjects: tutor.subjects
            })),
            subjectsByRevenue: formattedSubjectsByRevenue
          },
          recentActivities: formattedPayments
        }
      }
        res.status(200).json(response);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ status: "error", message: "Internal Server Error" });
      }
  }
};


// Updated getClassSessions function
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
      sessionType: session.sessionType,
      organizingCost: session.organizingCost,
      teacherPayout: session.teacherPayout,
      totalStudentRevenue: session.totalStudentRevenue,
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

// Updated getClassSessionsStats function
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

      // Financial stats
      totalOrganizingCosts: sessions.reduce((sum, s) => sum + (s.organizingCost || 0), 0),
      totalTeacherPayouts: sessions.reduce((sum, s) => sum + (s.teacherPayout || 0), 0),
      totalStudentRevenue: sessions.reduce((sum, s) => sum + (s.totalStudentRevenue || 0), 0),

      // Session type breakdown
      sessionTypes: {
        online: sessions.filter((s) => s.sessionType === "online").length,
        "our-space": sessions.filter((s) => s.sessionType === "our-space").length,
        "student-place": sessions.filter((s) => s.sessionType === "student-place").length,
      },

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