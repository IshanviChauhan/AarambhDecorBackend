const express = require("express");
const Order = require("../orders/orders.model");
const User = require("../users/user.model");
const router = express.Router();

// Get user payment history
router.get("/user-payments/:email", async (req, res) => {
  const { email } = req.params;

  if (!email) {
    return res.status(400).json({ message: "Email parameter is required" });
  }

  try {
    // Find user by email to verify user exists
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find all orders for the user to extract payment information
    const orders = await Order.find({ email: email })
      .sort({ createdAt: -1 }) // Sort by newest first
      .populate("products.productId", "name image price");

    // Transform orders into payment records
    const payments = orders.map((order, index) => {
      // Generate a mock transaction ID based on order ID and timestamp
      const transactionId = `TXN${order._id.toString().slice(-8).toUpperCase()}`;
      
      // Determine payment status based on order status
      let paymentStatus = "pending";
      if (order.status === "completed") {
        paymentStatus = "completed";
      } else if (order.status === "cancelled") {
        paymentStatus = "failed";
      } else if (order.paymentMethod === "COD" && (order.status === "shipped" || order.status === "processing")) {
        paymentStatus = "pending";
      } else if (order.paymentMethod === "UPI" && order.status !== "pending") {
        paymentStatus = "completed";
      }

      // Format payment method display name
      let methodDisplay = order.paymentMethod;
      if (order.paymentMethod === "COD") {
        methodDisplay = "Cash on Delivery";
      } else if (order.paymentMethod === "UPI") {
        methodDisplay = "UPI";
      }

      return {
        id: order._id,
        orderId: order._id.toString(),
        amount: order.amount,
        method: methodDisplay,
        status: paymentStatus,
        date: order.createdAt,
        transactionId: transactionId,
        productCount: order.products.length,
        products: order.products.map(p => ({
          name: p.productId?.name || "Product",
          quantity: p.quantity
        }))
      };
    });

    // Calculate summary statistics
    const totalPaid = payments
      .filter(payment => payment.status === 'completed')
      .reduce((total, payment) => total + payment.amount, 0);

    const totalTransactions = payments.length;
    const successfulTransactions = payments.filter(p => p.status === 'completed').length;
    const successRate = totalTransactions > 0 ? Math.round((successfulTransactions / totalTransactions) * 100) : 0;

    // Group payments by method for summary
    const methodSummary = payments.reduce((acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      payments,
      summary: {
        totalPaid: totalPaid.toFixed(2),
        totalTransactions,
        successRate,
        methodSummary
      }
    });

  } catch (error) {
    console.error("Error fetching user payments:", error);
    res.status(500).json({ message: "Failed to fetch user payments" });
  }
});

module.exports = router;
