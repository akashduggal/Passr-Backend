const express = require('express');
const router = express.Router();
const wishlistService = require('../services/wishlistService');
const verifyToken = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(verifyToken);

// Get user's wishlist
router.get('/', async (req, res) => {
  try {
    const wishlist = await wishlistService.getWishlist(req.user.uid);
    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add to wishlist
router.post('/', async (req, res) => {
  try {
    const { listingId } = req.body;
    if (!listingId) {
      return res.status(400).json({ message: 'listingId is required' });
    }
    const result = await wishlistService.addToWishlist(req.user.uid, listingId);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove from wishlist
router.delete('/:listingId', async (req, res) => {
  try {
    const { listingId } = req.params;
    await wishlistService.removeFromWishlist(req.user.uid, listingId);
    res.status(200).json({ message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check status
router.get('/check/:listingId', async (req, res) => {
  try {
    const { listingId } = req.params;
    const isInWishlist = await wishlistService.checkWishlistStatus(req.user.uid, listingId);
    res.json({ isInWishlist });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
