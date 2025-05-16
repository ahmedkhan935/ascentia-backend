const roomController = require('../../controllers/admin/room.Controller');
const express = require('express');
const RoomAvailabilityController = require('../../controllers/admin/RoomAvailability');
const router = express.Router();
const { authenticateJWT, isAdmin } = require('../../middleware/auth');


router.post('/', [authenticateJWT, isAdmin], roomController.AddRoom);
router.get('/', [authenticateJWT, isAdmin], roomController.GetAllRooms);
router.get('/:id', [authenticateJWT, isAdmin], roomController.GetRoom);
router.put('/update/:id', [authenticateJWT, isAdmin], roomController.UpdateRoom);
router.delete('/:id', [authenticateJWT, isAdmin], roomController.DeleteRoom);
router.post("/:id/booking", [authenticateJWT, isAdmin], roomController.AddBooking);
router.delete("/:id/booking/:bookingId", [authenticateJWT, isAdmin], roomController.RemoveBooking);
router.put("/:id/booking/:bookingId", [authenticateJWT, isAdmin], roomController.EditBooking);
router.get('/:roomId/availability',[authenticateJWT, isAdmin], RoomAvailabilityController.checkAvailability);
router.get('/available',[authenticateJWT, isAdmin], RoomAvailabilityController.getAvailableRooms);
router.get('/:roomId/schedule',[authenticateJWT, isAdmin], RoomAvailabilityController.getRoomSchedule);
router.get('/stats', [authenticateJWT, isAdmin],RoomAvailabilityController.getRoomUsageStats);


module.exports = router;