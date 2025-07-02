const mongoose = require('mongoose');

const instagramReelSchema = new mongoose.Schema({
  instagramUrl: {
    type: String,
    required: true,
    trim: true
  },
  embedId: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
instagramReelSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('InstagramReel', instagramReelSchema);
