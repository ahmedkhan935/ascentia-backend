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
router.get(
  "/activities",
  [authenticateJWT, isStudent],
  studentController.getStudentActivities
);
router.get(
  "/sessions",
  [authenticateJWT, isStudent],
  studentController.getStudentSessions
);
router.put(
  "/profile",
  [authenticateJWT, isStudent],
  studentController.updateProfile
);
router.get(
  "/profile",
  [authenticateJWT, isStudent],
  studentController.getProfile
);
module.exports = router;
