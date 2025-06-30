// src/deals/deal.route.js
const express = require("express");
const Deal = require("./deals.model");
const Products = require("../products/products.model");
const uploadImage = require("./../../utils/uploadimage");
const router = express.Router();

// Get current deal with applicable products count
router.get("/", async (req, res) => {
  try {
    const deal = await Deal.findOne({ isActive: true });
    if (!deal) {
      return res.json(null);
    }

    // Check if deal has expired
    if (new Date() > new Date(deal.endDate)) {
      // Remove deal discounts from products and deactivate deal
      await removeDealFromProducts(deal._id);
      deal.isActive = false;
      await deal.save();
      
      return res.json(null);
    }

    // Count applicable products for this deal
    let applicableProducts = 0;
    if (deal.categories && deal.categories.length > 0) {
      applicableProducts = await Products.countDocuments({
        category: { $in: deal.categories }
      });
    }

    const dealWithProductCount = {
      ...deal.toObject(),
      applicableProducts
    };

    res.json(dealWithProductCount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all available categories for admin
router.get("/categories", async (req, res) => {
  try {
    const categories = await Products.distinct("category");
    res.json(categories.filter(category => category)); // Filter out null/empty categories
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/uploadImage", async (req, res) => {
  try {
    const { image } = req.body; // Expecting a base64 encoded image
    if (!image) {
      return res.status(400).json({ message: "No image provided" });
    }

    const imageUrl = await uploadImage(image); // Upload to Cloudinary
    res.status(200).json(imageUrl); // Respond with the secure URL
  } catch (error) {
    console.error("Error uploading image:", error.message);
    res.status(500).json({ message: "Failed to upload image" });
  }
});

// Apply deal discount to products in selected categories
const applyDealToProducts = async (deal) => {
  try {
    if (!deal.categories || deal.categories.length === 0 || !deal.isActive) {
      return;
    }

    // Find all products in the deal categories that don't already have this deal applied
    const products = await Products.find({
      category: { $in: deal.categories },
      $or: [
        { dealId: { $exists: false } },
        { dealId: null },
        { dealId: { $ne: deal._id } }
      ]
    });

    // Apply discount to each product
    const bulkOps = products.map(product => ({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            oldPrice: product.oldPrice || product.price, // Keep existing oldPrice or set current price as oldPrice
            price: Math.round(product.price * (1 - deal.discount / 100)), // Apply discount
            dealId: deal._id,
            dealDiscount: deal.discount,
            dealTitle: deal.title
          }
        }
      }
    }));

    if (bulkOps.length > 0) {
      await Products.bulkWrite(bulkOps);
      console.log(`Applied deal "${deal.title}" to ${bulkOps.length} products`);
    }
  } catch (error) {
    console.error("Error applying deal to products:", error);
  }
};

// Remove deal discount from products
const removeDealFromProducts = async (dealId) => {
  try {
    // Find all products with this deal applied
    const products = await Products.find({ dealId });

    // Remove discount and restore original prices
    const bulkOps = products.map(product => ({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            price: product.oldPrice || product.price, // Restore original price
          },
          $unset: {
            dealId: "",
            dealDiscount: "",
            dealTitle: ""
          }
        }
      }
    }));

    if (bulkOps.length > 0) {
      await Products.bulkWrite(bulkOps);
      console.log(`Removed deal discount from ${bulkOps.length} products`);
    }
  } catch (error) {
    console.error("Error removing deal from products:", error);
  }
};

// Update deal
router.put("/", async (req, res) => {
  try {
    const { title, description, discount, image, endDate, categories, isActive } = req.body;
    let deal = await Deal.findOne();

    if (!deal) {
      deal = new Deal();
    }

    // Store old categories to check for changes
    const oldCategories = deal.categories || [];
    const newCategories = categories || [];

    if (image) {
      const imageUrl = await uploadImage(image);
      deal.imageUrl = imageUrl;
    }

    // Always remove existing deals from products first when updating
    // This ensures clean state before applying new deal settings
    await removeDealFromProducts(deal._id);

    deal.title = title;
    deal.description = description;
    deal.discount = discount;
    deal.endDate = new Date(endDate);
    deal.categories = newCategories;
    deal.isActive = isActive !== undefined ? isActive : true;

    await deal.save();

    // Include applicable products count in response
    let applicableProducts = 0;
    if (deal.categories && deal.categories.length > 0) {
      applicableProducts = await Products.countDocuments({
        category: { $in: deal.categories }
      });
    }

    const dealWithProductCount = {
      ...deal.toObject(),
      applicableProducts
    };

    // Apply deal to products based on new settings if active
    if (deal.isActive && deal.categories.length > 0) {
      await applyDealToProducts(deal);
    }

    res.json(dealWithProductCount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Manual endpoint to apply current deal to products (for admin use)
router.post("/apply-to-products", async (req, res) => {
  try {
    const deal = await Deal.findOne({ isActive: true });
    if (!deal) {
      return res.status(404).json({ message: "No active deal found" });
    }

    await applyDealToProducts(deal);
    
    // Count affected products
    const applicableProducts = await Products.countDocuments({
      category: { $in: deal.categories }
    });

    res.json({ 
      message: "Deal applied to products successfully",
      affectedProducts: applicableProducts,
      dealTitle: deal.title,
      categories: deal.categories
    });
  } catch (error) {
    console.error("Error applying deal:", error);
    res.status(500).json({ message: error.message });
  }
});

// Manual endpoint to remove deal from all products (for admin use)
router.post("/remove-from-products", async (req, res) => {
  try {
    const deal = await Deal.findOne();
    if (!deal) {
      return res.status(404).json({ message: "No deal found" });
    }

    await removeDealFromProducts(deal._id);
    
    res.json({ 
      message: "Deal removed from all products successfully",
      dealTitle: deal.title
    });
  } catch (error) {
    console.error("Error removing deal:", error);
    res.status(500).json({ message: error.message });
  }
});

// Cleanup expired deals function
const cleanupExpiredDeals = async () => {
  try {
    const now = new Date();
    const expiredDeals = await Deal.find({
      endDate: { $lt: now },
      isActive: true
    });

    for (const deal of expiredDeals) {
      // Remove deal discounts from products
      await removeDealFromProducts(deal._id);
      
      // Deactivate the deal
      deal.isActive = false;
      await deal.save();
      
      console.log(`Deactivated expired deal: ${deal.title}`);
    }
  } catch (error) {
    console.error("Error cleaning up expired deals:", error);
  }
};

// Run cleanup on server start and then every hour
cleanupExpiredDeals();
setInterval(cleanupExpiredDeals, 60 * 60 * 1000); // Run every hour

module.exports = router;
