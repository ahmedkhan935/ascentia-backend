const express = require('express');
const router = express.Router();
const studentController = require('../../controllers/admin/student.Controller').studentController;
const { authenticateJWT, isAdmin } = require('../../middleware/auth');

router.post('/', [authenticateJWT, isAdmin], studentController.create);
router.get('/', [authenticateJWT, isAdmin], studentController.getAll);
router.get('/:id', [authenticateJWT, isAdmin], studentController.getById);
router.put('/:id', [authenticateJWT, isAdmin], studentController.update);
router.delete('/:id', [authenticateJWT, isAdmin], studentController.delete);

module.exports = router;