const User = require("../../models/User");
const Payment = require("../../models/Payment");
const Class = require("../../models/Class");
const ClassSession = require("../../models/ClassSession");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const paymentController = {
  getMyPayments: async (req, res) => {
    try {
      const studentId = req.user.id;

      const payments = await Payment.find({
        user: studentId,
      }).populate("user", "firstName lastName");
      res.status(200).json(payments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  createPaymentIntent: async (req, res) => {
    try {
      const { amount } = req.body;

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        metadata: { userId: req.user.id },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  webHook: async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      await Payment.findOneAndUpdate(
        { _id: paymentIntent.metadata.paymentId },
        { status: "completed" }
      );
    }

    res.json({ received: true });
  },
};

module.exports = paymentController;
