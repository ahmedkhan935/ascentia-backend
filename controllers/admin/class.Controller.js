const mongoose = require('mongoose');
const Class = require('../../models/Class');
const User = require('../../models/User');
const ClassSession = require('../../models/ClassSession');
const Room = require('../../models/Room');
const Payment = require('../../models/Payment');
const Tutor = require("../../models/Tutor");

// Helper function to check if a room is available for a specific time slot
async function checkRoomAvailability(roomId, date, startTime, endTime) {
    if (!roomId) return true; // If no room specified, consider it available
    
    const room = await Room.findById(roomId);
    if (!room) return false;
    
    // Check existing bookings for conflicts
    const conflictingBooking = room.bookings.find(booking => {
        const sameDate = booking.date.toDateString() === new Date(date).toDateString();
        if (!sameDate) return false;
        
        // Convert times to minutes for easier comparison
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        const [bookingStartHour, bookingStartMin] = booking.startTime.split(':').map(Number);
        const [bookingEndHour, bookingEndMin] = booking.endTime.split(':').map(Number);
        
        const sessionStart = startHour * 60 + startMin;
        const sessionEnd = endHour * 60 + endMin;
        const bookingStart = bookingStartHour * 60 + bookingStartMin;
        const bookingEnd = bookingEndHour * 60 + bookingEndMin;
        
        // Check for overlap
        return (sessionStart < bookingEnd && sessionEnd > bookingStart);
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
    const [timeHours, timeMinutes] = time.split(':').map(Number);
    const [startHours, startMinutes] = shiftStart.split(':').map(Number);
    const [endHours, endMinutes] = shiftEnd.split(':').map(Number);
    
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
        status: 'active'
    });

    // Get all sessions for these classes
    const existingSessions = await ClassSession.find({
        class: { $in: existingClasses.map(c => c._id) },
        date: date,
        status: { $in: ['scheduled', 'completed'] }
    });

    // Check for time conflicts
    for (const session of existingSessions) {
        const sessionStart = session.startTime;
        const sessionEnd = session.endTime;

        // Check if the new time slot overlaps with existing session
        if (
            (startTime >= sessionStart && startTime < sessionEnd) ||
            (endTime > sessionStart && endTime <= sessionEnd) ||
            (startTime <= sessionStart && endTime >= sessionEnd)
        ) {
            return false;
        }
    }

    return true;
};
// Helper function to create a class session
async function createClassSession(classId, date, startTime, endTime, roomId) {
    // Check room availability
    const isRoomAvailable = await checkRoomAvailability(roomId, date, startTime, endTime);
    
    // Create the session
    const session = new ClassSession({
        class: classId,
        date: date,
        startTime: startTime,
        endTime: endTime,
        room: isRoomAvailable ? roomId : null,
        status: 'scheduled'
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
                    classSession: savedSession._id
                }
            }
        });
    }
    
    return savedSession;
}

const ClassController = {
    // async createClass(req, res) {
    //     try {
    //         const { subject, price, tutor, students, sessions, room, frequency, tutorPayout, startDate, endDate } = req.body;
    //         const type = students.length > 1 ? "group" : "individual";
            


            
    //         // Create the class
    //         const newClass = new Class({
    //             subject,
    //             price,
    //             tutor,
    //             students,
    //             sessions,
    //             allocatedRoom: room,
    //             frequency,
    //             tutorPayout,
    //             startDate,
    //             endDate,
    //             type
    //         });
            
    //         const savedClass = await newClass.save();
            
    //         // Generate sessions for each scheduled day
    //         const generatedSessions = [];
    //         for (const session of sessions) {
    //             const sessionDates = generateSessionDates(startDate, endDate, session.dayOfWeek);
                
    //             // Create a session for each date
    //             for (const date of sessionDates) {
    //                 const classSession = await createClassSession(
    //                     savedClass._id,
    //                     date,
    //                     session.startTime,
    //                     session.endTime,
    //                     room
    //                 );
    //                 generatedSessions.push(classSession);
    //             }
    //         }
    //         console.log("here");
    //         //add entries in payment table
    //         const payments = [];
    //         console.log(students);
    //         for (const student of students) {
    //             const payment = new Payment({
    //                 user: student.id,
    //                 amount: student.price,
    //                 class: savedClass._id,
    //                 status: 'pending',
    //                 type: 'Payment',
    //             });
    //             await payment.save();
    //             payments.push(payment);
    //         }
    //         console.log("here");
            
    //         const tutorPayment = new Payment({
    //             user: tutor,
    //             amount: tutorPayout,
    //             class: savedClass._id,
    //             status: 'pending',
    //             type: 'Payout',
    //         });
    //         await tutorPayment.save();
    //         console.log("here");

            
    //         res.status(201).json({
    //             status: "success",
    //             data: {
    //                 class: savedClass,
    //                 sessions: generatedSessions
    //             }
    //         });
    //     } catch (error) {
    //         res.status(400).json({ message: error.message, status: "failed" });
    //     }
    // },
    async createClass(req, res) {
        try {
            const { subject, price, tutor, students, sessions, room, frequency, tutorPayout, startDate, endDate } = req.body;
            const type = students.length > 1 ? "group" : "individual";

            // Get tutor's shifts
            const tutorProfile = await Tutor.findOne({ _id: tutor });
            if (!tutorProfile) {
                return res.status(400).json({ 
                    status: "failed", 
                    message: "Tutor profile not found" 
                });
            }

            // Validate each session against tutor's shifts
            for (const session of sessions) {
                console.log(session);
                console.log(tutorProfile.shifts);
                const dayShifts = tutorProfile.shifts.filter(shift => 
                    shift.dayOfWeek == session.dayOfWeek
                );

                if (dayShifts.length === 0) {
                    return res.status(400).json({
                        status: "failed",
                        message: `Tutor is not available on day ${session.dayOfWeek}`
                    });
                }

                const isTimeValid = dayShifts.some(shift =>
                    isTimeWithinShift(session.startTime, shift.startTime, shift.endTime) &&
                    isTimeWithinShift(session.endTime, shift.startTime, shift.endTime)
                );

                if (!isTimeValid) {
                    return res.status(400).json({
                        status: "failed",
                        message: `Session time ${session.startTime}-${session.endTime} is outside tutor's availability`
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
                frequency,
                tutorPayout,
                startDate,
                endDate,
                type
            });
            
            const savedClass = await newClass.save();
            
            // Generate and validate sessions for each scheduled day
            const generatedSessions = [];
            for (const session of sessions) {
                const sessionDates = generateSessionDates(startDate, endDate, session.dayOfWeek);
                
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
                            message: `Tutor has a scheduling conflict on ${date.toISOString().split('T')[0]} at ${session.startTime}-${session.endTime}`
                        });
                    }

                    const classSession = await createClassSession(
                        savedClass._id,
                        date,
                        session.startTime,
                        session.endTime,
                        room
                    );
                    generatedSessions.push(classSession);
                }
            }

            // Create payments
            const payments = [];
            for (const student of students) {
                const payment = new Payment({
                    user: student.id,
                    amount: student.price,
                    class: savedClass._id,
                    status: 'pending',
                    type: 'Payment',
                    
                });
                await payment.save();
                payments.push(payment);
            }
            
            const tutorPayment = new Payment({
                user: tutor,
                amount: tutorPayout,
                class: savedClass._id,
                status: 'pending',
                type: 'Payout',
                paymentMethod: 'stripe' // or handle from request
            });
            await tutorPayment.save();
            
            res.status(201).json({
                status: "success",
                data: {
                    class: savedClass,
                    sessions: generatedSessions,
                    payments: [...payments, tutorPayment]
                }
            });
        } catch (error) {
            res.status(400).json({ message: error.message, status: "failed" });
        }
    },
  
    getAllSessions : async (req, res) => {
        try {
            const sessions = await ClassSession.find().populate('class').populate('room');

            res.status(200).json({ sessions, status: "success" });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching sessions', error: error.message, status: "Error" });
        }
    },
    assignRoomToSession : async (req,res) => {
        try
        {
            const {roomId,sessionId} = req.body;
            const session = await ClassSession.findById(sessionId);
            if(!session)
            {
                return res.status(404).json({ message: 'Session not found', status: "failed" });
            }
            //check if already assigned a room if yes then remove the booking from that room
            if(session.room)
            {
                const room = await Room.findById(session.room);
                const bookingIndex = room.bookings.findIndex(booking => booking.classSession.toString() === sessionId);
                await Room.findByIdAndUpdate(session.room, {
                    $pull: {
                        bookings: room.bookings[bookingIndex]
                    }
                });
            }
            const room = await Room.findById(roomId);
            if(!room)
            {
                return res.status(404).json({ message: 'Room not found', status: "failed" });
            }
            const isRoomAvailable = await checkRoomAvailability(roomId, session.date, session.startTime, session.endTime);
            if(!isRoomAvailable)
            {
                return res.status(400).json({ message: 'Room not available for this time slot', status: "failed" });
            }
            await Room.findByIdAndUpdate(roomId, {
                $push: {
                    bookings: {
                        date: session.date,
                        startTime: session.startTime,
                        endTime: session.endTime,
                        class: session.class,
                        classSession: session._id
                    }
                }
            });
            await ClassSession.findByIdAndUpdate(sessionId,{room:roomId});
            res.status(200).json({ message: 'Room assigned to session', status: "success" });
        }
        catch(error)
        {
            res.status(500).json({ message: 'Error assigning room to session', error: error.message, status: "Error" });
        }
    },
    unassignRoomFromSession : async (req,res) => {
        try
        {
    const {sessionId} = req.body;
    const session = await ClassSession.findById(sessionId);
    if(!session)
    {
        return res.status(404).json({ message: 'Session not found', status: "failed" });
    }
    if(!session.room)
    {
        return res.status(400).json({ message: 'Session is not assigned to any room', status: "failed" });
    }
    //remove the booking from room 
    const room = await Room.findById(session.room);
    const bookingIndex = room.bookings.findIndex(booking => booking.classSession.toString() === sessionId);
    const updatedRoom = await Room.findByIdAndUpdate(session.room, {
        $pull: {
            bookings: room.bookings[bookingIndex]
        }
    });

    const updatedSession = await ClassSession.findByIdAndUpdate(sessionId,{room:null});
    res.status(200).json({ message: 'Room unassigned from session', status: "success" });   
}
catch(error)
{
    res.status(500).json({ message: 'Error unassigning room from session', error: error.message, status: "Error" });
}
    

    },
};


module.exports = ClassController;