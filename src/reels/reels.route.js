const express = require('express');
const InstagramReel = require('./reels.model');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');

const router = express.Router();

// Get all active reels for public display (ordered by displayOrder)
router.get('/', async (req, res) => {
  try {
    const reels = await InstagramReel.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10); // Limit to 10 reels for performance
    
    res.status(200).json({
      success: true,
      data: reels
    });
  } catch (error) {
    console.error('Error fetching reels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reels'
    });
  }
});

// Get all reels for admin (including inactive ones)
router.get('/admin', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const reels = await InstagramReel.find()
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: reels
    });
  } catch (error) {
    console.error('Error fetching admin reels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reels'
    });
  }
});

// Create new reel (admin only)
router.post('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { instagramUrl, caption } = req.body;

    if (!instagramUrl || !caption) {
      return res.status(400).json({
        success: false,
        message: 'Instagram URL and caption are required'
      });
    }

    // Extract embed ID from Instagram URL
    const regex = /(?:instagram\.com\/p\/|instagram\.com\/reel\/)([a-zA-Z0-9_-]+)/;
    const match = instagramUrl.match(regex);
    
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Instagram URL format'
      });
    }

    const embedId = match[1];

    const newReel = new InstagramReel({
      instagramUrl,
      caption,
      embedId
    });

    const savedReel = await newReel.save();
    
    res.status(201).json({
      success: true,
      message: 'Instagram reel created successfully',
      data: savedReel
    });
  } catch (error) {
    console.error('Error creating reel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create reel'
    });
  }
});

// Update reel (admin only)
router.put('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { instagramUrl, caption } = req.body;

    if (!instagramUrl || !caption) {
      return res.status(400).json({
        success: false,
        message: 'Instagram URL and caption are required'
      });
    }

    // Extract embed ID from Instagram URL if URL is being updated
    const regex = /(?:instagram\.com\/p\/|instagram\.com\/reel\/)([a-zA-Z0-9_-]+)/;
    const match = instagramUrl.match(regex);
    
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Instagram URL format'
      });
    }

    const embedId = match[1];

    const updateData = {
      instagramUrl,
      caption,
      embedId
    };

    const updatedReel = await InstagramReel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedReel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reel updated successfully',
      data: updatedReel
    });
  } catch (error) {
    console.error('Error updating reel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reel'
    });
  }
});

// Delete reel (admin only)
router.delete('/:id', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedReel = await InstagramReel.findByIdAndDelete(id);

    if (!deletedReel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reel'
    });
  }
});

// Toggle reel active status (admin only)
router.patch('/:id/toggle-status', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const reel = await InstagramReel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    reel.isActive = !reel.isActive;
    await reel.save();

    res.status(200).json({
      success: true,
      message: `Reel ${reel.isActive ? 'activated' : 'deactivated'} successfully`,
      data: reel
    });
  } catch (error) {
    console.error('Error toggling reel status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle reel status'
    });
  }
});

module.exports = router;
