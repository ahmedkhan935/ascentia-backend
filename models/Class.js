const mongoose = require('mongoose');
const classSchema = new mongoose.Schema({
    type: { type: String, enum: ['individual', 'group'], required: true },
    subject: { type: String, required: true },
    price: {
      perClass:Number,
      Monthly:Number,
      TermWise:Number
    },
    tutorPayout:{
      perClass:Number,
      Monthly:Number,
      TermWise:Number
    },
    
    tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
  });
const Class = mongoose.model('Class', classSchema);
module.exports = Class;  