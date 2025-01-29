const tutorController = require('../../controllers/tutor/tutor.Controller');
const express = require('express');
const router = express.Router();
const { authenticateJWT, isTutor } = require('../../middleware/auth');

router.get('/sessions', [authenticateJWT, isTutor], tutorController.getTutorSessions);
module.exports = router;