const tutorController = require("../../controllers/tutor/tutor.Controller");
const express = require("express");
const router = express.Router();
const { authenticateJWT, isTutor, isAdmin } = require("../../middleware/auth");

router.get(
  "/sessions",
  [authenticateJWT, isTutor],
  tutorController.getTutorSessions
);
router.put(
  "/sessionAttendance/:id",
  [authenticateJWT, isTutor],
  tutorController.markStudentPresent
);
router.post(
  "/request",
  [authenticateJWT, isTutor],
  tutorController.addTutorRequest
);
router.get(
  "/requests",
  [authenticateJWT, isTutor],
  tutorController.getTutorRequests
);
router.get(
  "/shifts",
  [authenticateJWT, isTutor],
  tutorController.getTutorShifts
);
router.put(
  "/markComplete/:id",
  [authenticateJWT, isTutor],
  tutorController.markSessionCompleted
),
  router.put(
    "/updateRequest/:id",
    [authenticateJWT, isAdmin],
    tutorController.updateRequestStatus
  );
router.get(
  "/payments",
  [authenticateJWT, isTutor],
  tutorController.getPayments
);
router.get(
  "/activities",
  [authenticateJWT, isTutor],
  tutorController.getTutorActivities
);
router.get("/stats", [authenticateJWT, isTutor], tutorController.getStats);

module.exports = router;
