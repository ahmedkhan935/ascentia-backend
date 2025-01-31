const tutorController = require('../../controllers/tutor/tutor.Controller');
const express = require('express');
const router = express.Router();
const { authenticateJWT, isTutor } = require('../../middleware/auth');

router.get('/sessions', [authenticateJWT, isTutor], tutorController.getTutorSessions);
router.post('/request', [authenticateJWT, isTutor], tutorController.addTutorRequest);
router.get('/requests', [authenticateJWT, isTutor], tutorController.getTutorRequests);
router.get('/shifts', [authenticateJWT, isTutor], tutorController.getTutorShifts);
module.exports = router;