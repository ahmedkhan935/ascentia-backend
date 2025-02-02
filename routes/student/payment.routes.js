const PaymentController = require("../../controllers/student/payment.controller");
const express = require("express");
const router = express.Router();

const { authenticateJWT, isStudent } = require("../../middleware/auth");

router.get(
  "/payments",
  [authenticateJWT, isStudent],
  PaymentController.getMyPayments
);
router.post(
  "/create-payment-intent",
  [authenticateJWT, isStudent],
  PaymentController.createPaymentIntent
);

module.exports = router;
