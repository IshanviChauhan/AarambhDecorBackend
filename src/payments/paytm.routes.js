const express = require("express");
const checksum = require("paytmchecksum");
const Order = require("../orders/orders.model");
const User = require("../users/user.model");
const Cart = require("../cart/cart.model");
const paytmConfig = require("./paytm.config");
const router = express.Router();

// Generate Paytm payment transaction
router.post("/paytm/initiate", async (req, res) => {
  try {
    const { orderId, amount, customerInfo } = req.body;

    if (!orderId || !amount || !customerInfo) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: orderId, amount, customerInfo"
      });
    }

    // Generate unique transaction ID
    const txnId = `${paytmConfig.ORDER_ID_PREFIX}${orderId}_${Date.now()}`;

    // Paytm parameters
    const paytmParams = {
      MID: paytmConfig.MID,
      WEBSITE: paytmConfig.WEBSITE,
      CHANNEL_ID: paytmConfig.CHANNEL_ID,
      INDUSTRY_TYPE_ID: paytmConfig.INDUSTRY_TYPE_ID,
      ORDER_ID: txnId,
      CUST_ID: customerInfo.email,
      TXN_AMOUNT: amount.toString(),
      CALLBACK_URL: paytmConfig.CALLBACK_URL,
      EMAIL: customerInfo.email,
      MOBILE_NO: customerInfo.phone || "",
    };

    // Generate checksum
    const checksumHash = await checksum.generateSignature(
      paytmParams,
      paytmConfig.MERCHANT_KEY
    );
    
    paytmParams.CHECKSUMHASH = checksumHash;

    console.log("Paytm transaction initiated:", {
      txnId,
      amount,
      customer: customerInfo.email
    });

    res.json({
      success: true,
      message: "Transaction initiated successfully",
      data: {
        paytmParams,
        transactionUrl: paytmConfig.TRANSACTION_URL,
        txnId
      }
    });

  } catch (error) {
    console.error("Paytm initiate error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate payment",
      error: error.message
    });
  }
});

// Paytm payment callback/response handler
router.post("/paytm/callback", async (req, res) => {
  try {
    const receivedData = req.body;
    const checksumHash = receivedData.CHECKSUMHASH;
    delete receivedData.CHECKSUMHASH;

    // Verify checksum
    const isVerifySignature = checksum.verifySignature(
      receivedData,
      paytmConfig.MERCHANT_KEY,
      checksumHash
    );

    if (!isVerifySignature) {
      console.error("Checksum verification failed");
      
      // Try to extract order ID and mark as cancelled
      const { ORDERID } = receivedData;
      if (ORDERID) {
        const originalOrderId = ORDERID.replace(paytmConfig.ORDER_ID_PREFIX, "").split("_")[0];
        await cancelOrder(originalOrderId, "Checksum verification failed");
      }
      
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?reason=checksum_failed`);
    }

    const { ORDERID, TXNID, STATUS, RESPCODE, RESPMSG, TXNAMOUNT } = receivedData;

    console.log("Paytm callback received:", {
      orderId: ORDERID,
      txnId: TXNID,
      status: STATUS,
      amount: TXNAMOUNT
    });

    // Extract original order ID from transaction ID
    const originalOrderId = ORDERID.replace(paytmConfig.ORDER_ID_PREFIX, "").split("_")[0];

    if (STATUS === "TXN_SUCCESS") {
      // Update order status in database
      try {
        const order = await Order.findByIdAndUpdate(
          originalOrderId,
          {
            status: "processing",
            paymentDetails: {
              transactionId: TXNID,
              paymentMethod: "UPI",
              paymentStatus: "completed",
              amount: TXNAMOUNT,
              paymentDate: new Date(),
              paymentGateway: "paytm"
            }
          },
          { new: true }
        );

        if (order) {
          console.log("Order updated successfully:", originalOrderId);
          
          // Clear user's cart after successful payment
          try {
            const user = await User.findOne({ email: order.email });
            if (user) {
              // Clear cart directly using Cart model
              await Cart.deleteMany({ userId: user._id });
              console.log("Cart cleared successfully after payment success for user:", user._id);
            }
          } catch (cartError) {
            console.error("Error clearing cart after payment:", cartError);
            // Don't fail the payment flow if cart clearing fails
          }
          
          res.redirect(`${process.env.FRONTEND_URL}/payment-success?session_id=${originalOrderId}&txn_id=${TXNID}`);
        } else {
          console.error("Order not found:", originalOrderId);
          res.redirect(`${process.env.FRONTEND_URL}/payment-failed?reason=order_not_found`);
        }
      } catch (dbError) {
        console.error("Database update error:", dbError);
        
        // Mark order as cancelled due to database error
        await cancelOrder(originalOrderId, "Database error during payment processing");
        res.redirect(`${process.env.FRONTEND_URL}/payment-failed?reason=db_error`);
      }
    } else {
      // Payment failed - mark order as cancelled
      console.log("Payment failed:", RESPMSG);
      
      await cancelOrder(originalOrderId, RESPMSG || "Payment failed");
      res.redirect(`${process.env.FRONTEND_URL}/payment-failed?reason=${encodeURIComponent(RESPMSG)}`);
    }

  } catch (error) {
    console.error("Paytm callback error:", error);
    
    // Try to extract order ID and mark as cancelled
    try {
      const receivedData = req.body;
      const { ORDERID } = receivedData;
      if (ORDERID) {
        const originalOrderId = ORDERID.replace(paytmConfig.ORDER_ID_PREFIX, "").split("_")[0];
        await cancelOrder(originalOrderId, "Callback processing error");
      }
    } catch (cancelError) {
      console.error("Failed to cancel order after callback error:", cancelError);
    }
    
    res.redirect(`${process.env.FRONTEND_URL}/payment-failed?reason=callback_error`);
  }
});

// Check payment status
router.post("/paytm/status", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    const paytmParams = {
      MID: paytmConfig.MID,
      ORDERID: `${paytmConfig.ORDER_ID_PREFIX}${orderId}_${Date.now()}`
    };

    const checksumHash = await checksum.generateSignature(
      paytmParams,
      paytmConfig.MERCHANT_KEY
    );

    const requestBody = {
      body: {
        ...paytmParams,
        CHECKSUMHASH: checksumHash
      }
    };

    // Make API call to Paytm status API
    const https = require('https');
    const querystring = require('querystring');

    const post_data = JSON.stringify(requestBody);

    const options = {
      hostname: paytmConfig.STATUS_QUERY_URL.replace('https://', '').split('/')[0],
      port: 443,
      path: '/v3/order/status',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(post_data)
      }
    };

    const statusReq = https.request(options, (statusRes) => {
      let data = '';
      statusRes.on('data', (chunk) => {
        data += chunk;
      });

      statusRes.on('end', () => {
        try {
          const response = JSON.parse(data);
          res.json({
            success: true,
            data: response
          });
        } catch (parseError) {
          res.status(500).json({
            success: false,
            message: "Failed to parse status response"
          });
        }
      });
    });

    statusReq.on('error', (error) => {
      console.error("Status query error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check payment status"
      });
    });

    statusReq.write(post_data);
    statusReq.end();

  } catch (error) {
    console.error("Paytm status check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check payment status",
      error: error.message
    });
  }
});

// Utility function to cancel an order
const cancelOrder = async (orderId, reason) => {
  try {
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        status: "cancelled",
        paymentDetails: {
          paymentStatus: "failed",
          paymentDate: new Date(),
          failureReason: reason
        }
      },
      { new: true }
    );
    
    if (order) {
      console.log(`Order ${orderId} marked as cancelled: ${reason}`);
      return order;
    } else {
      console.error(`Order not found for cancellation: ${orderId}`);
      return null;
    }
  } catch (error) {
    console.error(`Error cancelling order ${orderId}:`, error);
    return null;
  }
};

// Route to cancel abandoned orders (orders that are pending for too long)
router.post("/cancel-abandoned-order", async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    const order = await cancelOrder(orderId, reason || "Order abandoned - payment not completed");
    
    if (order) {
      res.json({
        success: true,
        message: "Order cancelled successfully",
        order
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

  } catch (error) {
    console.error("Error cancelling abandoned order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order"
    });
  }
});

// Route to check and cleanup old pending orders
router.post("/cleanup-pending-orders", async (req, res) => {
  try {
    const timeoutMinutes = req.body.timeoutMinutes || 30; // Default 30 minutes
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    // Find orders that are pending for longer than the timeout period
    const abandonedOrders = await Order.find({
      status: "pending",
      paymentMethod: "UPI",
      createdAt: { $lt: cutoffTime }
    });

    const cancelledOrders = [];
    
    for (const order of abandonedOrders) {
      const cancelled = await cancelOrder(order._id, `Payment timeout - order abandoned after ${timeoutMinutes} minutes`);
      if (cancelled) {
        cancelledOrders.push(cancelled);
      }
    }

    res.json({
      success: true,
      message: `Cancelled ${cancelledOrders.length} abandoned orders`,
      cancelledOrders: cancelledOrders.length,
      details: cancelledOrders
    });

  } catch (error) {
    console.error("Error cleaning up pending orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup pending orders"
    });
  }
});

module.exports = router;
