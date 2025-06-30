// models/products.model.js
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  oldPrice: { type: Number },
  image: { type: String, required: true },
  additionalImages: [{ type: String }],
  size: { type: String },
  material: { type: String },
  rating: { type: Number, default: 0 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isTrending: { type: Boolean, default: false },
  
  // Deal related fields
  dealId: { type: mongoose.Schema.Types.ObjectId, ref: "Deal" },
  dealDiscount: { type: Number },
  dealTitle: { type: String }
}, { timestamps: true });

const Products = mongoose.model("Product", ProductSchema);

module.exports = Products;
