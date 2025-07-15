const tutorController = require("../../controllers/tutor/tutor.Controller");
const express = require("express");
const router = express.Router();
const { authenticateJWT, isTutor, isAdmin } = require("../../middleware/auth");

router.get(
  "/classes",
  [authenticateJWT, isTutor],
  tutorController.getTutorClasses
);
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
  "/cancellation-requests",
  [authenticateJWT, isTutor],
  tutorController.getCancellationRequests
);
router.get(
  "/reschedule-requests",
  [authenticateJWT, isTutor],
  tutorController.getRescheduleRequests
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
router.post(
  "/cancelSession",
  [authenticateJWT, isTutor],
  tutorController.cancelSession
);
router.post(
  "/rescheduleSession",
  [authenticateJWT, isTutor],
  tutorController.rescheduleSession
);
router.post(
  "/rescheduleShift",
  [authenticateJWT, isTutor],
  tutorController.rescheduleShift
);

module.exports = router;
