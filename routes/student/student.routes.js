const studentController = require("../../controllers/student/studentController");

const express = require("express");
const router = express.Router();
const { authenticateJWT, isStudent } = require("../../middleware/auth");

router.get(
  "/tutors",
  [authenticateJWT, isStudent],
  studentController.getAllTutors
);
router.get(
  "/classes",
  [authenticateJWT, isStudent],
  studentController.getMyClasses
);
router.post(
  "/sessions/:sessionId/feedback",
  [authenticateJWT, isStudent],
  studentController.submitFeedback
);
router.get('/activities',[authenticateJWT,isStudent],studentController.getStudentActivities);

module.exports = router;
