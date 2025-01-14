const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createLog } = require('../middleware/logger');

const authController = {
    createAdmin: async (req, res) => {
        try {
            const { email, password, firstName, lastName, phone } = req.body;

            // Check if admin already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'User already exists' });
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Create admin user
            const newAdmin = new User({
                email,
                password: hashedPassword,
                role: 'admin',
                firstName,
                lastName,
                phone
            });

            await newAdmin.save();

            await createLog(
                'CREATE',
                'USER',
                newAdmin._id,
                req.user || newAdmin,
                req,
                { role: 'admin' }
            );

            res.status(201).json({ 
                message: 'Admin created successfully',
                admin: {
                    _id: newAdmin._id,
                    email: newAdmin.email,
                    firstName: newAdmin.firstName,
                    lastName: newAdmin.lastName,
                    role: newAdmin.role
                }
            });
        } catch (error) {
            res.status(500).json({ message: 'Error creating admin', error: error.message });
        }
    },

    login: async (req, res) => {
        try {
            const { email, password } = req.body;

            // Find user
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Create token
            const token = jwt.sign(
                { userId: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            await createLog('LOGIN', 'USER', user._id, user, req);

            res.json({
                token,
                user: {
                    _id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role
                }
            });
        } catch (error) {
            res.status(500).json({ message: 'Error logging in', error: error.message });
        }
    }
};

module.exports = authController;