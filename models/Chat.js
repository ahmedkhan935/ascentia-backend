const mongoose = require('mongoose');
const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    readAt: Date,
    createdAt: { type: Date, default: Date.now },
  });
const Message = mongoose.model('Message', messageSchema);
const chatSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    messages: [messageSchema],
  });
const Chat = mongoose.model('Chat', chatSchema);
module.exports = Chat;
module.exports = Message;
