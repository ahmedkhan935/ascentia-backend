// routes/admin/tutor.routes.js
const express = require('express');
const router = express.Router();
const tutorController = require('../../controllers/admin/tutor.Controller');
const { authenticateJWT, isAdmin, isTutor } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

router.post('/', [authenticateJWT, isAdmin],upload.single('photo'), tutorController.create);
router.get('/', [authenticateJWT, isAdmin], tutorController.getAll);
router.get('/bonus', [authenticateJWT, isAdmin], tutorController.getBonuses);
router.get('/requests/pending', [authenticateJWT, isAdmin], tutorController.getPendingRequests);
router.get('/:id', [authenticateJWT, isAdmin], tutorController.getById);
router.put('/:id', [authenticateJWT, isAdmin], tutorController.update);
router.delete('/:id', [authenticateJWT, isAdmin], tutorController.delete);
router.post("/:id/shift", [authenticateJWT, isAdmin], tutorController.addShift);
router.delete("/:id/shift/:shiftId", [authenticateJWT, isAdmin], tutorController.removeShift);
router.get("/:id/shift/:shiftId", [authenticateJWT, isAdmin], tutorController.getShift);
router.post('/:id/bonus', [authenticateJWT, isAdmin], tutorController.AddBonus);
router.delete('/:id/bonus/:bonusId', [authenticateJWT, isAdmin], tutorController.removeBonus);
router.get('/:id/bonus', [authenticateJWT, isAdmin], tutorController.getBonus);
router.get('/:id/bonus/:bonusId', [authenticateJWT, isAdmin], tutorController.getBonusById);
router.get('/:tutorId/classes-sessions', [authenticateJWT, isTutor], tutorController.getTutorClassesAndSessions);



module.exports = router;