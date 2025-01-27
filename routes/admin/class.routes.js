const ClassController = require('../../controllers/admin/class.Controller');
const express = require('express');
const router = express.Router();
const {isAdmin,authenticateJWT} = require('../../middleware/auth');
router.post('/', [authenticateJWT,isAdmin],ClassController.createClass);


module.exports = router;