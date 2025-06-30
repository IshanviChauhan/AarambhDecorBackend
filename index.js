const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
require("dotenv").config();

// Utility
const uploadImage = require("./utils/uploadimage");

const app = express();
const port = process.env.PORT || 4000;

// app.use(helmet());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://www.instagram.com"],
        styleSrc: [
          "'self'",
          "https://fonts.googleapis.com",
          "'unsafe-inline'" // required if you use inline styles
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://res.cloudinary.com"
        ],
        connectSrc: [
          "'self'",
          "https://aarambhdecorbackend.onrender.com"
        ],
        frameSrc: ["https://www.instagram.com"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// CORS Configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      process.env.FRONTEND_URL,
      "https://aarambhdecor.vercel.app" // Replace with your actual Vercel URL
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

// JSON and URL-encoded parsing
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Cookie Parser
app.use(cookieParser());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 5000, 
});
app.use("/api", limiter); 

// Logging
app.use(morgan("combined"));


const authRoutes = require("./src/users/user.route");
const productRoutes = require("./src/products/products.route");
const reviewRoutes = require("./src/reviews/reviews.route");
const statsRoutes = require("./src/stats/stats.route");
const cartRoutes = require("./src/cart/cart.route");
const dealRoutes = require("./src/deals/deals.route");
const couponRoutes = require("./src/coupon/coupon.route");
const orderRoutes = require("./src/orders/order.route");
const paymentRoutes = require("./src/payments/payments.route");
const paytmRoutes = require("./src/payments/paytm.routes");
const reelsRoutes = require("./src/reels/reels.route");

// =======================
// API Routes
// =======================
app.use("/api/auth", authRoutes);
app.use("/api/product", productRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/deal", dealRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/coupon", couponRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payments", paytmRoutes);
app.use("/api/reels", reelsRoutes);

// =======================
// Database Connection
// =======================
async function connectToDatabase() {
    try {
      await mongoose.connect(process.env.DB_URL, {
        maxPoolSize: 10, // Connection pooling for better performance
      });
      console.log("MongoDB connected successfully!");
    } catch (error) {
      console.error("Error connecting to MongoDB:", error.message);
      process.exit(1); // Exit process if connection fails
    }
  }
  
connectToDatabase();

// =======================
// Utility Route (Image Upload)
// =======================
app.post("/api/uploadImage", async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: "Image data is required" });
  }

  try {
    const response = await uploadImage(image);
    res.status(200).json(response);
  } catch (error) {
    console.error("Image upload failed:", error);
    res.status(500).json({ error: "Image upload failed", details: error.message });
  }
});

// =======================
// Default Route
// =======================
app.get("/", (req, res) => {
  res.send("Welcome to the server!");
});

// =======================
// Error Handling Middleware
// =======================
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(500).json({
    message: "Internal Server Error",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}), // Show stack trace only in development
  });
});

// =======================
// Start Server
// =======================
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
