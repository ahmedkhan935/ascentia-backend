const mongoose = require('mongoose');
const Class = require('../../models/Class');
const User = require('../../models/User');
const ClassSession = require('../../models/ClassSession');
const Room = require('../../models/Room');
const Payment = require('../../models/Payment');

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
    async createClass(req, res) {
        try {
            const { subject, price, tutor, students, sessions, room, frequency, tutorPayout, startDate, endDate } = req.body;
            const type = students.length > 1 ? "group" : "individual";
            
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
            
            // Generate sessions for each scheduled day
            const generatedSessions = [];
            for (const session of sessions) {
                const sessionDates = generateSessionDates(startDate, endDate, session.dayOfWeek);
                
                // Create a session for each date
                for (const date of sessionDates) {
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
            console.log("here");
            //add entries in payment table
            const payments = [];
            console.log(students);
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
            console.log("here");
            
            const tutorPayment = new Payment({
                user: tutor,
                amount: tutorPayout,
                class: savedClass._id,
                status: 'pending',
                type: 'Payout',
            });
            await tutorPayment.save();
            console.log("here");

            
            res.status(201).json({
                status: "success",
                data: {
                    class: savedClass,
                    sessions: generatedSessions
                }
            });
        } catch (error) {
            res.status(400).json({ message: error.message, status: "failed" });
        }
    }
};

module.exports = ClassController;