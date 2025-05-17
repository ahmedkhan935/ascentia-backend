const Room = require('../../models/Room');
const Booking=require("../../models/Booking")
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
            
            // Parse the date correctly
            let checkDate;
            try {
                checkDate = new Date(date);
                // Check if date is valid
                if (isNaN(checkDate.getTime())) {
                    return res.status(400).json({ 
                        message: 'Invalid date format. Please use YYYY-MM-DD format.',
                    });
                }
            } catch (err) {
                return res.status(400).json({ 
                    message: 'Invalid date format. Please use YYYY-MM-DD format.',
                    error: err.message
                });
            }
            
            // Validate time format (HH:MM)
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
                return res.status(400).json({ 
                    message: 'Invalid time format. Please use HH:MM format (24-hour).',
                });
            }
            
            // Check if end time is after start time
            if (startTime >= endTime) {
                return res.status(400).json({ 
                    message: 'End time must be after start time',
                });
            }
            
            // Find all rooms
            const allRooms = await Room.find();
            
            // Filter available rooms
            const availableRooms = allRooms.filter(room => {
                // If room has no bookings, it's available
                if (!room.bookings || room.bookings.length === 0) {
                    return true;
                }
                
                // Check if there are any overlapping bookings
                return !room.bookings.some(booking => {
                    // Make sure booking has valid date
                    if (!booking.date) return false;
                    
                    // Convert booking date to string for comparison
                    const bookingDate = new Date(booking.date);
                    const bookingDateStr = bookingDate.toDateString();
                    const checkDateStr = checkDate.toDateString();
                    
                    // First check if it's the same date
                    if (bookingDateStr !== checkDateStr) {
                        return false; // Different date, no overlap
                    }
                    
                    // Check for time overlap
                    // Overlap happens when:
                    // 1. Booking starts during requested time (booking.startTime >= startTime && booking.startTime < endTime)
                    // 2. Booking ends during requested time (booking.endTime > startTime && booking.endTime <= endTime)
                    // 3. Booking completely contains requested time (booking.startTime <= startTime && booking.endTime >= endTime)
                    return (
                        (booking.startTime < endTime && booking.startTime >= startTime) ||
                        (booking.endTime > startTime && booking.endTime <= endTime) ||
                        (booking.startTime <= startTime && booking.endTime >= endTime)
                    );
                });
            });
            
            // Map rooms to simpler format
            const formattedRooms = availableRooms.map(room => ({
                id: room._id,
                name: room.name,
                description: room.description,
                totalBookings: room.bookings ? room.bookings.length : 0
            }));
            
            res.json({
                availableRooms: formattedRooms,
                requestedTime: {
                    date: checkDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
                    startTime,
                    endTime
                },
                totalAvailable: formattedRooms.length,
                totalRooms: allRooms.length
            });
        } catch (error) {
            console.error('Error finding available rooms:', error);
            res.status(500).json({ message: 'Error finding available rooms', error: error.message });
        }
    },
    getRoomSchedule: async (req, res) => {
        try {
          const { roomId } = req.params;
          const { date }   = req.query;
      
          // ──────────────────────────────────── validation ──────────────────────────
          if (!roomId || !date) {
            return res.status(400).json({
              message : 'Missing required parameters',
              required: ['roomId', 'date']
            });
          }
      
          // ──────────────────────────────── fetch & populate ────────────────────────
          const room = await Room.findById(roomId)
            // bring in the class (so we can see its tutor)
            .populate({
              path  : 'bookings.class',
              select: 'name tutor',
              populate: {                              // nested → TutorProfile
                path  : 'tutor',
                select: 'user',                        // we only need user field
                populate: {                            // nested → User
                  path  : 'user',
                  select: 'firstName lastName email'
                }
              }
            })
            // bring in the classSession for extra context (unchanged)
            .populate({
              path  : 'bookings.classSession',
              select: 'name sessionNumber'
            });
      
          if (!room) return res.status(404).json({ message: 'Room not found' });
      
          // ───────────────────────────── filter for the day ─────────────────────────
          const checkDate = new Date(date); // incoming YYYY-MM-DD
          const formattedBookings = room.bookings
            .filter(b => {
              if (!b.date) return false;
              return new Date(b.date).toDateString() === checkDate.toDateString();
            })
            .map(b => {
              const duration = moment(`2000-01-01T${b.endTime}`)
                .diff(moment(`2000-01-01T${b.startTime}`), 'minutes');
      
              const tutorBlock = b.class && b.class.tutor
                ? {
                    id       : b.class.tutor._id,
                    firstName: b.class.tutor.user?.firstName,
                    lastName : b.class.tutor.user?.lastName,
                    email    : b.class.tutor.user?.email
                  }
                : null;
      
              return {
                _id        : b._id,
                date       : moment(b.date).format('YYYY-MM-DD'),
                startTime  : b.startTime,
                endTime    : b.endTime,
                title      : b.class ? b.class.name : 'Booked Session',
                description: b.description,
                duration,
                classId    : b.class ? b.class._id : null,
                className  : b.class ? b.class.name : null,
                tutor      : tutorBlock,
                classSession: b.classSession
                  ? {
                      id           : b.classSession._id,
                      name         : b.classSession.name,
                      sessionNumber: b.classSession.sessionNumber
                    }
                  : null
              };
            })
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
      
          // ──────────────────────────────────── respond ─────────────────────────────
          res.json({
            room: {
              id         : room._id,
              name       : room.name,
              description: room.description
            },
            date          : checkDate,
            bookings      : formattedBookings,
            totalBookings : formattedBookings.length
          });
        } catch (err) {
          /* eslint-disable no-console */
          console.error('Room schedule error:', err);
          /* eslint-enable  no-console */
          res.status(500).json({
            message: 'Error fetching room schedule',
            error  : err.message
          });
        }
      },
    
    // Get overall room usage statistics
    getRoomUsageStats: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            
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