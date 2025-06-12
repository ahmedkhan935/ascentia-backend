const express = require("express");
const { authenticateJWT, isAdmin } = require("../../middleware/auth");
const ClassController = require("../../controllers/admin/class.Controller");
const CategoryController = require("../../controllers/admin/Category.Controller");

const router = express.Router();

// ----- Category Routes -----
router.post(
  "/create",
  [authenticateJWT, isAdmin],
  CategoryController.createCategory
);
router.get(
  "/getAll",
  [authenticateJWT, isAdmin],
  CategoryController.getAllCategories
);
router.get(
  "/getIndividual/:id",
  [authenticateJWT, isAdmin],
  CategoryController.getCategory
);
router.put(
  "/updateCategory/:id",
  [authenticateJWT, isAdmin],
  CategoryController.updateCategory
);
router.delete(
  "/delete/:id",
  [authenticateJWT, isAdmin],
  CategoryController.deleteCategory
);

// ----- Class Routes -----
router.post(
  "/",
  [authenticateJWT, isAdmin],
  ClassController.createClass
);
router.post("/cancel-future-sessions", [authenticateJWT,isAdmin], ClassController.cancelFutureSessions);
router.get(
  "/",
  [authenticateJWT, isAdmin],
  ClassController.getClasses
);
router.patch(
  "/:classId/complete",
  [authenticateJWT, isAdmin],
  ClassController.markClassAsCompleted
);

// ----- Session Routes -----
router.get(
  "/sessions",
  [authenticateJWT, isAdmin],
  ClassController.getAllSessions
);
router.post(
  "/session",
  [authenticateJWT, isAdmin],
  ClassController.addSession
);
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
router.get(
  "/dashboard",
  [authenticateJWT, isAdmin],
  ClassController.getDashboardStats
);
router.post(
  "/cancel-session",
  [authenticateJWT, isAdmin],
  ClassController.cancelSession
);
router.post(
  "/reschedule-session",
  [authenticateJWT, isAdmin],
  ClassController.rescheduleSession
);
router.patch(
  "/sessions/:sessionId/complete",
  [authenticateJWT, isAdmin],
  ClassController.markSessionAsCompleted
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

module.exports = router;