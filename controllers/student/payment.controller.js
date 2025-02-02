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
      })
        .populate("user", "firstName lastName")
        .populate("classId", "subject type")
        .populate("classSessionId", "date startTime endTime");

      res.status(200).json(payments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createPaymentIntent: async (req, res) => {
    try {
      const { amount, paymentId } = req.body;

      // Find and verify the payment exists and is pending
      const payment = await Payment.findOne({
        _id: paymentId,
        user: req.user.id,
        status: "pending",
      });

      //set the payment intent as processing
      // Update payment status
      await Payment.findByIdAndUpdate(paymentId, {
        status: "processing",
      });
      if (!payment) {
        return res
          .status(404)
          .json({ error: "Payment not found or already processed" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        metadata: {
          userId: req.user.id,
          paymentId,
          classId: payment.classId?.toString(),
          classSessionId: payment.classSessionId?.toString(),
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  webHook: async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];
      let event;

      try {
        // console.log(req);
        // console.log(req.body);

        event = req.body;

        console.log(event);
      } catch (err) {
        console.log(err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log("Received event:", event.id);

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const { paymentId } = paymentIntent.metadata;
        console.log("PaymentIntent was successful!", paymentId);
        // Update payment status
        await Payment.findByIdAndUpdate(paymentId, {
          status: "completed",
          paymentMethod: "stripe",
          updatedAt: new Date(),
        });

        // If this is a class payment, update the class student payment status
        if (paymentIntent.metadata.classId) {
          const payment = await Payment.findById(paymentId);
          await Class.updateOne(
            {
              _id: paymentIntent.metadata.classId,
              "students.id": payment.user,
            },
            {
              $set: {
                "students.$.paymentStatus": "paid",
              },
            }
          );
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        const { paymentId } = paymentIntent.metadata;
        await Payment.findByIdAndUpdate(paymentId, {
          status: "rejected",
          paymentMethod: "stripe",
          updatedAt: new Date(),
        });
      } else if (event.type === "payment_intent.processing") {
        const paymentIntent = event.data.object;
        const { paymentId } = paymentIntent.metadata;
        await Payment.findByIdAndUpdate(paymentId, {
          status: "processing",
          paymentMethod: "stripe",
          updatedAt: new Date(),
        });
      }
      res.json({ received: true });
    } catch (error) {
      console.log(error);
    }
  },
};

module.exports = paymentController;
