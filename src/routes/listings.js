const express = require('express');
const router = express.Router();
const Fuse = require('fuse.js');
const verifyToken = require('../middleware/auth');
const { listings, offers, users, chats, messages } = require('../data/store');
const notificationService = require('../services/notificationService');

// Get all listings with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, category, sortBy, sellerId, q, minPrice, maxPrice } = req.query;
        let allListings = Array.from(listings.values());

        // 1. Search (Fuzzy)
        if (q) {
            const fuse = new Fuse(allListings, {
                keys: ['title', 'description', 'brand', 'category'],
                threshold: 0.4, // 0.0 is perfect match, 1.0 is match anything
                distance: 100,
                includeScore: true
            });
            
            const result = fuse.search(q);
            allListings = result.map(r => r.item);
        }

        // 2. Filter by category
        if (category) {
            allListings = allListings.filter(l => l.category === category);
        }

        // 3. Filter by sellerId (for "My Listings")
        if (sellerId) {
            allListings = allListings.filter(l => l.sellerId === sellerId);
        }

        // 4. Filter by Price Range
        if (minPrice) {
            allListings = allListings.filter(l => l.price >= Number(minPrice));
        }
        if (maxPrice) {
            allListings = allListings.filter(l => l.price <= Number(maxPrice));
        }

        // 5. Filter out sold items if not viewing own listings
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

        // Default expiry: 5 minutes for testing (usually 30 days)
        // const EXPIRY_DURATION_MS = 5 * 60 * 1000; 
        const EXPIRY_DURATION_MS = 1 * 24 * 60 * 60 * 1000; // 1 days

        const newListing = {
            id: Date.now().toString(), // Simple string ID
            sellerId: uid,
            postedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + EXPIRY_DURATION_MS).toISOString(),
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

// Get a single listing by ID
router.get('/:id', verifyToken, (req, res) => {
    try {
        const { id } = req.params;
        const listing = listings.get(id);

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        res.status(200).json(listing);
    } catch (error) {
        console.error('Error fetching listing:', error);
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

        // Check if item is being marked as sold and notify buyer
        if (updates.sold === true && !listing.sold && updates.soldToUserId) {
             // 1. Send Push Notification
             notificationService.sendItemSoldNotification(updates.soldToUserId, updatedListing)
                .catch(err => console.error('Error sending sold notification:', err));

             // 2. Inject "Item Sold" message into the chat
             const chat = Array.from(chats.values()).find(c => 
                c.listingId === id && 
                c.participants.includes(listing.sellerId) && 
                c.participants.includes(updates.soldToUserId)
             );

             // 3. Update the accepted offer status to 'sold'
             const acceptedOffer = Array.from(offers.values()).find(o => 
                o.listingId === id && 
                o.buyerId === updates.soldToUserId &&
                o.status === 'accepted'
             );

             if (acceptedOffer) {
                 acceptedOffer.status = 'sold';
                 offers.set(acceptedOffer.id, acceptedOffer);
                 console.log(`Updated offer ${acceptedOffer.id} status to sold`);
             }

             if (chat) {
                const newMessage = {
                    _id: Date.now().toString(),
                    chatId: chat._id,
                    text: '🎉 Item marked as sold',
                    image: null,
                    type: 'item_sold',
                    schedule: null,
                    createdAt: new Date().toISOString(),
                    user: {
                        _id: listing.sellerId, // System message attributed to seller
                        name: 'System',
                        avatar: null
                    }
                };

                messages.set(newMessage._id, newMessage);

                chat.lastMessage = {
                    text: '🎉 Item Sold',
                    createdAt: newMessage.createdAt
                };
                chat.updatedAt = newMessage.createdAt;
                chats.set(chat._id, chat);
             }
        }

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

// Manually expire a listing (Test Only)
router.patch('/:id/expire', verifyToken, (req, res) => {
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

        // Set expiresAt to 1 second ago so the background job picks it up
        listing.expiresAt = new Date(Date.now() - 1000).toISOString();
        listings.set(id, listing);

        res.status(200).json({ message: 'Listing expired successfully. Cleanup job will remove it shortly.', listing });
    } catch (error) {
        console.error('Error expiring listing:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
