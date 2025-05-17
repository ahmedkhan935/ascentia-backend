const express = require("express");
const router = express.Router();
const studentController =
  require("../../controllers/admin/student.Controller").studentController;
const {
  authenticateJWT,
  isAdmin,
} = require("../../middleware/auth");
const upload = require("../../middleware/upload");

// Create student
router.post(
  "/",
  [authenticateJWT, isAdmin],
  upload.single("photo"),
  studentController.create
);

// Get all students
router.get(
  "/", 
  [authenticateJWT, isAdmin], 
  studentController.getAllFormatted
);

// Get all leads - needs to be before "/:id" route
router.get(
  "/getAllLeads",
  [authenticateJWT, isAdmin],
  studentController.getLeads
);

// Create a new lead - needs to be before "/:id" route
router.post(
  "/leads",
  [authenticateJWT, isAdmin],
  studentController.createLead
);

// Update student - needs to be before "/:id" route
router.put(
  "/update/:id",
  [authenticateJWT, isAdmin],
  studentController.updateStudent
);

// Get lead by ID - needs to be before "/:id" route
router.get(
  "/leads/:id",
  [authenticateJWT, isAdmin],
  studentController.getLeadById
);

// Update lead - needs to be before "/:id" route
router.patch(
  "/leads/:id",
  [authenticateJWT, isAdmin],
  studentController.updateLead
);

// Add a call note - needs to be before "/:id" route
router.post(
  "/leads/:id/call-notes",
  [authenticateJWT, isAdmin],
  studentController.addLeadCallNote
);

// Update lead status - needs to be before "/:id" route
router.patch(
  "/leads/:id/status",
  [authenticateJWT, isAdmin],
  studentController.updateLeadStatus
);

// Convert lead to student - needs to be before "/:id" route
router.post(
  "/leads/:id/convert",
  [authenticateJWT, isAdmin],
  studentController.convertLeadToStudent
);

// Reject a lead - needs to be before "/:id" route
router.post(
  "/leads/:id/reject",
  [authenticateJWT, isAdmin],
  studentController.rejectLead
);

// Delete lead - needs to be before "/:id" route
router.delete(
  "/leads/:id",
  [authenticateJWT, isAdmin],
  studentController.deleteLead
);

// Get student by ID
router.get(
  "/:id", 
  [authenticateJWT, isAdmin], 
  studentController.getById
);

// Update student by ID
router.put(
  "/:id", 
  [authenticateJWT, isAdmin], 
  studentController.update
);

// Delete student by ID
router.delete(
  "/:id", 
  [authenticateJWT, isAdmin], 
  studentController.delete
);

module.exports = router;