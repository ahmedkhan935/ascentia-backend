const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const callNoteSchema = new Schema({
  date: { type: Date, default: Date.now },
  content: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});

const leadSchema = new Schema({
  firstName: { 
    type: String, 
    required: true,
    trim: true
  },
  lastName: { 
    type: String,
    trim: true
  },
  phone: { 
    type: String, 
    trim: true,
    sparse: true 
  },
  address: { 
    type: String, 
    trim: true
  },
  source: {
    type: String, 
    required: true,
    enum: ["Website", "Referral", "Social Media", "Google", "Advertisement", "Event", "Phone Inquiry", "Walk-in", "Other"],
    trim: true
  },
  email: { 
    type: String, 
    unique: true,
    sparse: true, 
    lowercase: true,
    trim: true
  },
  leadStatus: { 
    type: String, 
    enum: ["hot", "warm", "cold", "converted", "lost"], 
    default: "warm" 
  },
  leadType: { 
    type: String, 
    enum: ["student", "parent"], 
    default: "student",
    required: true
  },
  callNotes: [callNoteSchema]
}, {
  timestamps: true
});

// Custom validation to ensure either email or phone is provided
leadSchema.pre('validate', function(next) {
  if (!this.email && !this.phone) {
    this.invalidate('contact', 'Either email or phone number is required');
  }
  next();
});


module.exports = mongoose.model("Lead", leadSchema);