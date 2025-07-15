const express = require('express');
const authController = require('../controllers/auth.Controller');
const isAuthenticated = require('../middleware/auth').authenticateJWT;
const router = express.Router();

// Route for creating an admin user
router.post('/admin', authController.createAdmin);

// Route for user login
router.post('/login', authController.login);
router.post ('/forgot-password', authController.forgotPassword);
router.post ('/verify-code', authController.verifyResetCode);
router.post ('/reset-password', authController.updatePassword);
router.post('/logout',isAuthenticated ,authController.logout);
router.put('/user',isAuthenticated,authController.updateUser);
router.get('/user',isAuthenticated,authController.getUser);
router.post('/change-password', isAuthenticated, authController.changePassword);


module.exports = router;