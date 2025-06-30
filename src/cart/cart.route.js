
const express = require('express');
const mongoose = require('mongoose');

const Cart = require('./cart.model');
const router = express.Router();


const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Add item to cart
router.post('/add', asyncHandler(async (req, res) => {
  const { productId, name, image, price, quantity, userId } = req.body;

  if (!productId || !name || !image || !price || !quantity || !userId) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "Invalid productId or userId" });
  }

  const parsedPrice = Number(price);
  const parsedQuantity = Number(quantity);

  if (isNaN(parsedPrice) || isNaN(parsedQuantity)) {
    return res.status(400).json({ message: "Price and quantity must be numbers" });
  }

  const cartItem = await Cart.findOneAndUpdate(
    { productId, userId },
    { 
      $inc: { quantity: parsedQuantity }, 
      $setOnInsert: { name, image, price: parsedPrice } 
    },
    { new: true, upsert: true }
  );
  res.status(200).json(cartItem);
}));
// Update quantity
router.put('/update/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid cart item ID' });
  }

  const cartItem = await Cart.findById(id);
  if (!cartItem) return res.status(404).json({ message: 'Item not found' });

  if (type === 'increment') {
    cartItem.quantity += 1;
  } else if (type === 'decrement' && cartItem.quantity > 1) {
    cartItem.quantity -= 1;
  } else {
    return res.status(400).json({ message: 'Invalid update type' });
  }

  await cartItem.save();
  res.status(200).json(cartItem);
}));

// Remove item from cart
router.delete('/remove/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Cart.findByIdAndDelete(id);
    res.status(200).json({ message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Clear cart
router.delete('/clear/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await Cart.deleteMany({ userId });
    res.status(200).json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all cart items for a user
// routes/cart.js
// Get all cart items for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId before querying MongoDB
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid or missing userId" });
    }

    const cartItems = await Cart.find({ userId }).populate('productId', 'image');

    // Ensure that the image is correctly fetched
    const cartItemsWithImage = cartItems.map(item => ({
      ...item.toObject(),
      image: item.productId?.image || item.image,
    }));

    res.status(200).json(cartItemsWithImage);
  } catch (error) {
    console.error("Error fetching cart items:", error);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;
