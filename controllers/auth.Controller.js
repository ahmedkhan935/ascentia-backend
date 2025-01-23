const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createLog } = require('../middleware/logger');
const sendEmail = require('../config/email');

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
            user.current_status = 'online';
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
    },
    forgotPassword: async (req, res) => {   
        try {
            const { email } = req.body;
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            //6 digit random number
            const resetCode = Math.floor(100000 + Math.random() * 900000);
            user.resetCode = resetCode;
            await user.save();
            //send email
            const subject = 'Password Reset';
            const text = `Your password reset code is ${resetCode}`;
                        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                    }
                    .container {
                        width: 80%;
                        margin: 0 auto;
                        padding: 20px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        background-color: #f9f9f9;
                    }
                    .header, .footer {
                        text-align: center;
                        background-color: #4CAF50;
                        color: white;
                        padding: 10px 0;
                    }
                    .content {
                        margin: 20px 0;
                    }
                    .reset-code {
                        font-size: 1.2em;
                        font-weight: bold;
                        color: #4CAF50;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Company Name</h1>
                    </div>
                    <div class="content">
                        <p>Dear User,</p>
                        <p>Your password reset code is:</p>
                        <p class="reset-code">${resetCode}</p>
                        <p>Please use this code to reset your password. If you did not request a password reset, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>Company Name</p>
                    </div>
                </div>
            </body>
            </html>
            `;
            await sendEmail(email, subject, text, html);
            res.json({ message: 'Password reset link sent' });

        } catch (error) {
            res.status(500).json({ message: 'Error sending password reset link', error: error.message });
        }
    },
    verifyResetCode : async (req, res) => {
        try {
            const { email, resetCode } = req.body;
            console.log(email,resetCode);
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            
            if (user.resetCode != resetCode) {
                return res.status(400).json({ message: 'Invalid reset code' });
            }
            else{
                user.resetCode = null;
                await user.save();
                res.json({ message: 'Reset code verified' });
            }
        } catch (error) {
            res.status(500).json({ message: 'Error verifying reset code', error: error.message });
        }
    },
    logout : async (req, res) => {
        try {
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            user.current_status = 'offline';
            await user.save();



            await createLog('LOGOUT', 'USER', req.user._id, req.user, req);
            
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error logging out', error: error.message });
        }
    },
    updatePassword : async (req,res) =>{
        try
        {
                const {email,password} = req.body;
            const user = await User.findOne({email});
            if(!user){
                return res.status(404).json({message:'User not found'});
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            user.password = hashedPassword;
            await user.save();
            res.json({message:'Password updated successfully'});
        }
        catch(error) {
            console.log(error);
            res.status(500).json({message:'Error updating password',error:error.message});


        }
    }
    

};

module.exports = authController;