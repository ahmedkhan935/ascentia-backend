const User = require('../../models/User');
const { createLog } = require('../../middleware/logger');
const Family = require('../../models/Family');
const Class = require('../../models/Class');
const bcrypt = require('bcryptjs');
const Payment = require('../../models/Payment');
const TutorProfile = require('../../models/Tutor');


const tutorController = {
    getTutorSessions: async (req, res) => {
        try {
            const classes = await Class.find({ tutor: req.user._id });
            const sessions = await ClassSession.find({ class: { $in: classes } })
                .populate("class")
                .populate("room");
            
      
            res.status(200).json({ sessions, status: "success" });
          } catch (error) {
            res.status(500).json({
              message: "Error fetching sessions",
              error: error.message,
              status: "Error",
            });
          }
    }
};
module.exports = tutorController;