const mongoose = require("mongoose");

const DealSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  discount: { type: Number, required: true },
  imageUrl: { type: String },
  endDate: { type: Date, required: true },
  categories: [{ type: String }], // Array of category names that this deal applies to
  isActive: { type: Boolean, default: true } // To enable/disable deals
});

module.exports = mongoose.model("Deal", DealSchema);
