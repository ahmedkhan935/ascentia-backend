const User = require('../../models/User');
const { createLog } = require('../../middleware/logger');
const Family = require('../../models/Family');
const Class = require('../../models/Class');
const bcrypt = require('bcryptjs');
const Payment = require('../../models/Payment');
const Activity = require("../../models/Activity");
const studentController = {
  create: async (req, res) => {
    try {
      const student = req.body.student
        ? JSON.parse(req.body.student)
        : req.body;
      if (!student.firstName) {
        return res
          .status(400)
          .json({ status: 'Error', message: 'First name is required' });
      }
      
      // Check for email duplicate only if email is provided
      if (student.email) {
        const existingUser = await User.findOne({ email: student.email });
        if (existingUser) {
          return res
            .status(400)
            .json({ status: 'Error', message: 'Email already exists' });
        }
      }
      
      const isSelfGuardian =
        student.selfGuardian === true ||
        student.selfGuardian === 'true';
      
      const newStudentData = {
        role: 'student',
        firstName: student.firstName,
        selfGuardian: isSelfGuardian,
      };
  
      if (student.email)            newStudentData.email           = student.email;
      if (student.lastName)         newStudentData.lastName        = student.lastName;
      if (student.phone)            newStudentData.phone           = student.phone;
      if (student.dateOfBirth)      newStudentData.dateOfBirth     = student.dateOfBirth;
      if (student.prefferedPayment) newStudentData.paymentSchedule = student.prefferedPayment;
  
      const newStudent = new User(newStudentData);
      await newStudent.save();
  
      if (!isSelfGuardian && student.parent) {
        const p = student.parent;
        let parentUser;
        if (p.email) {
          parentUser = await User.findOne({ email: p.email });
          if (!parentUser) {
            const parentData = { role: 'parent', firstName: p.firstName };
            if (p.lastName)  parentData.lastName  = p.lastName;
            if (p.email)     parentData.email     = p.email;
            if (p.phone)     parentData.phone     = p.phone;
  
            parentUser = new User(parentData);
            await parentUser.save();
          }
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
        name: 'New Student',
        description: `Added student ${newStudent.firstName}`,
        studentId: newStudent._id,
      }).save();
  
      await createLog(
        'CREATE',
        'USER',
        newStudent._id,
        req.user,
        req,
        { role: 'student' }
      );
  
      res.status(200).json({
        status: 'success',
        message: 'Student created successfully',
        student: {
          _id: newStudent._id,
          firstName: newStudent.firstName,
          lastName: newStudent.lastName,
          email: newStudent.email,
        },
      });
    } catch (error) {
      console.error('Error creating student:', error);
      res.status(500).json({
        status: 'Error',
        message: 'Error creating student',
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
        try
        {
            const Students = await User.find({ role: 'student' }).select('-password');
            let data = [];
            //append the class object for each class for each student
            for (let i = 0; i < Students.length; i++) {
                let student = Students[i];
                
                let classes = await Class.find({ 'students.id': student._id }).select('-students');
                const family = await Family.findOne({ students: { $in: [student._id] } }).select('-_id');   
                const Payments = await Payment.find({
                    $or: [
                        { user: student._id },
                        { user: family?.parentUser }
                    ]
                }).select('-student');
                const subjects = [];
                if(classes.length>0)
                {
                    classes.map((cls)=>{
                        if(!subjects.includes(cls.subject))
                        {
                            subjects.push(cls.subject);
                        }
                    }   
                    );
                }
                data.push({
                    id: student._id,
                    name: student.firstName + ' ' + student.lastName,
                    email: student.email,
                    phone: student.phone,               // added phone
                    dateOfBirth: student.dateOfBirth,
                    initials: student.firstName.charAt(0) + student.lastName.charAt(0),
                    classes: classes.length + ' classes',
                    subjects: subjects,
                    subscription: student.paymentSchedule,
                    paymentHistory:Payments,
                    isActive: student.isActive,


                })
            }
            res.status(200).json({
                status: 'success',
                data: data
            });
        }
        catch(error)
        {
            res.status(500).json({ message: 'Error fetching students', error: error.message,status:"Error" });

        }
    },

    getById: async (req, res) => {
        try {
            const student = await User.findOne({ 
                _id: req.params.id,
                role: 'student'
            }).select('-password');

            if (!student) {
                return res.status(404).json({ message: 'Student not found' });
            }

            await createLog('READ', 'USER', student._id, req.user, req);

            res.json(student);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching student', error: error.message });
        }
    },

    update: async (req, res) => {
        try {
       
            const { firstName, lastName, email,password,isActive } = req.body;
            let updateData={};
            
            if(password) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
               updateData.password = hashedPassword;
            }
            if(isActive===true||isActive===false) {
                updateData.isActive = isActive;
            }
            if(firstName) {
                updateData.firstName = firstName;
            }
            if(lastName) {
                updateData.lastName = lastName;
            }
            if(email) {
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
              const payload = req.body.student
            ? JSON.parse(req.body.student)
            : req.body;
              if (payload.email && payload.email !== student.email) {
            const conflict = await User.findOne({ email: payload.email });
            if (conflict) {
              return res
                .status(400)
                .json({ status: 'Error', message: 'Email already in use' });
            }
            student.email = payload.email;
          }
    
          if (payload.password) {
            const salt = await bcrypt.genSalt(10);
            student.password = await bcrypt.hash(payload.password, salt);
          }
    
          if (payload.firstName)    student.firstName      = payload.firstName;
          if (payload.lastName)     student.lastName       = payload.lastName;
          if (payload.phone)        student.phone          = payload.phone;
          if (payload.dateOfBirth)  student.dateOfBirth    = payload.dateOfBirth;
          if (payload.preferredPayment) 
                                    student.paymentSchedule = payload.preferredPayment;
    
          await student.save();
          const activity = new Activity({
            name:        'Student Updated',
            description: `Student ${student.firstName} ${student.lastName} updated`,
            studentId:   student._id
          });
          await activity.save();
          
          await createLog('UPDATE', 'USER', student._id, req.user, req, { role: 'student' });
          res.status(200).json({
            status:  'success',
            message: 'Student updated successfully',
            student: {
              _id:        student._id,
              email:      student.email,
              firstName:  student.firstName,
              lastName:   student.lastName,
              phone:      student.phone,
              dateOfBirth:student.dateOfBirth,
              paymentSchedule: student.paymentSchedule
            }
          });
        } catch (error) {
          console.error('Error updating student:', error);
          res
            .status(500)
            .json({ status: 'Error', message: 'Error updating student', error: error.message });
        }
      }
};
exports.studentController = studentController;
