const mongoose = require('mongoose');
const familySchema = new mongoose.Schema({
    parentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
  });
const Family = mongoose.model('Family', familySchema);
module.exports = Family;