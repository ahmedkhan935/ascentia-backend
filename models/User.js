const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'tutor', 'student', 'parent'], required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLogin: Date,
    current_status: { type: String, enum: ['online', 'offline'], default: 'offline' },
    resetCode: String
  });
const User = mongoose.model('User', userSchema);
module.exports = User;
