const TutorProfile = require("../../models/Tutor");
const Bonus = require("../../models/Bonus");
const Class = require("../../models/Class");
const User = require("../../models/User");
const ClassSession = require("../../models/ClassSession");
const Activity = require("../../models/Activity");
const createLog = require("../../middleware/logger").createLog;
const Request = require("../../models/Request");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const Payment = require("../../models/Payment");
const { getPayments } = require("../tutor/tutor.Controller");
const Category = require("../../models/Category");
dotenv.config();
const days  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const tutorController = {
  create: async (req, res) => {
    try {
      // Parse form data or use direct values
      const parseField = (field) => {
        if (req.body[field]) {
          try {
            return typeof req.body[field] === 'string' ? JSON.parse(req.body[field]) : req.body[field];
          } catch (e) {
            return req.body[field]; // Return as is if not valid JSON
          }
        }
        return null;
      };
  
      const email = parseField('email');
      const password = parseField('password');
      const firstName = parseField('firstName');
      const lastName = parseField('lastName');
      const phone = parseField('phone');
      const subjects = parseField('subjects');
      const category = parseField('category');
      const degree = parseField('degree');
      const university = parseField('university');
      const dateOfBirth = parseField('dateOfBirth');
      const startDate = parseField('startDate');
      const endDate = parseField('endDate');
      const atar = parseField('atar');
      const yearCompleted = parseField('yearCompleted');
      const teachingExperience = parseField('teachingExperience');
      const specializations = parseField('specializations') || [];
      const achievements = parseField('achievements');
      
      // Parse new location fields from frontend - with validation
      const address = parseField('address');
      let latitude = parseField('latitude');
      let longitude = parseField('longitude');
      
      // Convert to numbers if possible and validate
      if (latitude) {
        latitude = Number(latitude);
        if (isNaN(latitude)) latitude = null; 
      }
      
      if (longitude) {
        longitude = Number(longitude);
        if (isNaN(longitude)) longitude = null;
      }
  
      // Validate required fields
      if (!email || !password || !firstName) {
        return res.status(400).json({
          status: "Error",
          message: "Email, password, and first name are required fields"
        });
      }
  
      // Check if user already exists
      const existingUser = await User.findOne({
        email: email,
      });
      if (existingUser) {
        return res.status(400).json({
          status: "Error",
          message: "User with this email already exists",
        });
      }
  
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create new user
      const newTutor = new User({
        email,
        password: hashedPassword,
        role: "tutor",
        firstName,
        lastName,
        phone,
        dateOfBirth
      });
  
      // Create stripe account 
      const account = await stripe.accounts.create({
        type: "express",
      });
      const onboardingLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: "https://www.google.com",
        return_url: "https://www.google.com",
        type: "account_onboarding",
      });
      
      // Create tutor profile with the categories properly formatted
      const tutorProfileData = {
        user: newTutor._id,
        subjects: subjects || [], 
        category: category, // Keep original string format
        qualifications: [{
          degree,
          institution: university,
          startDate,
          endDate,
        }],
        atar,
        yearCompleted,
        teachingExperience,
        specializations,
        achievements,
        education: {
          university,
          degree,
        },
        personalDetails: {
          dateOfBirth
        },
        stripeAccountId: account.id,
        stripeOnboardingLink: onboardingLink.url,
      };
      
      // Only add location data if we have valid information
      if (address) {
        tutorProfileData.location = {
          address
        };
        
        // Only add coordinates if we have valid lat/long
        if (latitude !== null && longitude !== null) {
          tutorProfileData.location.coordinates = {
            latitude,
            longitude
          };
        }
      }
      
      const tutorProfile = new TutorProfile(tutorProfileData);
      
      // If category is a comma-separated string, also populate the classCategories field
      if (category && category.includes(',')) {
        const categoryArray = category.split(',').map(cat => {
          // Convert to proper format (K-6, 7-10, 11-12) based on model enum
          if (cat === 'k-6') return 'K-6';
          return cat;
        });
        tutorProfile.classCategories = categoryArray;
      } else if (category) {
        // Single category
        const formattedCategory = category === 'k-6' ? 'K-6' : category;
        tutorProfile.classCategories = [formattedCategory];
      }
      
      // Save everything
      await newTutor.save();
      await tutorProfile.save();
  
      // Create activity log
      const newActivity = new Activity({
        name: "Tutor Created",
        description: `Tutor ${newTutor.firstName} ${newTutor.lastName} created`,
        tutorId: newTutor._id,
      });
      await newActivity.save();
  
      // Create system log
      await createLog("CREATE", "TUTOR", newTutor._id, req.user, req);
  
      // Return success response
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
      console.error("Error creating tutor:", error);
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
        .populate("user", "firstName lastName email phone")
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
          phone:      tutor.user.phone,
          initials: 
          tutor.user.firstName.charAt(0) +
          (tutor.user.lastName ? tutor.user.lastName.charAt(0) : ''),
          workHours: `${totalWorkHours.toFixed(2)} hours`,
          status: tutor.status,
          blogs: `${tutor.publishedBlogs || 0} blogs`,
          credit: tutor.creditBalance || 0,
          education: tutor.education,
          subjects: tutor.subjects,
          address: tutor.location?.address || "",
          latitude: tutor.location?.coordinates?.latitude ?? null,
          longitude: tutor.location?.coordinates?.longitude ?? null,
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

  getAllTutors: async (req, res) => {
    try {
      const search = req.query.search || "";
      const status = req.query.status;
  
      // Build base query
      let query = {};
  
      // Text‐search across firstName, lastName, email
      if (search) {
        const userQuery = {
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName:  { $regex: search, $options: "i" } },
            { email:     { $regex: search, $options: "i" } },
          ],
        };
        const users = await User.find(userQuery).select("_id");
        query.user = { $in: users.map(u => u._id) };
      }
  
      // Filter by status if provided
      if (status) {
        query.status = status;
      }
  
      // Fetch all matching tutor profiles
      const tutors = await TutorProfile.find(query)
        .populate("user", "firstName lastName email phone")
        .sort({ createdAt: -1 });
  
      // Transform for frontend
      const transformedTutors = tutors.map(tutor => {
        const totalWorkHours = (tutor.shifts || []).reduce((sum, shift) => {
          const [sh, sm] = shift.startTime.split(":").map(Number);
          const [eh, em] = shift.endTime.split(":").map(Number);
          return sum + ((eh + em/60) - (sh + sm/60));
        }, 0);
  
        return {
          id: tutor._id,
          name: `${tutor.user.firstName} ${tutor.user.lastName}`,
          email: tutor.user.email,
          phone: tutor.user.phone,
          initials:
            tutor.user.firstName.charAt(0) +
            (tutor.user.lastName ? tutor.user.lastName.charAt(0) : ""),
          workHours: `${totalWorkHours.toFixed(2)} hours`,
          status: tutor.status,
          blogs: `${tutor.publishedBlogs || 0} blogs`,
          credit: tutor.creditBalance || 0,
          education: tutor.education,
          subjects: tutor.subjects,
          address: tutor.location?.address || "",
          latitude: tutor.location?.coordinates?.latitude ?? null,
          longitude: tutor.location?.coordinates?.longitude ?? null,
        };
      });
  
      await createLog("READ", "TUTOR", null, req.user, req);
  
      // Return the full list
      res.json({ tutors: transformedTutors });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Error fetching tutors",
        error: error.message,
      });
    }
  },
  

  getById: async (req, res) => {
    try {
      const tutor = await TutorProfile.findById(req.params.id)
        .populate("user", "-password")
        .populate("classCategories");

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
      // Map category names
      const categoryNames = tutor.classCategories
        ? tutor.classCategories.map(cat => cat.name)
        : [];
      //return the work hours aswell
      const response = {
        data: {
          tutor: {
            ...tutor.toObject(),
            categoryNames,
          },
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
  changeStatus: async (req, res) => {
    try {
      const { id }    = req.params;          // TutorProfile _id
      let   { status } = req.body;           // desired status
  
      if (!status)
        return res.status(400).json({ message: "Status is required." });
  
      // Accept the word "deactivated" from the UI and map it to the schema value "inactive"
      if (status === "deactivated") status = "inactive";
  
      // Whitelist against the enum in the schema
      const allowed = ["active", "inactive", "suspended"];
      if (!allowed.includes(status))
        return res
          .status(400)
          .json({ message: `Status must be one of: ${allowed.join(", ")}` });
  
      // Update and return the fresh document
      const profile = await TutorProfile.findByIdAndUpdate(
        id,
        { $set: { status } },
        { new: true }
      ).populate("user", "firstName lastName email");
  
      if (!profile)
        return res.status(404).json({ message: "Tutor profile not found." });
  
      // Activity & system logs (optional but consistent with the rest of your controller)
      const activity = new Activity({
        name:        "Tutor Status Changed",
        description: `Status set to "${status}" for ${profile.user.firstName} ${profile.user.lastName}`,
        tutorId:     profile.user._id,
      });
      await activity.save();
      await createLog("UPDATE", "TUTOR", profile._id, req.user, req);
  
      return res.json({
        message: "Status updated successfully",
        tutor:   profile,
      });
    } catch (err) {
      console.error("changeStatus error:", err);
      return res
        .status(500)
        .json({ message: "Server error", error: err.message });
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
      const { dayOfWeek, startTime, endTime, recurrence = "weekly", isTrial = false, specificDate = null } = req.body;
      
      // Create shift object
      const shift = {
        dayOfWeek,
        startTime,
        endTime,
        recurrence,
        isTrial
      };
      
      // Add specificDate if it's a one-off shift
      if (recurrence === "one-off" && specificDate) {
        shift.specificDate = new Date(specificDate);
      }
  
      const tutor = await TutorProfile.findOne({ _id: tutorId }).populate("user");
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      
      if (!tutor.shifts) {
        tutor.shifts = [];
      }
  
      // Check for collision with existing shifts based on recurrence
      const isCollision = tutor.shifts.some((existingShift) => {
        // For one-off shifts, only check for collision if on the same day
        if (recurrence === "one-off" && existingShift.recurrence === "one-off") {
          // Compare dates for one-off shifts
          const existingDate = existingShift.specificDate ? new Date(existingShift.specificDate).toDateString() : null;
          const newDate = specificDate ? new Date(specificDate).toDateString() : null;
          
          // If dates are different, no collision
          if (existingDate !== newDate) {
            return false;
          }
        } else if (recurrence === "one-off" || existingShift.recurrence === "one-off") {
          // One is one-off and the other is recurring, no collision
          return false;
        } else if (existingShift.dayOfWeek !== dayOfWeek) {
          // Different days of the week, no collision
          return false;
        }
        
        // If we got here, we need to check time collision
        const [existingStartHour, existingStartMinute] = existingShift.startTime
          .split(":")
          .map(Number);
        const [existingEndHour, existingEndMinute] = existingShift.endTime
          .split(":")
          .map(Number);
        const [newStartHour, newStartMinute] = startTime
          .split(":")
          .map(Number);
        const [newEndHour, newEndMinute] = endTime.split(":").map(Number);
  
        const existingStartTime = existingStartHour * 60 + existingStartMinute;
        const existingEndTime = existingEndHour * 60 + existingEndMinute;
        const newStartTime = newStartHour * 60 + newStartMinute;
        const newEndTime = newEndHour * 60 + newEndMinute;
  
        // Check for time overlap
        return newStartTime < existingEndTime && newEndTime > existingStartTime;
      });
  
      if (isCollision) {
        return res
          .status(400)
          .json({ message: "Shift time conflicts with an existing shift" });
      }
  
      tutor.shifts.push(shift);
      await tutor.save();
      
      // Create activity log with detailed information
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      let activityDescription = `${recurrence === "weekly" ? "Weekly" : recurrence === "fortnightly" ? "Fortnightly" : "One-off"}`;
      
      if (recurrence === "one-off" && specificDate) {
        const formattedDate = new Date(specificDate).toLocaleDateString();
        activityDescription += ` shift for ${formattedDate}`;
      } else {
        activityDescription += ` shift for ${days[dayOfWeek]}`;
      }
      
      activityDescription += ` ${startTime} - ${endTime} added for tutor ${tutor.user.firstName} ${tutor.user.lastName}`;
      
      if (isTrial) {
        activityDescription += " (Trial Class)";
      }
      
      const newActivity = new Activity({
        name: "Shift Added",
        description: activityDescription,
        tutorId: tutor.user._id,
      });
      await newActivity.save();
  
      res.json({ 
        message: "Shift added successfully",
        shift: tutor.shifts[tutor.shifts.length - 1] 
      });
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
      const tutor = await TutorProfile.findOne({ _id: tutorId }).populate("user");
      
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      
      // Find the shift before removing it (for activity log)
      const shiftToRemove = tutor.shifts.find(shift => shift._id.toString() === shiftId);
      
      tutor.shifts = tutor.shifts.filter(
        (shift) => shift._id.toString() !== shiftId
      );
      
      await tutor.save();
      
      // Create more detailed activity log
      let activityDescription = `Shift removed for tutor ${tutor.user.firstName} ${tutor.user.lastName}`;
      
      if (shiftToRemove) {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        
        if (shiftToRemove.recurrence === "one-off" && shiftToRemove.specificDate) {
          const formattedDate = new Date(shiftToRemove.specificDate).toLocaleDateString();
          activityDescription = `One-off shift for ${formattedDate} (${shiftToRemove.startTime} - ${shiftToRemove.endTime}) removed`;
        } else {
          activityDescription = `${shiftToRemove.recurrence === "weekly" ? "Weekly" : "Fortnightly"} shift for ${days[shiftToRemove.dayOfWeek]} (${shiftToRemove.startTime} - ${shiftToRemove.endTime}) removed`;
        }
        
        if (shiftToRemove.isTrial) {
          activityDescription += " (Trial Class)";
        }
        
        activityDescription += ` for tutor ${tutor.user.firstName} ${tutor.user.lastName}`;
      }
      
      const newActivity = new Activity({
        name: "Shift Removed",
        description: activityDescription,
        tutorId: tutor.user._id,
      });
      
      await newActivity.save();
      res.json({ message: "Shift removed successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error removing shift", error: error.message });
    }
  },
  
  getShift: async (req, res) => {
    try {
      const tutorId = req.params.id;
      const day = req.query.day ? parseInt(req.query.day) : null;
      const recurrence = req.query.recurrence;
      const isTrial = req.query.isTrial === 'true';
      const date = req.query.date;
      
      const tutor = await TutorProfile.findOne({ _id: tutorId });
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      
      if (!tutor.shifts || tutor.shifts.length === 0) {
        return res.json([]);
      }
      
      // Apply filters if provided
      let filteredShifts = [...tutor.shifts];
      
      if (day !== null) {
        filteredShifts = filteredShifts.filter(shift => shift.dayOfWeek === day);
      }
      
      if (recurrence) {
        filteredShifts = filteredShifts.filter(shift => shift.recurrence === recurrence);
      }
      
      if (req.query.isTrial !== undefined) {
        filteredShifts = filteredShifts.filter(shift => shift.isTrial === isTrial);
      }
      
      if (date) {
        const searchDate = new Date(date).toDateString();
        filteredShifts = filteredShifts.filter(shift => {
          if (shift.recurrence === "one-off" && shift.specificDate) {
            return new Date(shift.specificDate).toDateString() === searchDate;
          }
          return false;
        });
      }
      
      return res.json(filteredShifts);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error getting shifts", error: error.message });
    }
  },
  
  
  /**
   * Helper method to update a tutor shift
   */
  updateShift: async (req, res) => {
    try {
      const tutorId = req.params.id;
      const shiftId = req.params.shiftId;
      const { dayOfWeek, startTime, endTime, recurrence, isTrial, specificDate } = req.body;
      
      const tutor = await TutorProfile.findOne({ _id: tutorId }).populate("user");
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      
      // Find the shift index
      const shiftIndex = tutor.shifts.findIndex(shift => shift._id.toString() === shiftId);
      if (shiftIndex === -1) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      // Store old shift for activity log
      const oldShift = { ...tutor.shifts[shiftIndex]._doc };
      
      // Update shift fields
      if (dayOfWeek !== undefined) tutor.shifts[shiftIndex].dayOfWeek = dayOfWeek;
      if (startTime) tutor.shifts[shiftIndex].startTime = startTime;
      if (endTime) tutor.shifts[shiftIndex].endTime = endTime;
      if (recurrence) tutor.shifts[shiftIndex].recurrence = recurrence;
      if (isTrial !== undefined) tutor.shifts[shiftIndex].isTrial = isTrial;
      
      // Handle specificDate for one-off shifts
      if (recurrence === "one-off") {
        if (specificDate) {
          tutor.shifts[shiftIndex].specificDate = new Date(specificDate);
        }
      } else {
        // Remove specificDate if not one-off
        tutor.shifts[shiftIndex].specificDate = undefined;
      }
      
      // Save the updated tutor
      await tutor.save();
      
      // Create activity log entry
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      let activityDescription = `Shift updated for tutor ${tutor.user.firstName} ${tutor.user.lastName}: `;
      
      // Describe the changes
      const changes = [];
      
      if (oldShift.startTime !== startTime || oldShift.endTime !== endTime) {
        changes.push(`Time changed from ${oldShift.startTime}-${oldShift.endTime} to ${startTime}-${endTime}`);
      }
      
      if (oldShift.recurrence !== recurrence) {
        changes.push(`Recurrence changed from ${oldShift.recurrence || "weekly"} to ${recurrence}`);
      }
      
      if (oldShift.isTrial !== isTrial) {
        changes.push(`${isTrial ? "Marked" : "Unmarked"} as trial class`);
      }
      
      if (oldShift.dayOfWeek !== dayOfWeek && dayOfWeek !== undefined) {
        changes.push(`Day changed from ${days[oldShift.dayOfWeek]} to ${days[dayOfWeek]}`);
      }
      
      if (recurrence === "one-off" && specificDate) {
        const oldDate = oldShift.specificDate ? new Date(oldShift.specificDate).toLocaleDateString() : "none";
        const newDate = new Date(specificDate).toLocaleDateString();
        if (oldDate !== newDate) {
          changes.push(`Date changed from ${oldDate} to ${newDate}`);
        }
      }
      
      activityDescription += changes.join(", ");
      
      const newActivity = new Activity({
        name: "Shift Updated",
        description: activityDescription,
        tutorId: tutor.user._id,
      });
      
      await newActivity.save();
      
      res.json({ 
        message: "Shift updated successfully",
        shift: tutor.shifts[shiftIndex]
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating shift", error: error.message });
    }
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
      const BonusPayment = new Payment({
        user: tutor._id,
        amount: bonus.amount,
        type: "Payout",
        status: "pending",
        paymentMethod: "stripe",
        reason: "Bonus Payment",
      });
      await BonusPayment.save();

      await newBonus.save();
      const newActivity = new Activity({
        name: "Bonus Added",
        description: `Bonus of ${bonus.amount} added for tutor ${tutor.user.firstName} ${tutor.user.lastName}`,
        tutorId: tutor.user._id,
      });
      await newActivity.save();
      

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
      const tutor = await TutorProfile.findOne({ user: tutorId }).populate('user');
      if (!tutor) {
        return res.status(404).json({ message: "Tutor not found" });
      }
      await Bonus.findByIdAndDelete(bonusId);
      const newActivity = new Activity({
        name: "Bonus Removed",
        description: `Bonus removed for tutor ${tutor.user.firstName} ${tutor.user.lastName}`,
        tutorId: tutor.user._id,
      });
      await newActivity.save();
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
  getPendingRequests: async (req, res) => {
    try {
      const requests = await Request.find({
        status: "pending",
      })
        .populate("tutor")
        .populate("classId")
        .populate("sessionId")
        .populate("user");

      res.json(requests);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching requests", error: error.message });
    }
  },
  getAllRequests: async (req, res) => {
    try {
      const requests = await Request.find({
      })
        .populate("tutor")
        .populate("classId")
        .populate("sessionId")
        .populate("user");

      res.json(requests);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching requests", error: error.message });
    }
  },

  //these are some tutor routes for the tutor
  getTutorClassesAndSessions: async (req, res) => {
    try {
      const tutor = await TutorProfile.findOne({ user: req.user._id }).populate(
        "user"
      );

      if (!tutor) {
        return res.status(404).json({
          status: "failed",
          message: "Tutor not found",
        });
      }

      // Get all classes for this tutor
      const classes = await Class.find({ tutor: tutor._id })
        .populate("students.id", "firstName lastName email")
        .populate("allocatedRoom")
        .populate("subject")
        .populate("tutor", "user")
        .lean();

      // Get all sessions for these classes
      const classIds = classes.map((c) => c._id);
      const sessions = await ClassSession.find({
        class: { $in: classIds },
      })
        .populate("room")
        .populate("attendance.student", "firstName lastName email")
        .populate('feedback.student', 'firstName lastName')
        .lean();

      // Organize sessions by class
      const classesWithSessions = classes.map((classItem) => {
        const classSessions = sessions.filter(
          (session) => session.class.toString() === classItem._id.toString()
        );

        return {
          ...classItem,
          sessions: classSessions.map((session) => ({
            _id: session._id,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.status,
            room: session.room,
            attendance: session.attendance || [],
            feedback: session.feedback || [],
          })),
        };
      });

      res.status(200).json({
        status: "success",
        data: {
          classes: classesWithSessions,
        },
      });
    } catch (error) {
      res.status(500).json({
        status: "failed",
        message: "Error fetching tutor classes and sessions",
        error: error.message,
      });
    }
  },
  getActivities: async (req, res) => {
    try{
      const activities = await Activity.find().populate("studentId").populate("tutorId").populate("classId").populate("classSessionId").sort({createdAt:-1});
      res.json({status:"success",activities});

    }
    catch(error){
      res.status(500).json({status:"failed",message:"Error fetching activities",error:error.message});
    }
  },
  getPayments: async (req, res) => {
    try {
      const payments = await Payment.find()
        .populate('user')               // replaces user ID with full user document
        .populate('classSessionId')     // replaces classSessionId with full ClassSession document
        .populate('classId')            // replaces classId with full Class document
        .sort({ createdAt: -1 });
  
      res.json({
        status: "success",
        payments
      });
    } catch (error) {
      res.status(500).json({
        status: "failed",
        message: "Error fetching payments",
        error: error.message
      });
    }
  },
  
  updatePaymentStatus: async (req, res) => {
    const { id }      = req.params;
    const { status }  = req.body;

    // 1) Validate
    if (!status) {
      return res
        .status(400)
        .json({ status: "failed", message: "New status is required in the request body." });
    }

    // Optional: whitelist allowed statuses
    const allowed = ["pending", "completed", "failed"];
    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ status: "failed", message: `Status must be one of: ${allowed.join(", ")}` });
    }

    try {
      // 2) Find and update
      const updated = await Payment.findByIdAndUpdate(
        id,
        { $set: { status } },
        { new: true }
      ).populate('user');

      if (!updated) {
        return res
          .status(404)
          .json({ status: "failed", message: "Payment not found." });
      }

      // 3) Return the updated document
      return res.json({
        status:  "success",
        message: `Payment status updated to "${status}".`,
        payment: updated
      });
    } catch (err) {
      console.error("Error updating payment status:", err);
      return res
        .status(500)
        .json({ status: "failed", message: "Internal Server Error", error: err.message });
    }
  },

  rejectPayment: async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body; 
    const userId = req.user && req.user._id;

    try {
      // 1) Find & update status to "failed"
      const updated = await Payment.findByIdAndUpdate(
        id,
        {
          $set: {
            status: "failed",
            rejectionReason: reason || "Rejected by admin",
            updatedAt: new Date()
          }
        },
        { new: true }
      )
      .populate("user")
      .populate("classSessionId")
      .populate("classId");

      if (!updated) {
        return res
          .status(404)
          .json({ status: "failed", message: "Payment not found." });
      }

      // 2) Log an activity for the rejection
      const classInfo = updated.classId;
      const sessionInfo = updated.classSessionId;
      const activity = new Activity({
        name: "Payment Rejected",
        description: `Payment of $${updated.amount} for "${
          classInfo ? classInfo.subject : "a class"
        }" on ${sessionInfo?.date.toISOString().split("T")[0]} has been rejected.${
          reason ? " Reason: " + reason : ""
        }`,
        class: updated.classId,
        classSession: updated.classSessionId,
        user: userId,
        payment: updated._id
      });
      await activity.save();

      // 3) Return the updated payment
      return res.json({
        status: "success",
        message: "Payment has been rejected.",
        payment: updated
      });
    } catch (err) {
      console.error("rejectPayment Error:", err);
      return res.status(500).json({
        status: "failed",
        message: "Error rejecting payment",
        error: err.message
      });
    }
  },

  
  updateTutor: async (req, res) => {
    try {
      // 1) Treat req.params.id as the TutorProfile _id
      const profileId = req.params.id;
      
      const profile = await TutorProfile.findById(profileId);
      if (!profile) {
        return res.status(404).json({ message: 'Tutor profile not found' });
      }
      
      // 2) Now load the User by profile.user
      const user = await User.findById(profile.user);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Update email if provided
      if (req.body.email) {
        const newEmail = req.body.email.trim().toLowerCase();
        if (newEmail !== user.email) {
          const existing = await User.findOne({ email: newEmail });
          if (existing && existing._id.toString() !== user._id.toString()) {
            return res.status(400).json({ message: 'Email already in use by another user' });
          }
          user.email = newEmail;
        }
      }
      
      // Update first name if provided
      if (req.body.firstName) {
        user.firstName = req.body.firstName;
      }
      
      // Update last name if provided
      if (req.body.lastName) {
        user.lastName = req.body.lastName;
      }
      
      // Update phone if provided
      if (req.body.phone) {
        user.phone = req.body.phone;
      }
      
      // Save the updated user
      await user.save();
      console.log("Saved updated user");
      
      // 3) Update TutorProfile fields
      
      // Update subjects if provided
      if (req.body.subjects) {
        profile.subjects = Array.isArray(req.body.subjects)
          ? req.body.subjects
          : JSON.parse(req.body.subjects);
      }
      
      // Ensure qualifications array exists
      if (!Array.isArray(profile.qualifications) || profile.qualifications.length === 0) {
        profile.qualifications = [{ degree: "", institution: "" }];
      }
      
      // Update degree if provided
      if (req.body.degree) {
        profile.qualifications[0].degree = req.body.degree;
      }
      
      // Update university/institution if provided
      if (req.body.university) {
        profile.qualifications[0].institution = req.body.university;
      }
      
      // Update address if provided
      if (req.body.address) {
        // Check if location object exists, if not create it
        if (!profile.location) {
          profile.location = {
            address: req.body.address,
            coordinates: profile.location?.coordinates || {}
          };
        } else {
          profile.location.address = req.body.address;
        }
      }
      
      // Update ATAR score if provided
      if (req.body.atar) {
        const atarValue = parseFloat(req.body.atar);
        if (!isNaN(atarValue)) {
          profile.atar = atarValue;
        }
      }
      
      // Update year completed if provided
      if (req.body.yearCompleted) {
        const yearValue = parseInt(req.body.yearCompleted);
        if (!isNaN(yearValue)) {
          profile.yearCompleted = yearValue;
        }
      }
      
      // Update teaching experience if provided
      if (req.body.teachingExperience) {
        profile.teachingExperience = req.body.teachingExperience;
      }
      
      // Update specializations if provided
      if (req.body.specializations) {
        profile.specializations = Array.isArray(req.body.specializations)
          ? req.body.specializations
          : JSON.parse(req.body.specializations);
      }
      
      // Update achievements if provided
      if (req.body.achievements) {
        profile.achievements = req.body.achievements;
      }
      
      // Save the updated profile
      await profile.save();
      console.log("Saved updated profile");
      
      // 4) Log activity
      const activity = new Activity({
        name: 'Tutor Updated',
        description: `Tutor ${user.firstName} ${user.lastName} updated`,
        tutorProfileId: profileId,
      });
      await activity.save();
      await createLog('UPDATE', 'TUTOR', profileId, req.user, req);
      
      const freshUser = await User.findById(user._id);
      const freshProfile = await TutorProfile.findById(profileId)
        .populate('classCategories') // Populate class categories for complete data
        .lean(); // Use lean for better performance
      
      // Add category names for display
      if (freshProfile.classCategories && freshProfile.classCategories.length > 0) {
        freshProfile.categoryNames = freshProfile.classCategories.map(category => category.name);
      }
      
      // 6) Respond with updated data
      res.status(200).json({
        message: 'Tutor updated successfully',
        tutor: {
          ...freshProfile,
          user: {
            _id: freshUser._id,
            email: freshUser.email,
            firstName: freshUser.firstName,
            lastName: freshUser.lastName,
            phone: freshUser.phone,
          }
        },
      });
      console.log("Response sent");
    } catch (error) {
      console.error('Error in Tutor.update:', error);
      res.status(500).json({ message: 'Error updating tutor', error: error.message });
    }
  },

getTutorSessionsforconflicts: async (req, res) => {
  try {
    const profileId = req.params.profileId;

    // 1) Verify the tutor profile exists
    const profile = await TutorProfile.findById(profileId);
    if (!profile) {
      return res.status(404).json({ message: "Tutor profile not found" });
    }

    // 2) Fetch only the `sessions` field from each Class
    const classes = await Class.find(
      { tutor: profileId },
      { sessions: 1 }
    ).lean();

    // 3) Flatten into one array, attaching classId if desired
    const sessions = classes.flatMap(cls =>
      (cls.sessions || []).map(sess => ({
        _id:       sess._id,
        classId:   cls._id,
        dayOfWeek: sess.dayOfWeek,
        startTime: sess.startTime,
        endTime:   sess.endTime,
      }))
    );

    // 4) Return
    return res.json({
      status: "success",
      data: sessions
    });
  } catch (err) {
    console.error("getTutorSessions error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
},

getTutorSessions:async (req, res) => {
  try {
    const profileId = req.params.profileId;

    // 1) Verify the tutor profile exists
    const profile = await TutorProfile.findById(profileId);
    if (!profile) {
      return res.status(404).json({ message: "Tutor profile not found" });
    }

    // 2) Get all Class IDs for this tutor
    const classIds = await Class.find({ tutor: profileId })
                                .distinct("_id");

    // 3) Find all ClassSession docs for those classes
    const sessions = await ClassSession.find({
      class: { $in: classIds }
    })
    // -- optional: populate back to the Class to grab subject, price, etc.
    .populate({
      path: "class",
      select: "subject type price tutor"
    })
    // -- optional: populate attendance.student and markedBy
    .populate({
      path: "attendance.student attendance.markedBy",
      select: "username email"
    })
    // -- optional: populate feedback.student
    .populate({
      path: "feedback.student",
      select: "username"
    })
    // -- optional: populate room and cancellation info
    .populate("room cancelledBy rescheduledTo rescheduledFrom")
    .lean();

    // 4) Return the full ClassSession list
    return res.json({
      status: "success",
      data:   sessions
    });

  } catch (err) {
    console.error("getTutorSessions error:", err);
    return res.status(500).json({
      message: "Server error",
      error:   err.message
    });
  }
},
checkEmailExists: async (req, res) => {
  try {
    const { email } = req.body;
    const existingUser = await User.findOne({ email });
    res.json({ status: "success", exists: !!existingUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
},

};
  
module.exports = tutorController;
