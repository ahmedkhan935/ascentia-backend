const Room= require('../../models/Room');
const Class= require('../../models/Class');
const User= require('../../models/User');


const RoomController = {
    AddRoom: async (req, res) => {
        try {
            const { name, description } = req.body;
            const newRoom = new Room({
                name,
                description
            });
            await newRoom.save();
            res.status(201).json({ message: 'Room added successfully', room: newRoom });
        } catch (error) {
            res.status(500).json({ message: 'Error adding room', error: error.message });
        }
    },
    GetAllRooms: async (req, res) => {
        try {
            const rooms = await Room.find();
            res.json(rooms);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching rooms', error: error.message });
        }
    },
    GetRoom: async (req, res) => {
        try {
            const
            { id } = req.params;    
            const room = await Room.findById(id)
            .populate('bookings.user', 'firstName lastName email')
            .populate('bookings.class');
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }
            res.json(room);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching room', error: error.message });
        }
    },
    UpdateRoom: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description } = req.body;
            const room = await Room.findByIdAndUpdate(id, { name, description }, { new: true });
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }
            res.json({ message: 'Room updated successfully', room });
        } catch (error) {
            res.status(500).json({ message: 'Error updating room', error: error.message });
        }
    },
    DeleteRoom: async (req, res) => {
        try {
            const { id } = req.params;
            const room = await Room.findByIdAndDelete(id);
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }
            res.json({ message: 'Room deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error deleting room', error: error.message });
        }
    },
    AddBooking: async (req, res) => {
        try {
            const { id } = req.params;
            const { date, startTime, endTime, classId } = req.body;
            const room = await Room.findById(id);
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }
            //check for the booking time conflict
            const existingBooking = room.bookings.find(b => {
                return b.date.toDateString() === new Date(date).toDateString() &&
                    (
                        (b.startTime <= startTime && b.endTime > startTime) ||
                        (b.startTime < endTime && b.endTime >= endTime) ||
                        (b.startTime >= startTime && b.endTime <= endTime)
                    );
            });
            if (existingBooking) {
                return res.status(400).json({ message: 'Booking time conflicts with an existing booking' });
            }
            const booking = {
                user: req.user._id,
                date,
                startTime,
                endTime,
                class: classId
            };
            room.bookings.push(booking);
            await room.save();
            res.status(201).json({ message: 'Booking added successfully', booking });
        } catch (error) {
            res.status(500).json({ message: 'Error adding booking', error: error.message });
        }
    },
    EditBooking: async (req, res) => {
        try {
            const { roomId, bookingId } = req.params;
            const { date, startTime, endTime, classId } = req.body;
            const room = await Room.findById(roomId);
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }
            const booking = room.bookings.id(bookingId);
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            //check for the booking time conflict
            const existingBooking = room.bookings.find(b => {
                return b.date.toDateString() === new Date(date).toDateString() &&
                    b._id.toString() !== bookingId &&
                    (
                        (b.startTime <= startTime && b.endTime > startTime) ||
                        (b.startTime < endTime && b.endTime >= endTime) ||
                        (b.startTime >= startTime && b.endTime <= endTime)
                    );
            });
            if (existingBooking) {
                return res.status(400).json({ message: 'Booking time conflicts with an existing booking' });
            }
            booking.set({ date, startTime, endTime, class: classId });
            await room.save();
            res.json({ message: 'Booking updated successfully', booking });
        } catch (error) {
            res.status(500).json({ message: 'Error updating booking', error: error.message });
        }
    },
    RemoveBooking: async (req, res) => {
        try {
            const { roomId, bookingId } = req.params;
            const room = await Room.findById(roomId);
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }
            const booking = room.bookings.id(bookingId);
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            booking.remove();
            await room.save();
            res.json({ message: 'Booking removed successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error removing booking', error: error.message });
        }
    }
};
