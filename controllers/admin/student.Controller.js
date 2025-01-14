const User = require('../../models/User');
const { createLog } = require('../../middleware/logger');
const bcrypt = require('bcryptjs');

const studentController = {
    create: async (req, res) => {
        try {
            const { email, password, firstName, lastName, phone } = req.body;

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newStudent = new User({
                email,
                password: hashedPassword,
                role: 'student',
                firstName,
                lastName,
                phone
            });

            await newStudent.save();

            await createLog('CREATE', 'USER', newStudent._id, req.user, req, { role: 'student' });

            res.status(201).json({
                message: 'Student created successfully',
                student: {
                    _id: newStudent._id,
                    email: newStudent.email,
                    firstName: newStudent.firstName,
                    lastName: newStudent.lastName
                }
            });
        } catch (error) {
            res.status(500).json({ message: 'Error creating student', error: error.message });
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
            const { firstName, lastName, phone } = req.body;

            const student = await User.findOneAndUpdate(
                { _id: req.params.id, role: 'student' },
                { firstName, lastName, phone },
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
