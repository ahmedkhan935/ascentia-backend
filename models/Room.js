const mongoose = require("mongoose");
const RoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  bookings: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      date: {
        type: Date,
        required: true,
      },
      startTime: {
        type: String,
        required: true,
      },
      endTime: {
        type: String,
        required: true,
      },
      class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
