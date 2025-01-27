const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    // type: { type: String, enum: ['monthly', 'term', 'yearly'], required: true },
    // status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    // paymentMethod: {
    //   type: { type: String, enum: ['stripe', 'bpay'], required: true },
    //   details: mongoose.Schema.Types.Mixed,
    // },
    // period: {
    //   startDate: { type: Date, required: true },
    //   endDate: { type: Date, required: true },
    // },
    // invoice: {
    //   number: String,
    //   xeroId: String,
    //   issuedDate: Date,
    //   dueDate: Date,
    // },

    type:{
        type:String,
        enum:["Payout","Payment"],
        required:true

    },
    status:{
        type:String,
        enum:["pending","completed","failed"],
        default:"pending"
    },
    paymentMethod:{
        type:String,
        enum:["stripe","bpay"],
        required:true
    },
  });

const Payment = mongoose.model('Payment', paymentSchema);   
module.exports = Payment;