// routes/admin/tutor.routes.js
const express = require('express');
const router = express.Router();
const tutorController = require('../../controllers/admin/tutor.Controller');
const { authenticateJWT, isAdmin, isTutor } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

router.post('/', [authenticateJWT, isAdmin],upload.single('photo'), tutorController.create);
router.get('/', [authenticateJWT, isAdmin], tutorController.getAll);
router.get('/getAll', [authenticateJWT, isAdmin], tutorController.getAllTutors);
router.get('/bonus', [authenticateJWT, isAdmin], tutorController.getBonuses);
router.get("/activities", [authenticateJWT, isAdmin], tutorController.getActivities);
router.get("/payments/admin", [authenticateJWT, isAdmin], tutorController.getPayments);
router.get('/requests/pending', [authenticateJWT, isAdmin], tutorController.getPendingRequests);
router.get('/requests/all', [authenticateJWT, isAdmin], tutorController.getAllRequests);
router.get('/:id', [authenticateJWT, isAdmin], tutorController.getById);
router.put('/:id', [authenticateJWT, isAdmin], tutorController.update);
router.post('/check-email', tutorController.checkEmailExists);
router.patch(
  "/:id/status",
  [authenticateJWT, isAdmin],
  tutorController.changeStatus
);
router.delete('/:id', [authenticateJWT, isAdmin], tutorController.delete);
router.post("/:id/shift", [authenticateJWT, isAdmin], tutorController.addShift);
router.delete("/:id/shift/:shiftId", [authenticateJWT, isAdmin], tutorController.removeShift);
router.get("/:id/shift", [authenticateJWT, isAdmin], tutorController.getShift);
router.post('/:id/bonus', [authenticateJWT, isAdmin], tutorController.AddBonus);
router.delete('/:id/bonus/:bonusId', [authenticateJWT, isAdmin], tutorController.removeBonus);
router.get('/:id/bonus', [authenticateJWT, isAdmin], tutorController.getBonus);
router.get('/:id/bonus/:bonusId', [authenticateJWT, isAdmin], tutorController.getBonusById);
router.get('/:tutorId/classes-sessions', [authenticateJWT, isTutor], tutorController.getTutorClassesAndSessions);
router.put("/update/:id", [ authenticateJWT, isAdmin ], tutorController.updateTutor  );
router.get(
  "/:profileId/sessionsConflict",
  [authenticateJWT, isAdmin],
  tutorController.getTutorSessionsforconflicts
);
router.get(
    "/:profileId/sessions",
    [authenticateJWT, isAdmin],
    tutorController.getTutorSessions
  );
router.put('/payment/:id',[authenticateJWT,isAdmin], tutorController.updatePaymentStatus);
router.put('/rejectPayment/:id',[authenticateJWT,isAdmin],tutorController.rejectPayment);



module.exports = router;