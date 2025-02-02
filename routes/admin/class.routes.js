const ClassController = require("../../controllers/admin/class.Controller");
const express = require("express");
const router = express.Router();
const { isAdmin, authenticateJWT } = require("../../middleware/auth");
router.post("/", [authenticateJWT, isAdmin], ClassController.createClass);
router.get(
  "/sessions",
  [authenticateJWT, isAdmin],
  ClassController.getAllSessions
);
router.put(
  "/assign-room",
  [authenticateJWT, isAdmin],
  ClassController.assignRoomToSession
);
router.put(
  "/unassign-room",
  [authenticateJWT, isAdmin],
  ClassController.unassignRoomFromSession
);
router.get("/", [authenticateJWT, isAdmin], ClassController.getClasses);
router.post("/session", [authenticateJWT, isAdmin], ClassController.addSession);
router.post(
  "/session-remove",
  [authenticateJWT, isAdmin],
  ClassController.deleteSession
);
router.get(
  "/:classId/sessions",
  [authenticateJWT, isAdmin],
  ClassController.getClassSessions
);
router.get(
  "/:classId/sessions/stats",
  [authenticateJWT, isAdmin],
  ClassController.getClassSessionsStats
);
module.exports = router;
