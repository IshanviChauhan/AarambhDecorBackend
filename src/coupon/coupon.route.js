const express = require("express");
const Coupon = require("./coupon.model");
const router = express.Router();

// Validate Coupon Code


router.post("/add", async (req, res) => {
  const { code, discountPercentage, expiryDate } = req.body;

  if (!code || !discountPercentage || !expiryDate) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const newCoupon = new Coupon({
      code,
      discountPercentage,
      expiryDate,
    });
    await newCoupon.save();
    res.status(201).json({ message: "Coupon created successfully!", coupon: newCoupon });
  } catch (err) {
    console.error("Error creating coupon:", err);
    res.status(500).json({ message: "Failed to create coupon", error: err });
  }
});



router.post('/validate', async (req, res) => {
  const { code } = req.body;

  try {
    const coupon = await Coupon.findOne({ code });
    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon code' });
    }
    res.status(200).json({ discountPercentage: coupon.discountPercentage });
  } catch (err) {
    res.status(500).json({ message: 'Error validating coupon', error: err });
  }
});


module.exports = router;
