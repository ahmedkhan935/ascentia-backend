const mongoose  = require('mongoose');
const creditSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
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
  });
const Credit = mongoose.model('Credit', creditSchema);
module.exports = Credit;
