// routes/admin/tutor.routes.js
const express = require('express');
const router = express.Router();
const tutorController = require('../../controllers/admin/tutor.Controller');
const { authenticateJWT, isAdmin } = require('../../middleware/auth');

router.post('/', [authenticateJWT, isAdmin], tutorController.create);
router.get('/', [authenticateJWT, isAdmin], tutorController.getAll);
router.get('/:id', [authenticateJWT, isAdmin], tutorController.getById);
router.put('/:id', [authenticateJWT, isAdmin], tutorController.update);
router.delete('/:id', [authenticateJWT, isAdmin], tutorController.delete);

module.exports = router;