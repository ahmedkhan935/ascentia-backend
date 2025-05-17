const express = require('express');
const router  = express.Router();

const roomController             = require('../../controllers/admin/room.Controller');
const RoomAvailabilityController = require('../../controllers/admin/RoomAvailability');
const { authenticateJWT, isAdmin } = require('../../middleware/auth');

/* ────────────────────────────── CREATE / UPDATE / DELETE ───────────────────────────── */
router.post('/',                  [authenticateJWT, isAdmin], roomController.AddRoom);
router.put ('/update/:id',        [authenticateJWT, isAdmin], roomController.UpdateRoom);
router.delete('/:id',             [authenticateJWT, isAdmin], roomController.DeleteRoom);

/* ─────────────────────────────── BOOKING sub-routes ────────────────────────────────── */
router.post ('/:id/booking',                     [authenticateJWT, isAdmin], roomController.AddBooking);
router.put  ('/:id/booking/:bookingId',          [authenticateJWT, isAdmin], roomController.EditBooking);
router.delete('/:id/booking/:bookingId',         [authenticateJWT, isAdmin], roomController.RemoveBooking);

/* ─────────────────────────────── ROOM-USAGE helpers ───────────────────────────────── */
router.get('/available',          [authenticateJWT, isAdmin], RoomAvailabilityController.getAvailableRooms);
router.get('/stats',              [authenticateJWT, isAdmin], RoomAvailabilityController.getRoomUsageStats);

/* ───────────────────────────── endpoints with :roomId BEFORE generic :id ───────────── */
router.get('/:roomId/availability',[authenticateJWT, isAdmin], RoomAvailabilityController.checkAvailability);
router.get('/:roomId/schedule',   [authenticateJWT, isAdmin], RoomAvailabilityController.getRoomSchedule);

/* ─────────────────────────────── READ (generic) ───────────────────────────────────── */
router.get('/',                   [authenticateJWT, isAdmin], roomController.GetAllRooms);
router.get('/:id',                [authenticateJWT, isAdmin], roomController.GetRoom);

module.exports = router;
