const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    trim: true,
    required: function() {
      return !["parent","student"].includes(this.role);
    },
  },
  password: { 
    type: String,
    required: function() { 
      return this.role !== 'parent'&& this.role !== 'student'; 
    },
  },
  role: {
    type: String,
    enum: ["admin", "tutor", "student", "parent"],
    required: true,
  },
  firstName: { type: String, required: true },
  lastName: { 
    type: String, 
    required: function() { 
      return this.role !== 'parent'&& this.role !== 'student'&& this.role!='tutor';
    },
  },
  grade: {
    type: String,
    required: false,
  },
  school:{
    type:String,
  },
  phone: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: Date,
  current_status: {
    type: String,
    enum: ["online", "offline"],
    default: "offline",
  },
  resetCode: String,
  paymentSchedule: {
    type: String,
    enum: ["Per Class", "Monthly", "Term Wise"],
  },
  dateOfBirth: Date,
  isActive: { type: Boolean, default: true },
  selfGuardian: {
    type: Boolean,
    default: false,
  },
});

const User = mongoose.model("User", userSchema);
module.exports = User;