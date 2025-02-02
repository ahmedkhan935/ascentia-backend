const PaymentController = require("../controllers/student/payment.controller");

const express = require("express");
const router = express.Router();

router.use(express.json());

router.post("/webhook", PaymentController.webHook);

module.exports = router;
