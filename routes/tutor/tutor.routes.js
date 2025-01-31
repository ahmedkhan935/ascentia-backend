const tutorController = require('../../controllers/tutor/tutor.Controller');
const express = require('express');
const router = express.Router();
const { authenticateJWT, isTutor } = require('../../middleware/auth');

router.get('/sessions', [authenticateJWT, isTutor], tutorController.getTutorSessions);
router.put('/sessionAttendance/:id', [authenticateJWT, isTutor], tutorController.markStudentPresent);
module.exports = router;