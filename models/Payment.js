const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema({
    family: { type: mongoose.Schema.Types.ObjectId, ref: 'Family', required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['monthly', 'term', 'yearly'], required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    paymentMethod: {
      type: { type: String, enum: ['stripe', 'bpay'], required: true },
      details: mongoose.Schema.Types.Mixed,
    },
    period: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    invoice: {
      number: String,
      xeroId: String,
      issuedDate: Date,
      dueDate: Date,
    },
  });

const Payment = mongoose.model('Payment', paymentSchema);   
module.exports = Payment;