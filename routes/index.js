// routes/index.js
const express = require("express");
const router = express.Router();

// Import route files
const authRoutes = require("./auth.routes");
const studentRoutes = require("./admin/student.routes");
const tutorRoutes = require("./admin/tutor.routes");
const roomRoutes = require("./admin/room.routes");
const familyRoutes = require("./admin/family.routes");
const classRoutes = require("./admin/class.routes");
const tutorRoutesmain = require("./tutor/tutor.routes");
const studentsRoutes = require("./student/student.routes");

//Mount routes
router.use("/auth", authRoutes);
router.use("/admin/classes", classRoutes);
router.use("/admin/students", studentRoutes);
router.use("/admin/tutors", tutorRoutes);
router.use("/admin/families", familyRoutes);
router.use("/admin/rooms", roomRoutes);
router.use("/tutor", tutorRoutesmain);
router.use("/student", studentsRoutes);

module.exports = router;
