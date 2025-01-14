const express = require('express');
const authController = require('../controllers/auth.Controller');

const router = express.Router();

// Route for creating an admin user
router.post('/admin', authController.createAdmin);

// Route for user login
router.post('/login', authController.login);

module.exports = router;