const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, required: true },
      quantity: { type: Number, required: true, min: 1 },
    },
  ],
  amount: { type: Number, required: true },
  email: { type: String, required: true },
  paymentMethod: { type: String, enum: ["COD", "UPI"], required: true },
  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "completed", "cancelled"],
    default: "pending",
  },
  shippingAddress: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
  },
  paymentDetails: {
    transactionId: { type: String },
    paymentStatus: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    paymentDate: { type: Date },
    paymentGateway: { type: String }, // "paytm", "manual_upi", etc.
    failureReason: { type: String } // Store failure reason for failed payments
  }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
