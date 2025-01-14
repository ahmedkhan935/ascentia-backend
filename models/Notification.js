const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
      type: String, 
      enum: ['schedule_change', 'payment_due', 'class_reminder', 'booking_status', 'system'],
      required: true 
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    channels: [{
      type: { type: String, enum: ['email', 'whatsapp', 'in_app'] },
      sent: { type: Boolean, default: false },
      sentAt: Date,
    }],
  });
const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;