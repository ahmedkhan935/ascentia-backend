const mongoose = require('mongoose')
const User = require('../../models/User');
const Lead = require("../../models/Lead");


const { createLog } = require('../../middleware/logger');
const Family = require('../../models/Family');
const Class = require('../../models/Class');
const bcrypt = require('bcryptjs');
const Payment = require('../../models/Payment');
const Activity = require("../../models/Activity");
const studentController = {
  // create: async (req, res) => {
  //   try {
  //     const student = req.body.student
  //       ? JSON.parse(req.body.student)
  //       : req.body;
  //     if (!student.firstName || !student.firstName.trim()) {
  //       return res
  //         .status(400)
  //         .json({ status: "Error", message: "First name is required" });
  //     }

  //     // Build the student data
  //     const newStudentData = {
  //       role: "student",
  //       firstName: student.firstName,
  //       lastName: student.lastName || "",
  //       school: student.school || "",
  //       grade:student.grade,
  //       selfGuardian: student.selfGuardian === true || student.selfGuardian === "true",
  //     };

  //     if (student.email && typeof student.email === "string" && student.email.trim() !== "") {
  //       const email = student.email.trim();
  //       const existingUser = await User.findOne({ email });
  //       if (existingUser) {
  //         return res
  //           .status(400)
  //           .json({ status: "Error", message: "Email already exists" });
  //       }

  //       newStudentData.email = email;
  //     }
  //     else if (student.email === "") {
  //       newStudentData.email = "";
  //     }
  //     // In all other cases, omit the email field completely

  //     if (student.phone) newStudentData.phone = student.phone;
  //     if (student.prefferedPayment) newStudentData.paymentSchedule = student.prefferedPayment;
  //     if (student.dateOfBirth) newStudentData.dateOfBirth = student.dateOfBirth;

  //     const result = await mongoose.connection.db.collection('users').insertOne(newStudentData);

  //     const newStudent = await User.findById(result.insertedId);

  //     if (!newStudentData.selfGuardian && (student.parent ||
  //       (student.parentFirstName && student.parentPhone))) {

  //       // Support both nested parent object and flat parent fields
  //       const p = student.parent || {
  //         firstName: student.parentFirstName,
  //         lastName: student.parentLastName || "",
  //         email: student.parentEmail,
  //         phone: student.parentPhone,
  //       };

  //       let parentUser;
  //       let parentEmail = null;

  //       // Process parent email - only add if it's valid
  //       if (p.email && typeof p.email === "string" && p.email.trim() !== "") {
  //         parentEmail = p.email.trim();
  //         // try find existing
  //         parentUser = await User.findOne({ email: parentEmail });
  //       }

  //       if (!parentUser) {
  //         // otherwise create new parent
  //         const parentData = {
  //           role: "parent",
  //           firstName: p.firstName,
  //           lastName: p.lastName || "", // ← never undefined
  //         };

  //         // Only add email if it actually exists
  //         if (parentEmail) parentData.email = parentEmail;
  //         if (p.phone) parentData.phone = p.phone;
  //         parentUser = new User(parentData);
  //         await parentUser.save();
  //       }

  //       // link student into family
  //       if (parentUser) {
  //         let family = await Family.findOne({ parentUser: parentUser._id });
  //         if (!family) {
  //           family = new Family({
  //             parentUser: parentUser._id,
  //             students: [],
  //           });
  //         }
  //         family.students.push(newStudent._id);
  //         await family.save();
  //       }
  //     }
  //     // 6) Log activity & create system log
  //     await new Activity({
  //       name: "New Student",
  //       description: `Added student ${newStudent.firstName} ${newStudent.lastName}`,
  //       studentId: newStudent._id,
  //     }).save();

  //     await createLog(
  //       "CREATE",
  //       "USER",
  //       newStudent._id,
  //       req.user,
  //       req,
  //       { role: "student" }
  //     );

  //     // 7) Respond success
  //     res.status(200).json({
  //       status: "success",
  //       message: "Student created successfully",
  //       student: {
  //         _id: newStudent._id,
  //         firstName: newStudent.firstName,
  //         lastName: newStudent.lastName,
  //         school: newStudent.school,
  //         email: newStudent.email && !newStudent.email.includes('@placeholder.internal')
  //           ? newStudent.email
  //           : null,
  //       },
  //     });
  //   } catch (error) {
  //     console.error("Error creating student:", error);
  //     res.status(500).json({
  //       status: "Error",
  //       message: "Error creating student",
  //       error: error.message,
  //     });
  //   }
  // },
  create: async (req, res) => {
    try {
      let student;
      if (req.body.student) {
        if (typeof req.body.student === "string") {
          student = JSON.parse(req.body.student);
        } else {
          student = req.body.student;
        }
      } else {
        student = req.body;
      }
      if (!student.firstName || !student.firstName.trim()) {
        return res
          .status(400)
          .json({ status: "Error", message: "First name is required" });
      }
      let adjustedGrade = student.grade ? student.grade.trim() : "";
      let deactivateAfterInsert = false;

      if (adjustedGrade.startsWith("Y")) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const cutoff = new Date(currentYear, 11, 22, 23, 59, 59);

        if (today > cutoff) {
          const match = /^Y(\d+)$/.exec(adjustedGrade);
          if (match) {
            const gradeNum = parseInt(match[1], 10);
            if (gradeNum < 12) {
              adjustedGrade = `Y${gradeNum + 1}`;
            } else {
              adjustedGrade = "Graduated";
              deactivateAfterInsert = true;
            }
          }
        }
      }
      const newStudentData = {
        role: "student",
        firstName: student.firstName.trim(),
        lastName: student.lastName ? student.lastName.trim() : "",
        grade: adjustedGrade,
        school: student.school || "",
        selfGuardian:
          student.selfGuardian === true || student.selfGuardian === "true",
      };

      if (deactivateAfterInsert) {
        newStudentData.isActive = false;
      }

      if (
        student.email &&
        typeof student.email === "string" &&
        student.email.trim() !== ""
      ) {
        const email = student.email.trim().toLowerCase();
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res
            .status(400)
            .json({ status: "Error", message: "Email already exists" });
        }
        newStudentData.email = email;
      } else if (student.email === "") {
        newStudentData.email = "";
      }
      if (student.phone) newStudentData.phone = student.phone;
      if (student.prefferedPayment)
        newStudentData.paymentSchedule = student.prefferedPayment;
      if (student.dateOfBirth) newStudentData.dateOfBirth = student.dateOfBirth;
      const result = await mongoose.connection.db
        .collection("users")
        .insertOne(newStudentData);
      const newStudent = await User.findById(result.insertedId);
      if (
        !newStudentData.selfGuardian &&
        (student.parent || (student.parentFirstName && student.parentPhone))
      ) {
        const p = student.parent || {
          firstName: student.parentFirstName,
          lastName: student.parentLastName || "",
          email: student.parentEmail,
          phone: student.parentPhone,
        };

        let parentUser;
        let parentEmail = null;

        if (p.email && typeof p.email === "string" && p.email.trim() !== "") {
          parentEmail = p.email.trim().toLowerCase();
          parentUser = await User.findOne({ email: parentEmail });
        }

        if (!parentUser) {
          const parentData = {
            role: "parent",
            firstName: p.firstName,
            lastName: p.lastName || "",
          };
          if (parentEmail) parentData.email = parentEmail;
          if (p.phone) parentData.phone = p.phone;

          parentUser = new User(parentData);
          await parentUser.save();
        }
        if (parentUser) {
          let family = await Family.findOne({ parentUser: parentUser._id });
          if (!family) {
            family = new Family({
              parentUser: parentUser._id,
              students: [],
            });
          }
          family.students.push(newStudent._id);
          await family.save();
        }
      }

      await new Activity({
        name: "New Student",
        description: `Added student ${newStudent.firstName} ${newStudent.lastName}`,
        studentId: newStudent._id,
      }).save();

      await createLog(
        "CREATE",
        "USER",
        newStudent._id,
        req.user,
        req,
        { role: "student" }
      );
      return res.status(200).json({
        status: "success",
        message: "Student created successfully",
        student: {
          _id: newStudent._id,
          firstName: newStudent.firstName,
          lastName: newStudent.lastName,
          school: newStudent.school,
          email:
            newStudent.email && !newStudent.email.includes("@placeholder.internal")
              ? newStudent.email
              : null,
          grade: newStudent.grade,
          isActive: newStudent.isActive,
        },
      });
    } catch (error) {
      console.error("Error creating student:", error);
      return res.status(500).json({
        status: "Error",
        message: "Error creating student",
        error: error.message,
      });
    }
  },
  getAll: async (req, res) => {
    try {
      const students = await User.find({ role: 'student' })
        .select('-password');

      await createLog('READ', 'USER', null, req.user, req, { role: 'student' });

      res.json(students);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching students', error: error.message });
    }
  },
  getAllFormatted: async (req, res) => {
    try {
      const Students = await User.find({ role: 'student' }).select('-password');
      let data = [];
  
      for (let i = 0; i < Students.length; i++) {
        let student = Students[i];
  
        // 1) Fetch classes (excluding the students array)
        let classes = await Class.find({ 'students.id': student._id }).select('-students');
  
        // 2) Find the family document that includes this student
        const family = await Family.findOne({ students: student._id }).select('-_id');
  
        // 3) Fetch parent details if available
        let parentDetails = null;
        if (family && family.parentUser) {
          const parent = await User.findById(family.parentUser).select('firstName lastName email phone');
          if (parent) {
            parentDetails = {
              id: parent._id,
              name: parent.firstName + ' ' + parent.lastName,
              email: parent.email || null,
              phone: parent.phone || null,
            };
          }
        }
  
        // 4) Fetch payments for either the student or their parent
        const Payments = await Payment.find({
          $or: [
            { user: student._id },
            { user: family?.parentUser },
          ]
        }).select('-student');
  
        // 5) Collect unique subject names from classes
        const subjects = [];
        if (classes.length > 0) {
          classes.forEach((cls) => {
            if (!subjects.includes(cls.subject)) {
              subjects.push(cls.subject);
            }
          });
        }
  
        // 6) Build the formatted object for this student, now including school and grade
        data.push({
          id: student._id,
          name: student.firstName + ' ' + student.lastName,
          email: student.email,
          phone: student.phone,
          dateOfBirth: student.dateOfBirth,
          initials: student.firstName.charAt(0) + student.lastName.charAt(0),
          classes: classes.length + ' classes',
          subjects: subjects,
          subscription: student.paymentSchedule,
          paymentHistory: Payments,
          isActive: student.isActive,
          parent: parentDetails,    // <-- include parent details (or null)
          school: student.school || null,
          grade: student.grade || null,
        });
      }
  
      res.status(200).json({
        status: 'success',
        data: data
      });
    } catch (error) {
      res.status(500).json({
        status: 'Error',
        message: 'Error fetching students',
        error: error.message
      });
    }
  },
  
  getById: async (req, res) => {
    try {
      // 1) Fetch the student document (excluding password)
      const student = await User.findOne({
        _id: req.params.id,
        role: 'student',
      }).select('-password');
  
      if (!student) {
        return res.status(404).json({ status: 'Error', message: 'Student not found' });
      }
  
      // 2) Fetch all classes for this student (excluding the students array)
      const classes = await Class.find({ 'students.id': student._id }).select('-students');
  
      // 3) Find the family document that includes this student
      const family = await Family.findOne({ students: student._id }).select('-_id');
  
      // 4) Fetch parent details if available
      let parentDetails = null;
      if (family && family.parentUser) {
        const parent = await User.findById(family.parentUser).select('firstName lastName email phone');
        if (parent) {
          parentDetails = {
            id: parent._id,
            name: parent.firstName + ' ' + parent.lastName,
            email: parent.email || null,
            phone: parent.phone || null,
          };
        }
      }
  
      // 5) Fetch payments for either the student or their parent
      const Payments = await Payment.find({
        $or: [
          { user: student._id },
          { user: family?.parentUser },
        ]
      }).select('-student');
  
      // 6) Collect unique subject names from the classes array
      const subjects = [];
      if (classes.length > 0) {
        classes.forEach((cls) => {
          if (!subjects.includes(cls.subject)) {
            subjects.push(cls.subject);
          }
        });
      }
  
      // 7) Log the READ action
      await createLog('READ', 'USER', student._id, req.user, req);
  
      // 8) Build the formatted response object for this single student, including school and grade
      const formatted = {
        id: student._id,
        name: student.firstName + ' ' + student.lastName,
        email: student.email,
        phone: student.phone,
        dateOfBirth: student.dateOfBirth,
        initials: student.firstName.charAt(0) + student.lastName.charAt(0),
        classes: classes.length + ' classes',
        subjects: subjects,
        subscription: student.paymentSchedule,
        paymentHistory: Payments,
        isActive: student.isActive,
        parent: parentDetails,
        school: student.school || null,
        grade: student.grade || null,
      };
  
      // 9) Send the formatted student
      return res.status(200).json({
        status: 'success',
        data: formatted
      });
    } catch (error) {
      return res.status(500).json({
        status: 'Error',
        message: 'Error fetching student',
        error: error.message
      });
    }
  },
  
  

  update: async (req, res) => {
    try {

      const { firstName, lastName, email, password, isActive } = req.body;
      let updateData = {};

      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        updateData.password = hashedPassword;
      }
      if (isActive === true || isActive === false) {
        updateData.isActive = isActive;
      }
      if (firstName) {
        updateData.firstName = firstName;
      }
      if (lastName) {
        updateData.lastName = lastName;
      }
      if (email) {
        updateData.email = email;
      }




      const student = await User.findOneAndUpdate(
        { _id: req.params.id, role: 'student' },
        updateData,
        { new: true }
      ).select('-password');

      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      await createLog('UPDATE', 'USER', student._id, req.user, req);

      res.json({
        message: 'Student updated successfully',
        student
      });
    } catch (error) {
      res.status(500).json({ message: 'Error updating student', error: error.message });
    }
  },
  // Update in studentController.js
  deactivateBulk: async (req, res) => {
    try {
      // Check if the request contains mixed activation statuses
      const { studentIds, isActive, studentUpdates } = req.body;

      console.log("Received bulk operation request:", req.body);

      // Handle new format (mixed activation/deactivation)
      if (studentUpdates && Array.isArray(studentUpdates) && studentUpdates.length > 0) {
        // Using bulkWrite for efficiency with mixed operations
        const bulkOperations = studentUpdates.map(update => ({
          updateOne: {
            filter: { _id: mongoose.Types.ObjectId(update.id), role: 'student' },
            update: { $set: { isActive: !!update.isActive } }
          }
        }));

        console.log(`Processing ${bulkOperations.length} mixed status updates`);

        const result = await User.bulkWrite(bulkOperations);

        // Track which students were updated for activity logging
        const updatedIds = studentUpdates.map(u => mongoose.Types.ObjectId(u.id));
        const updatedStudents = await User.find({
          _id: { $in: updatedIds },
          role: 'student'
        }).select('firstName lastName isActive');

        // Create activities for each student
        if (updatedStudents.length > 0) {
          const activities = updatedStudents.map(student => ({
            name: `Student status updated`,
            description: `Student ${student.firstName} ${student.lastName} was ${student.isActive ? 'activated' : 'deactivated'}`,
            studentId: student._id
          }));

          try {
            await Activity.insertMany(activities);
          } catch (activityError) {
            console.error("Error creating activities (non-fatal):", activityError);
          }
        }

        // Create system log
        try {
          if (typeof createLog === 'function') {
            await createLog(
              'UPDATE', 'USER', null, req.user || { _id: 'system' }, req,
              { role: 'student', bulkOperation: true, count: result.modifiedCount }
            );
          }
        } catch (logError) {
          console.error("Error creating system log (non-fatal):", logError);
        }

        return res.status(200).json({
          status: 'success',
          message: `Successfully updated ${result.modifiedCount} students with mixed statuses`,
          result: result
        });
      }

      // Original implementation (all students get same status)
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          status: 'Error',
          message: 'Please provide an array of student IDs'
        });
      }

      // Make sure isActive is a boolean
      const activeStatus = isActive === true || isActive === false ? isActive : false;

      // Convert string IDs to ObjectId
      const objectIds = studentIds.map(id => {
        try {
          return mongoose.Types.ObjectId(id);
        } catch (e) {
          return id; // Keep original if not valid ObjectId
        }
      });

      // Update all students in the array
      const result = await User.updateMany(
        {
          _id: { $in: objectIds },
          role: 'student'
        },
        {
          $set: { isActive: activeStatus }
        }
      );

      console.log("Update result:", result);

      // Skip activity creation if it's causing issues
      try {
        // Get all affected students for logging
        const updatedStudents = await User.find({
          _id: { $in: objectIds },
          role: 'student'
        }).select('firstName lastName');

        // Create activities for each student if Activity model exists
        if (typeof Activity !== 'undefined' && updatedStudents.length > 0) {
          const statusText = activeStatus ? 'activated' : 'deactivated';
          const activities = updatedStudents.map(student => ({
            name: `Student ${statusText}`,
            description: `Student ${student.firstName} ${student.lastName} was ${statusText}`,
            studentId: student._id
          }));

          await Activity.insertMany(activities);
        }
      } catch (activityError) {
        console.error("Error creating activities (non-fatal):", activityError);
      }

      // Create a system log if available
      try {
        if (typeof createLog === 'function') {
          await createLog(
            'UPDATE',
            'USER',
            null,
            req.user || { _id: 'system' },
            req,
            { role: 'student', bulkOperation: true, count: result.modifiedCount }
          );
        }
      } catch (logError) {
        console.error("Error creating system log (non-fatal):", logError);
      }

      // Return the result
      return res.status(200).json({
        status: 'success',
        message: `Successfully ${activeStatus ? 'activated' : 'deactivated'} ${result.modifiedCount} students`,
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      });
    } catch (error) {
      console.error(`Error in bulk student status update:`, error);
      return res.status(500).json({
        status: 'Error',
        message: `Error during bulk student status update`,
        error: error.message
      });
    }
  },
  delete: async (req, res) => {
    try {
      const student = await User.findOneAndDelete({
        _id: req.params.id,
        role: 'student'
      });

      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      await createLog('DELETE', 'USER', student._id, req.user, req);

      res.json({ message: 'Student deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting student', error: error.message });
    }
  },
  updateStudent: async (req, res) => {
    try {
      const studentId = req.params.id;
      const student = await User.findById(studentId);
      if (!student || student.role !== 'student') {
        return res.status(404).json({ status: 'Error', message: 'Student not found' });
      }
  
      // Since the frontend sends a plain JSON body, we can read directly from req.body
      const payload = req.body;
  
      // Check for email change and conflict
      if (payload.email && payload.email !== student.email) {
        const conflict = await User.findOne({ email: payload.email });
        if (conflict) {
          return res
            .status(400)
            .json({ status: 'Error', message: 'Email already in use' });
        }
        student.email = payload.email;
      }
  
      // Update password if provided
      if (payload.password) {
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(payload.password, salt);
      }
  
      // Update basic fields
      if (payload.firstName) student.firstName = payload.firstName;
      if (payload.lastName) student.lastName = payload.lastName;
      if (payload.phone) student.phone = payload.phone;
      if (payload.dateOfBirth) student.dateOfBirth = payload.dateOfBirth;
  
      // Update school and grade from frontend
      if (payload.school !== undefined) {
        student.school = payload.school;
      }
      if (payload.grade !== undefined) {
        student.grade = payload.grade;
      }
  
      // Map preferredPayment (from form) to paymentSchedule
      if (payload.preferredPayment) {
        student.paymentSchedule = payload.preferredPayment;
      }
  
      await student.save();
  
      // Log the activity
      const activity = new Activity({
        name: 'Student Updated',
        description: `Student ${student.firstName} ${student.lastName} updated`,
        studentId: student._id
      });
      await activity.save();
  
      await createLog(
        'UPDATE',
        'USER',
        student._id,
        req.user,
        req,
        { role: 'student' }
      );
  
      // Return the updated student fields, including the newly added school & grade
      res.status(200).json({
        status: 'success',
        message: 'Student updated successfully',
        student: {
          _id: student._id,
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          phone: student.phone,
          dateOfBirth: student.dateOfBirth,
          school: student.school || null,
          grade: student.grade || null,
          paymentSchedule: student.paymentSchedule
        }
      });
    } catch (error) {
      console.error('Error updating student:', error);
      res.status(500).json({
        status: 'Error',
        message: 'Error updating student',
        error: error.message
      });
    }
  },
  updateStudent: async (req, res) => {
    try {
      const studentId = req.params.id;
      const student = await User.findById(studentId);
      if (!student || student.role !== 'student') {
        return res.status(404).json({ status: 'Error', message: 'Student not found' });
      }
  
      // Since the frontend sends a plain JSON body, we can read directly from req.body
      const payload = req.body;
  
      // Check for email change and conflict
      if (payload.email && payload.email !== student.email) {
        const conflict = await User.findOne({ email: payload.email });
        if (conflict) {
          return res
            .status(400)
            .json({ status: 'Error', message: 'Email already in use' });
        }
        student.email = payload.email;
      }
  
      // Update password if provided
      if (payload.password) {
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(payload.password, salt);
      }
  
      // Update basic fields
      if (payload.firstName) student.firstName = payload.firstName;
      if (payload.lastName) student.lastName = payload.lastName;
      if (payload.phone) student.phone = payload.phone;  
      // Update school and grade from frontend
      if (payload.school !== undefined) {
        student.school = payload.school;
      }
      if (payload.grade !== undefined) {
        student.grade = payload.grade;
      }
        if (payload.preferredPayment) {
        student.paymentSchedule = payload.preferredPayment;
      }
  
      await student.save();
  
      // Log the activity
      const activity = new Activity({
        name: 'Student Updated',
        description: `Student ${student.firstName} ${student.lastName} updated`,
        studentId: student._id
      });
      await activity.save();
  
      await createLog(
        'UPDATE',
        'USER',
        student._id,
        req.user,
        req,
        { role: 'student' }
      );
  
      // Return the updated student fields, including the newly added school & grade
      res.status(200).json({
        status: 'success',
        message: 'Student updated successfully',
        student: {
          _id: student._id,
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          phone: student.phone,
          school: student.school || null,
          grade: student.grade || null,
          paymentSchedule: student.paymentSchedule
        }
      });
    } catch (error) {
      console.error('Error updating student:', error);
      res.status(500).json({
        status: 'Error',
        message: 'Error updating student',
        error: error.message
      });
    }
  },
    
  createLead: async (req, res, next) => {
    try {
      const { 
        firstName, 
        lastName, 
        phone, 
        address, 
        email, 
        source, 
        callNotes = [], 
        leadStatus = "warm",
        leadType = "student"
      } = req.body;
  
      // Updated validation logic
      if (!firstName || !source) {
        return res.status(400).json({
          status: 'error',
          message: "firstName and source are required"
        });
      }
  
      // Clean and normalize email input
      let cleanEmail = null;
      if (email && typeof email === 'string' && email.trim() && email.trim() !== '') {
        cleanEmail = email.toLowerCase().trim();
      }
  
      // Clean and normalize phone input
      let cleanPhone = null;
      if (phone && typeof phone === 'string' && phone.trim() && phone.trim() !== '') {
        cleanPhone = phone.trim();
      }
  
      // Either email OR phone must be provided (flexible contact validation)
      if (!cleanEmail && !cleanPhone) {
        return res.status(400).json({
          status: 'error',
          message: "Either email or phone number is required"
        });
      }
  
      // Validate email format if provided
      if (cleanEmail && !/\S+@\S+\.\S+/.test(cleanEmail)) {
        return res.status(400).json({
          status: 'error',
          message: "Invalid email format"
        });
      }
  
      // Validate phone format if provided
      if (cleanPhone && !/^\+?[0-9()\-\s]{8,}$/.test(cleanPhone)) {
        return res.status(400).json({
          status: 'error',
          message: "Invalid phone number format"
        });
      }
  
      // Validate leadStatus
      if (!["hot", "warm", "cold"].includes(leadStatus)) {
        return res.status(400).json({
          status: 'error',
          message: "leadStatus must be 'hot', 'warm', or 'cold'"
        });
      }
  
      // Validate leadType
      if (!["student", "parent"].includes(leadType)) {
        return res.status(400).json({
          status: 'error',
          message: "leadType must be 'student' or 'parent'"
        });
      }
  
      // Check for email uniqueness ONLY if email is provided
      if (cleanEmail) {
        // Check if email exists in leads table
        const existingLead = await Lead.findOne({ 
          email: cleanEmail 
        });
  
        if (existingLead) {
          return res.status(400).json({
            status: 'error',
            message: "A lead with this email already exists"
          });
        }
  
        // Check if email exists in users table
        const existingUser = await User.findOne({ 
          email: cleanEmail 
        });
  
        if (existingUser) {
          return res.status(400).json({
            status: 'error',
            message: "This email is already registered as a user. Please use a different email."
          });
        }
      }
  
      const leadData = {
        firstName: firstName.trim(),
        source: source.trim(),
        leadStatus,
        leadType,
        callNotes
      };
  
      // Only add optional fields if they have actual values
      if (lastName && lastName.trim()) {
        leadData.lastName = lastName.trim();
      }
  
      if (cleanPhone) {
        leadData.phone = cleanPhone;
      }
  
      if (address && address.trim()) {
        leadData.address = address.trim();
      }
  
      // IMPORTANT: Only add email if it has a value
      if (cleanEmail) {
        leadData.email = cleanEmail;
      }
  
      console.log('Creating lead with data:', leadData); // Debug log
  
      // Create the lead
      const lead = await Lead.create(leadData);
  
      res.status(201).json({ 
        status: 'success', 
        data: lead,
        message: `${leadType.charAt(0).toUpperCase() + leadType.slice(1)} lead created successfully!`
      });
  
    } catch (err) {
      console.error('Lead creation error:', err); // Debug log
  
      // Handle any remaining duplicate key errors
      if (err.code === 11000) {
        let field = 'field';
        let message = 'Duplicate entry detected';
  
        if (err.keyPattern?.email) {
          field = 'email';
          message = "A lead with this email already exists";
        } else if (err.keyPattern?.phone) {
          field = 'phone';
          message = "A lead with this phone number already exists";
        }
  
        return res.status(400).json({
          status: 'error',
          message: message,
          field: field
        });
      }
  
      // Handle validation errors
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors
        });
      }
  
      next(err);
    }
  },
  

  getLeads: async (req, res, next) => {
    try {
      const filters = req.query;
      const leads = await Lead.find(filters).sort({ createdAt: -1 });
      res.status(200).json({ status: 'success', data: leads });
    } catch (err) {
      next(err);
    }
  },

  getLeadById: async (req, res, next) => {
    try {
      const lead = await Lead.findById(req.params.id);
      if (!lead) throw new Error("Lead not found");
      res.status(200).json({ status: 'success', data: lead });
    } catch (err) { next(err); }
  },

  updateLead: async (req, res, next) => {
    try {
      const allowed = ["firstName", "lastName", "phone", "address", "email", "leadStatus", "source"];
      const updates = {};
      allowed.forEach(f => {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      });

      if (req.body.newNote && req.body.newNote.content) {
        const newNote = {
          content: req.body.newNote.content,
          createdBy: req.body.newNote.createdBy || req.user._id,
          date: new Date()
        };
        updates.$push = { callNotes: newNote };
      }

      const lead = await Lead.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      );

      if (!lead) throw new Error("Lead not found");
      res.status(200).json({ status: 'success', data: lead });
    } catch (err) {
      next(err);
    }
  },

  addLeadCallNote: async (req, res, next) => {
    try {
      const { content } = req.body;
      const note = { content, createdBy: req.user._id };
      const lead = await Lead.findByIdAndUpdate(
        req.params.id,
        { $push: { callNotes: note } },
        { new: true, runValidators: true }
      );
      if (!lead) throw new Error("Lead not found");
      res.status(200).json({ status: 'success', data: lead });
    } catch (err) { next(err); }
  },

  updateLeadStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!["hot", "warm", "cold", "lost", "converted"].includes(status)) {
        throw new Error("Invalid lead status");
      }
      const lead = await Lead.findByIdAndUpdate(
        req.params.id,
        { leadStatus: status },
        { new: true }
      );
      if (!lead) throw new Error("Lead not found");
      res.status(200).json({ status: 'success', data: lead });
    } catch (err) { next(err); }
  },

  convertLeadToStudent: async (req, res, next) => {
    try {
      const lead = await Lead.findById(req.params.id);
      if (!lead) throw new Error("Lead not found");

      const {
        firstName,
        lastName,
        email,
        phone,
        school,
        prefferedPayment,
        selfGuardian,
        parentFirstName,
        parentLastName,
        parentEmail,
        parentPhone
      } = req.body;

      // Prepare student data
      const studentData = {
        email: email || lead.email,
        role: "student",
        firstName: firstName || lead.firstName,
        lastName: lastName || lead.lastName,
        phone: phone || lead.phone,
        address: lead.address,
        leadRef: lead._id,
        school,
        prefferedPayment,
        selfGuardian: selfGuardian || false
      };

      // If not self-guardian, add parent information
      if (!selfGuardian && (parentFirstName || parentLastName || parentEmail || parentPhone)) {
        studentData.parentInfo = {
          firstName: parentFirstName,
          lastName: parentLastName,
          email: parentEmail,
          phone: parentPhone,
        };
      }

      // Create the student
      const student = await User.create(studentData);

      // Update lead status
      lead.leadStatus = "converted";
      await lead.save();

      // Send response
      res.status(200).json({
        status: 'success',
        message: 'Lead successfully converted to student',
        data: student
      });
    } catch (err) {
      next(err);
    }
  },

  rejectLead: async (req, res, next) => {
    try {
      const { reason } = req.body;
      const lead = await Lead.findById(req.params.id);
      if (!lead) throw new Error("Lead not found");
      lead.leadStatus = "lost";
      lead.callNotes.push({ content: `Rejected: ${reason}`, createdBy: req.user._id });
      await lead.save();
      res.status(200).json({ status: 'success', data: lead });
    } catch (err) { next(err); }
  },

  deleteLead: async (req, res, next) => {
    try {
      const lead = await Lead.findByIdAndDelete(req.params.id);
      if (!lead) throw new Error("Lead not found");
      res.status(200).json({ status: 'success', data: { message: 'Lead deleted successfully' } });
    } catch (err) { next(err); }
  }
};


exports.studentController = studentController;
