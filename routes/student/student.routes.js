const studentController = require("../../controllers/student/studentController");

const express = require("express");
const router = express.Router();

router.get("/tutors", studentController.getAllTutors);

module.exports = router;
