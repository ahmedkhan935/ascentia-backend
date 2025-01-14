const mongoose = require('mongoose');
const familySchema = new mongoose.Schema({
    parentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    billingAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
    },
    paymentMethods: [{
      type: { type: String, enum: ['stripe', 'bpay'] },
      details: mongoose.Schema.Types.Mixed,
    }],
  });
const Family = mongoose.model('Family', familySchema);
module.exports = Family;