const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true

    },
    description:{
        type:String,
        required:true
    },
    bookings:[{
        date:{
            type:Date,
            required:true
        },
        startTime:{
            type:String,
            required:true
        },
        endTime:{
            type:String,
            required:true
        },
        class:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'Class'
        },
        classSession:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'ClassSession'
        },
        description:{
            type:String
        }
    }],
    createdAt:{
        type:Date,
        default:Date.now
    }
});
const Room = mongoose.model('Room', RoomSchema);
module.exports = Room;
