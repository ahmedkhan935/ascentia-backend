// controllers/admin/family.controller.js
const Family = require('../../models/Family');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');

const familyController = {
    create: async (req, res) => {
        try {
            const { 
                parentEmail, 
                parentPassword, 
                parentFirstName, 
                parentLastName, 
                phone,
                billingAddress,
                paymentMethods,
                students 
            } = req.body;

            // Create parent user account
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(parentPassword, salt);

            const parentUser = new User({
                email: parentEmail,
                password: hashedPassword,
                role: 'parent',
                firstName: parentFirstName,
                lastName: parentLastName,
                phone
            });

            await parentUser.save();

            // Create student accounts if provided
            const studentIds = [];
            if (students && students.length > 0) {
                for (const student of students) {
                    const studentSalt = await bcrypt.genSalt(10);
                    const studentPassword = await bcrypt.hash(student.password || 'defaultPassword123', studentSalt);
                    
                    const newStudent = new User({
                        email: student.email,
                        password: studentPassword,
                        role: 'student',
                        firstName: student.firstName,
                        lastName: student.lastName
                    });

                    await newStudent.save();
                    studentIds.push(newStudent._id);
                }
            }

            // Create family record
            const newFamily = new Family({
                parentUser: parentUser._id,
                students: studentIds,
                billingAddress,
                paymentMethods
            });

            await newFamily.save();

            res.status(201).json({
                message: 'Family created successfully',
                family: {
                    _id: newFamily._id,
                    parentUser: {
                        _id: parentUser._id,
                        email: parentUser.email,
                        firstName: parentUser.firstName,
                        lastName: parentUser.lastName
                    },
                    students: studentIds,
                    billingAddress: newFamily.billingAddress
                }
            });
        } catch (error) {
            res.status(500).json({ message: 'Error creating family', error: error.message });
        }
    },

    getAll: async (req, res) => {
        try {
            const families = await Family.find()
                .populate('parentUser', '-password')
                .populate('students', '-password');
            
            res.json(families);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching families', error: error.message });
        }
    },

    getById: async (req, res) => {
        try {
            const family = await Family.findById(req.params.id)
                .populate('parentUser', '-password')
                .populate('students', '-password');

            if (!family) {
                return res.status(404).json({ message: 'Family not found' });
            }

            res.json(family);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching family', error: error.message });
        }
    },

    update: async (req, res) => {
        try {
            const { billingAddress, paymentMethods } = req.body;

            const family = await Family.findByIdAndUpdate(
                req.params.id,
                { billingAddress, paymentMethods },
                { new: true }
            )
            .populate('parentUser', '-password')
            .populate('students', '-password');

            if (!family) {
                return res.status(404).json({ message: 'Family not found' });
            }

            res.json({
                message: 'Family updated successfully',
                family
            });
        } catch (error) {
            res.status(500).json({ message: 'Error updating family', error: error.message });
        }
    },

    addStudent: async (req, res) => {
        try {
            const { email, password, firstName, lastName } = req.body;
            const familyId = req.params.id;

            // Create student account
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newStudent = new User({
                email,
                password: hashedPassword,
                role: 'student',
                firstName,
                lastName
            });

            await newStudent.save();

            // Add student to family
            const family = await Family.findByIdAndUpdate(
                familyId,
                { $push: { students: newStudent._id } },
                { new: true }
            )
            .populate('parentUser', '-password')
            .populate('students', '-password');

            if (!family) {
                await User.findByIdAndDelete(newStudent._id);
                return res.status(404).json({ message: 'Family not found' });
            }

            res.json({
                message: 'Student added to family successfully',
                family
            });
        } catch (error) {
            res.status(500).json({ message: 'Error adding student to family', error: error.message });
        }
    },

    removeStudent: async (req, res) => {
        try {
            const { familyId, studentId } = req.params;

            const family = await Family.findByIdAndUpdate(
                familyId,
                { $pull: { students: studentId } },
                { new: true }
            )
            .populate('parentUser', '-password')
            .populate('students', '-password');

            if (!family) {
                return res.status(404).json({ message: 'Family not found' });
            }

            res.json({
                message: 'Student removed from family successfully',
                family
            });
        } catch (error) {
            res.status(500).json({ message: 'Error removing student from family', error: error.message });
        }
    },

    delete: async (req, res) => {
        try {
            const family = await Family.findById(req.params.id)
                .populate('parentUser')
                .populate('students');

            if (!family) {
                return res.status(404).json({ message: 'Family not found' });
            }

            // Delete all associated students
            for (const student of family.students) {
                await User.findByIdAndDelete(student._id);
            }

            // Delete parent user
            await User.findByIdAndDelete(family.parentUser._id);

            // Delete family record
            await Family.findByIdAndDelete(req.params.id);

            res.json({ message: 'Family and associated accounts deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error deleting family', error: error.message });
        }
    }
};

module.exports = familyController;