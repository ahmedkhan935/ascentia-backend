const Room = require('../../models/Room');
const Class = require('../../models/Class');
const ClassSession = require('../../models/ClassSession');
const Activity = require('../../models/Activity');
const moment = require('moment');

const RoomAvailabilityController = {
    // Check room availability
    checkAvailability: async (req, res) => {
        try {
            const { roomId } = req.params;
            const { date, startTime, endTime } = req.query;
            
            // Validate inputs
            if (!roomId || !date || !startTime || !endTime) {
                return res.status(400).json({ 
                    message: 'Missing required parameters', 
                    required: ['roomId', 'date', 'startTime', 'endTime'] 
                });
            }
            
            // Find the room
            const room = await Room.findById(roomId);
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }
            
            // Check for time conflicts
            const checkDate = new Date(date);
            const isAvailable = !room.bookings.some(booking => {
                return booking.date.toDateString() === checkDate.toDateString() &&
                    (
                        (booking.startTime <= startTime && booking.endTime > startTime) ||
                        (booking.startTime < endTime && booking.endTime >= endTime) ||
                        (booking.startTime >= startTime && booking.endTime <= endTime)
                    );
            });
            
            res.json({ 
                available: isAvailable,
                room: {
                    id: room._id,
                    name: room.name,
                    description: room.description
                },
                requestedTime: {
                    date,
                    startTime,
                    endTime
                }
            });
        } catch (error) {
            res.status(500).json({ message: 'Error checking room availability', error: error.message });
        }
    },
    
    // Get available rooms for a specific time slot
    getAvailableRooms: async (req, res) => {
        try {
            const { date, startTime, endTime } = req.query;
            
            // Validate inputs
            if (!date || !startTime || !endTime) {
                return res.status(400).json({ 
                    message: 'Missing required parameters', 
                    required: ['date', 'startTime', 'endTime'] 
                });
            }
            
            // Find all rooms
            const allRooms = await Room.find();
            
            // Filter available rooms
            const checkDate = new Date(date);
            const availableRooms = allRooms.filter(room => {
                return !room.bookings.some(booking => {
                    return booking.date.toDateString() === checkDate.toDateString() &&
                        (
                            (booking.startTime <= startTime && booking.endTime > startTime) ||
                            (booking.startTime < endTime && booking.endTime >= endTime) ||
                            (booking.startTime >= startTime && booking.endTime <= endTime)
                        );
                });
            });
            
            // Map rooms to simpler format
            const formattedRooms = availableRooms.map(room => ({
                id: room._id,
                name: room.name,
                description: room.description
            }));
            
            res.json({ 
                availableRooms: formattedRooms,
                requestedTime: {
                    date,
                    startTime,
                    endTime
                },
                totalAvailable: formattedRooms.length,
                totalRooms: allRooms.length
            });
        } catch (error) {
            res.status(500).json({ message: 'Error finding available rooms', error: error.message });
        }
    },
    
    // Get room schedule for a specific day
    getRoomSchedule: async (req, res) => {
        try {
            const { roomId } = req.params;
            const { date } = req.query;
            
            // Validate inputs
            if (!roomId || !date) {
                return res.status(400).json({ 
                    message: 'Missing required parameters', 
                    required: ['roomId', 'date'] 
                });
            }
            
            // Find the room
            const room = await Room.findById(roomId)
                .populate({
                    path: 'bookings.class',
                    select: 'name instructor'
                })
                .populate({
                    path: 'bookings.classSession',
                    select: 'name sessionNumber'
                })
                .populate({
                    path: 'bookings.user',
                    select: 'name email'
                });
                
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }
            
            // Filter bookings for the requested date
            const checkDate = new Date(date);
            const schedule = room.bookings
                .filter(booking => booking.date.toDateString() === checkDate.toDateString())
                .map(booking => ({
                    id: booking._id,
                    date: booking.date,
                    startTime: booking.startTime,
                    endTime: booking.endTime,
                    duration: moment(`2000-01-01T${booking.endTime}`).diff(moment(`2000-01-01T${booking.startTime}`), 'minutes'),
                    description: booking.description,
                    class: booking.class ? {
                        id: booking.class._id,
                        name: booking.class.name,
                        instructor: booking.class.instructor
                    } : null,
                    classSession: booking.classSession ? {
                        id: booking.classSession._id,
                        name: booking.classSession.name,
                        sessionNumber: booking.classSession.sessionNumber
                    } : null,
                    user: booking.user ? {
                        id: booking.user._id,
                        name: booking.user.name,
                        email: booking.user.email
                    } : null
                }))
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
            
            res.json({
                room: {
                    id: room._id,
                    name: room.name,
                    description: room.description
                },
                date: checkDate,
                schedule,
                totalBookings: schedule.length
            });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching room schedule', error: error.message });
        }
    },
    
    // Get overall room usage statistics
    getRoomUsageStats: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            
            // Default to last 30 days if no dates provided
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            
            // Find all rooms
            const rooms = await Room.find();
            
            // Calculate usage stats
            const stats = rooms.map(room => {
                // Filter bookings within date range
                const relevantBookings = room.bookings.filter(booking => 
                    booking.date >= start && booking.date <= end
                );
                
                // Calculate total hours booked
                let totalMinutesBooked = 0;
                relevantBookings.forEach(booking => {
                    const startMinutes = parseInt(booking.startTime.split(':')[0]) * 60 + parseInt(booking.startTime.split(':')[1]);
                    const endMinutes = parseInt(booking.endTime.split(':')[0]) * 60 + parseInt(booking.endTime.split(':')[1]);
                    totalMinutesBooked += endMinutes - startMinutes;
                });
                
                return {
                    id: room._id,
                    name: room.name,
                    bookingCount: relevantBookings.length,
                    hoursBooked: (totalMinutesBooked / 60).toFixed(2),
                    // Assuming 8-hour operational day (8am-4pm)
                    utilizationRate: ((totalMinutesBooked / 60) / (((end - start) / (24 * 60 * 60 * 1000) + 1) * 8)).toFixed(4)
                };
            });
            
            // Sort by utilization rate (highest first)
            stats.sort((a, b) => b.utilizationRate - a.utilizationRate);
            
            res.json({
                dateRange: {
                    start,
                    end,
                    days: Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1
                },
                roomStats: stats,
                totalRooms: rooms.length,
                totalBookings: stats.reduce((sum, room) => sum + room.bookingCount, 0),
                totalHoursBooked: stats.reduce((sum, room) => sum + parseFloat(room.hoursBooked), 0).toFixed(2),
                averageUtilizationRate: (stats.reduce((sum, room) => sum + parseFloat(room.utilizationRate), 0) / stats.length).toFixed(4)
            });
        } catch (error) {
            res.status(500).json({ message: 'Error calculating room usage statistics', error: error.message });
        }
    }
};

module.exports = RoomAvailabilityController;