const mongoose = require('mongoose');
const bookingSchema = new mongoose.Schema({
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed', 'credited'],
      default: 'pending'
    },
    adminApproval: {
      approved: { type: Boolean, default: false },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
    },
    attendance: {
      attended: { type: Boolean, default: false },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      markedAt: Date,
    },
  });
const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;