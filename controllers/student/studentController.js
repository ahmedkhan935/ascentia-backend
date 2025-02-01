const TutorProfile = require("../../models/Tutor");
const Bonus = require("../../models/Bonus");
const Class = require("../../models/Class");
const User = require("../../models/User");
const ClassSession = require("../../models/ClassSession");

const studentController = {
  getAllTutors: async (req, res) => {
    try {
      const tutors = await TutorProfile.find().populate("user");

      res.status(200).json(tutors);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = studentController;
