// routes/index.js
const express = require('express');
const router = express.Router();

// Import route files
const authRoutes = require('./auth.routes');
const studentRoutes = require('./admin/student.routes');
const tutorRoutes = require('./admin/tutor.routes');
const roomRoutes = require('./admin/room.routes');
const familyRoutes = require('./admin/family.routes');

//Mount routes
router.use('/auth', authRoutes);
router.use('/admin/students', studentRoutes);
router.use('/admin/tutors', tutorRoutes);
router.use('/admin/families', familyRoutes);
router.use('/admin/rooms', roomRoutes); 

module.exports = router;