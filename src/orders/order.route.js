// orders.routes.js

const express = require("express");
const mongoose = require("mongoose");
const Order = require("./orders.model");
const router = express.Router();

// Create Order
router.post("/create-order", async (req, res) => {
  const { products, amount, email, paymentMethod, shippingAddress } = req.body;

  if (!products || !amount || !email || !paymentMethod || !shippingAddress) {
    return res.status(400).json({ success: false, message: "All fields including shipping address are required" });
  }

  // Validate shipping address fields
  if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
    return res.status(400).json({ success: false, message: "Complete shipping address is required" });
  }

  try {
    const newOrder = new Order({
      products,
      amount,
      email,
      paymentMethod,
      shippingAddress,
      status: paymentMethod === "COD" ? "pending" : "pending", // Keep as pending until payment confirmation
      paymentDetails: {
        paymentStatus: paymentMethod === "COD" ? "pending" : "pending",
        paymentGateway: paymentMethod === "UPI" ? "paytm" : "manual"
      }
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: newOrder,
      sessionId: paymentMethod === "UPI" ? newOrder._id : null,
    });
  } catch (error) {
    console.error("Error creating order:", error.message); // Log specific error
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
});


// Update Order Status
const validStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];

router.patch("/update-order-status/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid or missing status" });
  }

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { status, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});



// Get Orders by Email
router.get("/:email", async (req, res) => {
  const email = req.params.email;

  if (!email) {
    return res.status(400).json({ message: "Email parameter is required" });
  }

  try {
    const orders = await Order.find({ email }).sort({ createdAt: -1 });

    res.status(200).json(orders || []);
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});



// Get Order by ID
router.get("/order/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid order ID" });
  }

  try {
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching order:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});



// Get All Orders (Admin) - Enhanced for real-time updates
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 }) // Most recent first
      .lean(); // Use lean() for better performance
    
    if (orders.length === 0) {
      console.log("No orders found");
      return res.status(200).json({ 
        message: "No orders found", 
        orders: [],
        count: 0,
        lastUpdated: new Date().toISOString()
      });
    }

    // Add computed fields for better frontend experience
    const enhancedOrders = orders.map(order => ({
      ...order,
      itemCount: order.products ? order.products.length : 0,
      formattedAmount: Number(order.amount).toFixed(2),
      timeSinceCreated: Math.floor((Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60)), // hours
    }));

    res.status(200).json({
      success: true,
      orders: enhancedOrders,
      count: enhancedOrders.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});







// Delete Order
router.delete("/delete-order/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order deleted successfully",
      order: deletedOrder,
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
