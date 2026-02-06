const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { listings, offers, users } = require('../data/store');

// Get all listings with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, category, sortBy, sellerId } = req.query;
        let allListings = Array.from(listings.values());

        // Filter by category
        if (category) {
            allListings = allListings.filter(l => l.category === category);
        }

        // Filter by sellerId (for "My Listings")
        if (sellerId) {
            allListings = allListings.filter(l => l.sellerId === sellerId);
        }

        // Filter out sold items if not viewing own listings (optional logic, but typically we hide sold items from marketplace)
        // For simplicity, we'll return everything and let frontend filter if needed, 
        // OR we can add a query param `excludeSold=true`.
        if (req.query.excludeSold === 'true') {
            allListings = allListings.filter(l => !l.sold);
        }

        // Calculate offer counts for each listing
        // Note: This is an O(N*M) operation where N=listings and M=offers. 
        // For a prototype in-memory store, this is fine. For production, use DB aggregation.
        const allOffers = Array.from(offers.values());
        
        allListings = allListings.map(listing => {
            const offerCount = allOffers.filter(offer => 
                offer.items && offer.items.some(item => item.id.toString() === listing.id.toString())
            ).length;
            
            // Enrich with seller info
            const seller = users.get(listing.sellerId);
            
            return {
                ...listing,
                offerCount,
                sellerName: seller ? seller.name : 'Unknown Seller',
                sellerAvatar: seller ? seller.photoURL : null
            };
        });

        // Sort
        switch (sortBy) {
            case 'price_asc':
                allListings.sort((a, b) => a.price - b.price);
                break;
            case 'price_desc':
                allListings.sort((a, b) => b.price - a.price);
                break;
            case 'newest':
            default:
                allListings.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
                break;
        }

        // Pagination
        const start = (parseInt(page) - 1) * parseInt(limit);
        const end = start + parseInt(limit);
        const paginatedListings = allListings.slice(start, end);

        res.status(200).json(paginatedListings);
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Create a new listing
router.post('/', verifyToken, (req, res) => {
    try {
        const { uid } = req.user;
        const listingData = req.body;

        const newListing = {
            id: Date.now().toString(), // Simple string ID
            sellerId: uid,
            postedAt: new Date().toISOString(),
            sold: false,
            ...listingData
        };

        listings.set(newListing.id, newListing);
        console.log('Created listing:', newListing.id);

        res.status(201).json(newListing);
    } catch (error) {
        console.error('Error creating listing:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Update a listing
router.put('/:id', verifyToken, (req, res) => {
    try {
        const { id } = req.params;
        const { uid } = req.user;
        const updates = req.body;

        const listing = listings.get(id);

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        // Authorization check: Ensure seller owns the listing
        if (listing.sellerId !== uid) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const updatedListing = {
            ...listing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        listings.set(id, updatedListing);
        res.status(200).json(updatedListing);
    } catch (error) {
        console.error('Error updating listing:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Delete a listing
router.delete('/:id', verifyToken, (req, res) => {
    try {
        const { id } = req.params;
        const { uid } = req.user;

        const listing = listings.get(id);

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        // Authorization check
        if (listing.sellerId !== uid) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        listings.delete(id);
        res.status(200).json({ message: 'Listing deleted successfully' });
    } catch (error) {
        console.error('Error deleting listing:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
