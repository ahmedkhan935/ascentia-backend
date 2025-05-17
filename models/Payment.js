const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },

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
        enum:["stripe"]
    },
    createdAt:{
        type:Date,
        default:Date.now()
    },
    updatedAt:{
        type:Date,
        default:Date.now()
    },
    reason:{
        type:String
    },
    dueDate:{
        type:Date
    },
    classId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Class"
    },
    classSessionId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"ClassSession"
    },
    
  });

const Payment = mongoose.model('Payment', paymentSchema);   
module.exports = Payment;