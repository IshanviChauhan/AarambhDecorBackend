const express = require("express");
const Products = require("./products.model");
const Reviews = require("../reviews/reviews.model");
const router = express.Router();
const mongoose = require("mongoose");

const redis = require("redis");
const client = redis.createClient();



client.on('connect', () => {
  console.log('Redis client connected');
});

client.on('error', (err) => {
  console.error('Redis client error:', err);
})


const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }
  next();
};

// Create a new product
router.post("/create-product", async (req, res) => {
  try {
    const { author } = req.body;

    if (!mongoose.Types.ObjectId.isValid(author)) {
      return res.status(400).json({ message: "Invalid author ID" });
    }

    const newProduct = new Products(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Failed to create product", error: error.message });
  }
});

// Search products by name or description
router.get("/search", async (req, res) => {
  const { query } = req.query;

  try {
    const regex = new RegExp(query, "i");
    const products = await Products.find({
      $or: [{ name: { $regex: regex } }, { description: { $regex: regex } }],
    }).lean(); // Use .lean() for faster queries

    res.status(200).json(products);
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({ message: "Error searching products" });
  }
});

// Fetch all products with filters and pagination
router.get("/", async (req, res) => {
  try {
    const {
      category,
      color,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      applyDeals = false // New parameter to apply deals
    } = req.query;

    const filter = {};

    // 1. Gender filter
    // if (gender) {
    //   const validGenders = ["male", "female"];
    //   if (!validGenders.includes(gender.toLowerCase())) {
    //     return res.status(400).json({
    //       message: "Invalid gender. Use 'male' or 'female'.",
    //     });
    //   }
    //   filter.gender = gender.toLowerCase();
    // }

    // 2. Category filter
    if (category) {
      filter.category = category;
    }

    // 3. Color filter
    // if (color) {
    //   filter["colors.value"] = color;
    // }

    // 4. Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const sortDirection = sortOrder.toLowerCase() === "asc" ? 1 : -1;
    const sortObj = { [sortBy]: sortDirection };

    let [products, totalProducts] = await Promise.all([
      Products.find(filter).sort(sortObj).skip(skip).limit(limitNum).lean(), // Use .lean() for faster queries
      Products.countDocuments(filter),
    ]);

    // Apply deals if requested
    if (applyDeals === 'true') {
      const Deal = require("../deals/deals.model");
      const activeDeal = await Deal.findOne({ isActive: true });
      
      if (activeDeal && activeDeal.categories && activeDeal.categories.length > 0 && new Date() <= new Date(activeDeal.endDate)) {
        products = products.map(product => {
          if (activeDeal.categories.includes(product.category)) {
            return {
              ...product,
              originalPrice: product.price,
              price: Math.round(product.price * (1 - activeDeal.discount / 100)),
              dealDiscount: activeDeal.discount,
              dealTitle: activeDeal.title,
              hasActiveDeal: true
            };
          }
          return product;
        });
      }
    }

    res.status(200).json({
      products,
      totalProducts,
      totalPages: Math.ceil(totalProducts / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Error fetching products" });
  }
});

// Fetch trending products
router.get("/trending", async (req, res) => {
  try {
    const cacheKey = "trending-products";

    if (!client.isOpen) {
      await client.connect();
    }

    const cachedData = await client.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    const trendingProducts = await Products.find({ isTrending: true }).lean();
    await client.setEx(cacheKey, 3600, JSON.stringify(trendingProducts)); // Cache for 1 hour

    res.status(200).json(trendingProducts);
  } catch (error) {
    console.error("Error fetching trending products:", error);
    res.status(500).json({ message: "Error fetching trending products" });
  }
});

// Fetch a single product by ID
router.get("/:id", validateObjectId, async (req, res) => {
  try {
    const productId = req.params.id;

    const [product, reviews] = await Promise.all([
      Products.findById(productId).populate("author", "email username").lean(),
      Reviews.find({ productId }).populate("userId", "username email").lean(),
    ]);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ product, reviews });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// Update a product by ID
router.patch("/update-product/:id", validateObjectId, async (req, res) => {
  try {
    const productId = req.params.id;

    const updatedProduct = await Products.findByIdAndUpdate(
      productId,
      { ...req.body },
      { new: true }
    ).lean();

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Failed to update product" });
  }
});

// Delete a product by ID
router.delete("/:id", validateObjectId, async (req, res) => {
  try {
    const productId = req.params.id;

    const [deletedProduct] = await Promise.all([
      Products.findByIdAndDelete(productId),
      Reviews.deleteMany({ productId }),
    ]);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product and associated reviews deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// Fetch related products
router.get("/related/:id", validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Products.findById(id).lean();

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const titleRegex = new RegExp(
      product.name.split(" ").filter((word) => word.length > 1).join("|"),
      "i"
    );

    const relatedProducts = await Products.find({
      _id: { $ne: id },
      $or: [{ name: { $regex: titleRegex } }, { category: product.category }],
    }).lean();

    res.status(200).json(relatedProducts);
  } catch (error) {
    console.error("Error fetching related products:", error);
    res.status(500).json({ message: "Failed to fetch related products" });
  }
});

// Get products with deal discounts applied
router.get("/deals/applicable", async (req, res) => {
  try {
    const Deal = require("../deals/deals.model");
    
    // Get active deal
    const activeDeal = await Deal.findOne({ isActive: true });
    
    if (!activeDeal || !activeDeal.categories || activeDeal.categories.length === 0) {
      return res.json({ products: [], deal: null });
    }

    // Check if deal is still valid (not expired)
    if (new Date() > new Date(activeDeal.endDate)) {
      return res.json({ products: [], deal: null });
    }

    // Get products in the deal categories
    const applicableProducts = await Products.find({
      category: { $in: activeDeal.categories }
    }).lean();

    // Apply discount to products
    const productsWithDiscount = applicableProducts.map(product => ({
      ...product,
      originalPrice: product.price,
      price: Math.round(product.price * (1 - activeDeal.discount / 100)),
      dealDiscount: activeDeal.discount,
      dealTitle: activeDeal.title
    }));

    res.status(200).json({
      products: productsWithDiscount,
      deal: activeDeal,
      totalProducts: productsWithDiscount.length
    });
  } catch (error) {
    console.error("Error fetching products with deals:", error);
    res.status(500).json({ message: "Error fetching products with deals" });
  }
});

module.exports = router;