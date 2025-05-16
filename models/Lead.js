const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const callNoteSchema = new Schema({
  date: { type: Date, default: Date.now },
  content: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});

const leadSchema = new Schema({
  firstName:  { type: String, required: true },
  lastName:   { type: String, required: true },
  phone:      { type: String, required: true },
  address:    { type: String, required: true },
  email:      { type: String, required: true, unique: true },
  leadStatus: { type: String, enum: ["hot","warm","cold","converted","lost"], default: "warm" },
  callNotes:  [callNoteSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model("Lead", leadSchema);