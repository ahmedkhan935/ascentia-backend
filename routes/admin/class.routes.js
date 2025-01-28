const ClassController = require('../../controllers/admin/class.Controller');
const express = require('express');
const router = express.Router();
const {isAdmin,authenticateJWT} = require('../../middleware/auth');
router.post('/', [authenticateJWT,isAdmin],ClassController.createClass);
router.get('/sessions', [authenticateJWT,isAdmin],ClassController.getAllSessions);
router.put('/assign-room', [authenticateJWT,isAdmin],ClassController.assignRoomToSession);
router.put('/unassign-room',[authenticateJWT,isAdmin],ClassController.unassignRoomFromSession);


module.exports = router;