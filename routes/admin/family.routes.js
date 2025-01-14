const express = require('express');
const router = express.Router();
const familyController = require('../../controllers/admin/family.Controller');
const { authenticateJWT, isAdmin } = require('../../middleware/auth');

router.post('/', [authenticateJWT, isAdmin], familyController.create);
router.get('/', [authenticateJWT, isAdmin], familyController.getAll);
router.get('/:id', [authenticateJWT, isAdmin], familyController.getById);
router.put('/:id', [authenticateJWT, isAdmin], familyController.update);
router.delete('/:id', [authenticateJWT, isAdmin], familyController.delete);
router.post('/:id/students', [authenticateJWT, isAdmin], familyController.addStudent);
router.delete('/:familyId/students/:studentId', [authenticateJWT, isAdmin], familyController.removeStudent);

module.exports = router;