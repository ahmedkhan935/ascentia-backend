const User = require('../../models/User');
const { createLog } = require('../../middleware/logger');
const Family = require('../../models/Family');
const Class = require('../../models/Class');
const bcrypt = require('bcryptjs');
const Payment = require('../../models/Payment');

const studentController = {
    create: async (req, res) => {
        try {
            const student = req.body.student?JSON.parse(req.body.student):req.body;
            console.log(student);
            const existingUser = await User.findOne({ email: student.email });
            if (existingUser) {
                return res.status(400).json({ status:"Error",message: 'User with this email already exists' });
            }
            

          

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(student.password, salt);

            const newStudent = new User({
                email:student.email,
                password: hashedPassword,
                role: 'student',
                firstName: student.firstName,
                lastName: student.lastName,
                phone: student.phone,
                dateOfBirth: student.dateOfBirth,
                paymentSchedule: student.prefferedPayment
            });
            
            const parent = student.parent;
            const hashedPassword2 = await bcrypt.hash(parent.password, salt);
            const newParent = new User({
                email: parent.email,
                password: hashedPassword,
                role: 'parent',
                firstName: parent.firstName,
                lastName: parent.lastName,
                phone: parent.phone,
                dateOfBirth: parent.dob
            });
            const newFamily = new Family({
                parentUser: newParent._id,
                students: [newStudent._id]
            });
            
            await newStudent.save();
            await newParent.save();
            await newFamily.save();

            await createLog('CREATE', 'USER', newStudent._id, req.user, req, { role: 'student' });

            res.status(200).json({
                status: 'success',
                message: 'Student created successfully',
                student: {
                    _id: newStudent._id,
                    email: newStudent.email,
                    firstName: newStudent.firstName,
                    lastName: newStudent.lastName
                }
            });
        } catch (error) {
            res.status(500).json({ status:"Error",message: 'Error creating student', error: error.message });
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
            console.log(req.body);
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

            console.log(updateData);


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
    }
};
exports.studentController = studentController;
