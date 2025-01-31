const TutorProfile = require("../../models/Tutor");
const Bonus = require("../../models/Bonus");
const User = require("../../models/User");
const createLog = require("../../middleware/logger").createLog;
const Request = require("../../models/Request");
const bcrypt = require("bcryptjs");
const tutorController = {
  create: async (req, res) => {
    try {
      const email = req.body.email ? JSON.parse(req.body.email) : null;
      const password = req.body.password ? JSON.parse(req.body.password) : null;
      const name = req.body.name ? JSON.parse(req.body.name) : null;
      const firstName = req.body.firstName
        ? JSON.parse(req.body.firstName)
        : null;
      const lastName = req.body.lastName ? JSON.parse(req.body.lastName) : null;
      const phone = req.body.phone ? JSON.parse(req.body.phone) : null;
      const subjects = req.body.subjects ? JSON.parse(req.body.subjects) : null;
      const category = req.body.category ? JSON.parse(req.body.category) : null;
      const qualifications = req.body.qualifications
        ? JSON.parse(req.body.qualifications)
        : null;
      const shifts = req.body.shifts ? JSON.parse(req.body.shifts) : null;
      const degree = req.body.degree ? JSON.parse(req.body.degree) : null;
      const university = req.body.university
        ? JSON.parse(req.body.university)
        : null;

      const startDate = req.body.startDate
        ? JSON.parse(req.body.startDate)
        : null;
      const endDate = req.body.endDate ? JSON.parse(req.body.endDate) : null;
      const exsistingUser = await User.findOne({
        email: email,
      });
      if (exsistingUser) {
        return res.status(400).json({
          status: "Error",
          message: "User with this email already exists",
        });
      }
   
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newTutor = new User({
        email,
        password: hashedPassword,
        role: "tutor",
        firstName,
        lastName,
        phone,
      });

      await newTutor.save();
      const tutorProfile = new TutorProfile({
        user: newTutor._id,
        subjects: subjects,
        qualifications: {
          degree,
          institution: university,
          startDate,
          endDate,
        },
        shifts,
        category,
      });

      await tutorProfile.save();

      await createLog("CREATE", "TUTOR", newTutor._id, req.user, req);

      res.status(200).json({
        message: "Tutor created successfully",
        tutor: {
          _id: newTutor._id,
          email: newTutor.email,
          firstName: newTutor.firstName,
          lastName: newTutor.lastName,
          profile: tutorProfile,
        },
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error creating tutor", error: error.message });
    }
  },
  getAll: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || "";
      const status = req.query.status;

      let query = {};

      // Build search query
      if (search) {
        const userQuery = {
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        };

        // Find matching users first
        const users = await User.find(userQuery).select("_id");
        const userIds = users.map((user) => user._id);

        query["user"] = { $in: userIds };
      }

      // Add status filter if provided
      if (status) {
        query["status"] = status;
      }

      // Get total count for pagination
      const total = await TutorProfile.countDocuments(query);

      // Get paginated tutor profiles with populated user data
      const tutors = await TutorProfile.find(query)
        .populate("user", "firstName lastName email")
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });
    

      // Transform the data for frontend
      //calculate work hours for each week

      const transformedTutors = tutors.map((tutor) => {
        const totalWorkHours =
          tutor.shifts?.reduce((total, shift) => {
            const [startHour, startMinute] = shift.startTime
              .split(":")
              .map(Number);
            const [endHour, endMinute] = shift.endTime.split(":").map(Number);
            const startTime = startHour + startMinute / 60;
            const endTime = endHour + endMinute / 60;
            return total + (endTime - startTime);
          }, 0) || 0;

        return {
          id: tutor._id,
          name: `${tutor.user.firstName} ${tutor.user.lastName}`,
          email: tutor.user.email,
          initials: `${tutor.user.firstName[0]}${tutor.user.lastName[0]}`,
          workHours: `${totalWorkHours.toFixed(2)} hours`,
          status: tutor.status,
          blogs: `${tutor.publishedBlogs || 0} blogs`,
          credit: tutor.creditBalance || 0,
          education: tutor.education,
          subjects: tutor.subjects,
        };
      });

      await createLog("READ", "TUTOR", null, req.user, req);

      res.json({
        tutors: transformedTutors,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        message: "Error fetching tutors",
        error: error.message,
      });
    }
  },

  getById: async (req, res) => {
    try {
   
      const tutor = await TutorProfile.findById(req.params.id).populate(
        "user",
        "-password"
      );

      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      const totalWorkHours =
        tutor.shifts?.reduce((total, shift) => {
          const [startHour, startMinute] = shift.startTime
            .split(":")
            .map(Number);
          const [endHour, endMinute] = shift.endTime.split(":").map(Number);
          const startTime = startHour + startMinute / 60;
          const endTime = endHour + endMinute / 60;
          return total + (endTime - startTime);
        }, 0) || 0;
      //return the work hours aswell
      const response = {
        data: {
          tutor,
          workHours: totalWorkHours,
        },
      };

      await createLog("READ", "TUTOR", tutor._id, req.user, req);

      res.json(response);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching tutor", error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const {
        subjects,
        qualifications,
        defaultSchedule,
        assignedBlogs,
        publishedBlogs,
        status,
      } = req.body;

      const updateData = {};
      if (subjects) updateData.subjects = subjects;
      if (qualifications) updateData.qualifications = qualifications;
      if (defaultSchedule) updateData.defaultSchedule = defaultSchedule;
      if (assignedBlogs) updateData.assignedBlogs = assignedBlogs;
      if (publishedBlogs) updateData.publishedBlogs = publishedBlogs;
      if (status) updateData.status = status;
      const tutorProfile = await TutorProfile.findOneAndUpdate(
        { _id: req.params.id },
        updateData,
        { new: true }
      ).populate("user", "-password");

      if (!tutorProfile) {
        return res.status(404).json({ message: "Tutor not found" });
      }

      await createLog("UPDATE", "TUTOR", tutorProfile._id, req.user, req);

      res.json({
        message: "Tutor updated successfully",
        tutor: tutorProfile,
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating tutor", error: error.message });
    }
  },

  delete: async (req, res) => {
    try {
      // Delete tutor profile
      const tutorProfile = await TutorProfile.findOneAndDelete({
        user: req.params.id,
      });
      if (!tutorProfile) {
        return res.status(404).json({ message: "Tutor not found" });
      }

      // Delete user account
      await User.findByIdAndDelete(req.params.id);

      await createLog("DELETE", "TUTOR", tutorProfile._id, req.user, req);

      res.json({ message: "Tutor deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error deleting tutor", error: error.message });
    }
  },
  addShift: async (req, res) => {
    try {
      const tutorId = req.params.id;
      const { shift } = req.body;

  
      const tutor = await TutorProfile.findOne({ _id: tutorId });
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      if (!tutor.shifts) {
        tutor.shifts = [];
      }

      // Check for collision with existing shifts
      const isCollision = tutor.shifts.some((existingShift) => {
        if (existingShift.dayOfWeek !== shift.dayOfWeek) {
          return false;
        }
        const [existingStartHour, existingStartMinute] = existingShift.startTime
          .split(":")
          .map(Number);
        const [existingEndHour, existingEndMinute] = existingShift.endTime
          .split(":")
          .map(Number);
        const [newStartHour, newStartMinute] = shift.startTime
          .split(":")
          .map(Number);
        const [newEndHour, newEndMinute] = shift.endTime.split(":").map(Number);

        const existingStartTime = existingStartHour * 60 + existingStartMinute;
        const existingEndTime = existingEndHour * 60 + existingEndMinute;
        const newStartTime = newStartHour * 60 + newStartMinute;
        const newEndTime = newEndHour * 60 + newEndMinute;

        return newStartTime < existingEndTime && newEndTime > existingStartTime;
      });

      if (isCollision) {
        return res
          .status(400)
          .json({ message: "Shift time conflicts with an existing shift" });
      }

      tutor.shifts.push(shift);
      await tutor.save();
      res.json({ message: "Shift added successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error adding shift", error: error.message });
    }
  },
  removeShift: async (req, res) => {
    try {
      const tutorId = req.params.id;
      const shiftId = req.params.shiftId;
      const tutor = await TutorProfile.findOne({ _id: tutorId });
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      tutor.shifts = tutor.shifts.filter(
        (shift) => shift._id.toString() !== shiftId
      );
      await tutor.save();
      res.json({ message: "Shift removed successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error removing shift", error: error.message });
    }
  },
  getShift: async (req, res) => {
    const tutorId = req.params.id;
    const day = req.query.day;

    const tutor = await TutorProfile.findOne({ user: tutorId });
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }
    let shift;
    shift = tutor.shifts;
    if (day) {
      shift = tutor.shifts.find((s) => s.dayOfWeek === day);
    }

    return res.json(shift);
  },
  AddBonus: async (req, res) => {
    try {
      const tutorId = req.params.id;
      const { bonus } = req.body;
      if (!bonus.amount || !bonus.reason) {
        return res
          .status(400)
          .json({ message: "Please provide amount and reason" });
      }
      const tutor = await TutorProfile.findOne({ _id: tutorId }).populate(
        "user"
      );
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      const newBonus = new Bonus({
        user: tutor.user._id,
        username: tutor.user.firstName + " " + tutor.user.lastName,
        bonus: bonus.amount,
        description: bonus.reason,
      });
      await newBonus.save();

      res.json({ message: "Bonus added successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error adding bonus", error: error.message });
    }
  },
  getBonus: async (req, res) => {
    const { tutorId } = req.params;
    const tutor = await TutorProfile.findOne({ user: tutorId });
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }
    const bonuses = await Bonus.find({ user: tutor.user });
    return res.json(bonuses);
  },
  getBonusById: async (req, res) => {
    const { tutorId, bonusId } = req.params;
    const tutor = await TutorProfile.findOne({ user: tutorId });
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }
    const bonus = await Bonus.findById(bonusId);
    return res.json(bonus);
  },
  getBonusByUser: async (req, res) => {
    const { userId } = req.params;
    const bonuses = await Bonus.find({ user: userId });
    return res.json(bonuses);
  },
  removeBonus: async (req, res) => {
    try {
      const { tutorId, bonusId } = req.body;
      const tutor = await TutorProfile.findOne({ user: tutorId });
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      await Bonus.findByIdAndDelete(bonusId);
      res.json({ message: "Bonus removed successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error removing bonus", error: error.message });
    }
  },
  updateBonus: async (req, res) => {
    try {
      const { tutorId, bonusId, bonus } = req.body;
      if (!bonus.amount || !bonus.reason) {
        return res
          .status(400)
          .json({ message: "Please provide amount and reason" });
      }
      const tutor = await TutorProfile.findOne({ user: tutorId });
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      await Bonus.findByIdAndUpdate(bonusId, {
        bonus: bonus.amount,
        description: bonus.reason,
      });
      res.json({ message: "Bonus updated successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating bonus", error: error.message });
    }
  },
  getBonuses: async (req, res) => {
    const bonuses = await Bonus.find().populate("user");
    return res.json(bonuses);
  },
  getPendingRequests : async (req, res) => {
    try {
        const requests = await Request.find({
            status: 'pending',
        }).populate('tutor')
        .populate('classId')
        .populate('sessionId')
        .populate('user');

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching requests', error: error.message });
    }
},

};

module.exports = tutorController;
