const express = require("express");
const router = express.Router();
const studentController =
  require("../../controllers/admin/student.Controller").studentController;
const {
  authenticateJWT,
  isAdmin,
  isStudent,
} = require("../../middleware/auth");
const upload = require("../../middleware/upload");

router.post(
  "/",
  [authenticateJWT, isAdmin],
  upload.single("photo"),
  studentController.create
);
router.get("/", [authenticateJWT, isAdmin], studentController.getAllFormatted);
router.get("/:id", [authenticateJWT, isAdmin], studentController.getById);
router.put("/:id", [authenticateJWT, isAdmin], studentController.update);
router.delete("/:id", [authenticateJWT, isAdmin], studentController.delete);
router.put("/update/:id",[authenticateJWT,isAdmin],studentController.updateStudent)
module.exports = router;
