const express = require('express');
const router = express.Router();
const Fuse = require('fuse.js');
const verifyToken = require('../middleware/auth');
const userService = require('../services/userService');
const listingService = require('../services/listingService');
const notificationService = require('../services/notificationService');
const offerService = require('../services/offerService');
const chatService = require('../services/chatService');

// Get all listings with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, category, sortBy, sellerId, q, minPrice, maxPrice } = req.query;
        
        // Use ListingService to fetch listings with DB filtering
        
        // Let's fetch all matching basic filters from DB first.
        const dbFilters = {
            category,
            sellerId,
            minPrice,
            maxPrice,
            excludeSold: req.query.excludeSold === 'true',
            sortBy
        };

        let allListings;
        if (q) {
             // If searching, ignore pagination in DB query, fetch all candidates
             allListings = await listingService.getAllListings({ ...dbFilters, page: 1, limit: 1000 });
        } else {
             // If not searching, we can use DB pagination
             allListings = await listingService.getAllListings({ ...dbFilters, page, limit });
        }

        // 1. Search (Fuzzy) - Only if q is provided
        if (q) {
            const fuse = new Fuse(allListings, {
                keys: ['title', 'description', 'brand', 'category'],
                threshold: 0.4,
                distance: 100,
                includeScore: true
            });
            
            const result = fuse.search(q);
            allListings = result.map(r => r.item);
        }

        // Sort - Handled by DB if not searching. 
        if (q && sortBy) {
             switch (sortBy) {
                case 'price_asc':
                    allListings.sort((a, b) => a.price - b.price);
                    break;
                case 'price_desc':
                    allListings.sort((a, b) => b.price - a.price);
                    break;
                case 'newest':
                    allListings.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
                    break;
            }
        }

        // Pagination (In Memory if 'q' was used, otherwise DB already did it)
        let paginatedListings = allListings;
        if (q) {
            const start = (parseInt(page) - 1) * parseInt(limit);
            const end = start + parseInt(limit);
            paginatedListings = allListings.slice(start, end);
        }

        // Enrich with seller info and offer counts
        // Optimize: Fetch all unique sellers in one go
        const sellerIds = [...new Set(paginatedListings.map(l => l.sellerId))];
        const sellers = await userService.getUsersByIds(sellerIds);
        const sellersMap = new Map(sellers.map(s => [s.uid, s]));

        // Enrich in parallel
        const enrichedListings = await Promise.all(paginatedListings.map(async (listing) => {
            const offerCount = await offerService.getOfferCountForListing(listing.id);
            const seller = sellersMap.get(listing.sellerId);
            
            return {
                ...listing,
                offerCount,
                sellerName: seller ? seller.name : 'Unknown Seller',
                sellerAvatar: seller ? (seller.picture || seller.photoURL) : null
            };
        }));

        res.status(200).json(enrichedListings);
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Create a new listing
router.post('/', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;
        const listingData = req.body;

        // Default expiry: 1 day
        const EXPIRY_DURATION_MS = 1 * 24 * 60 * 60 * 1000; 

        const newListingData = {
            sellerId: uid,
            postedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + EXPIRY_DURATION_MS).toISOString(),
            sold: false,
            status: 'active',
            ...listingData
        };

        const createdListing = await listingService.createListing(newListingData);
        console.log('Created listing:', createdListing.id);

        res.status(201).json(createdListing);
    } catch (error) {
        console.error('Error creating listing:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Get a single listing by ID
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await listingService.getListingById(id);

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
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { uid } = req.user;
        const updates = req.body;

        const listing = await listingService.getListingById(id);

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        // Authorization check: Ensure seller owns the listing
        if (listing.sellerId !== uid) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Perform update
        const updatedListing = await listingService.updateListing(id, updates);

        // Check if item is being marked as sold and notify buyer
        if (updates.sold === true && !listing.sold && updates.soldToUserId) {
             // 1. Send Push Notification
             notificationService.sendItemSoldNotification(updates.soldToUserId, updatedListing)
                .catch(err => console.error('Error sending sold notification:', err));

             // 2. Update the accepted offer status to 'sold'
             // Find offers for this listing
             const listingOffers = await offerService.getOffersByListingId(id);
             
             // Handle the winner
             const acceptedOffer = listingOffers.find(o => 
                o.buyerId === updates.soldToUserId &&
                o.status === 'accepted'
             );

             if (acceptedOffer) {
                 await offerService.updateOffer(acceptedOffer.id, { status: 'sold' });
                 console.log(`Updated offer ${acceptedOffer.id} status to sold`);
             }

             // Handle the losers (UX Improvement)
             const losingOffers = listingOffers.filter(o => 
                o.buyerId !== updates.soldToUserId && 
                (o.status === 'pending' || o.status === 'accepted')
             );

             for (const offer of losingOffers) {
                 // Update status to rejected
                 await offerService.updateOffer(offer.id, { status: 'rejected' });
                 
                 // Notify buyer
                 notificationService.sendItemSoldToOtherNotification(offer.buyerId, listing)
                    .catch(err => console.error(`Error notifying loser ${offer.buyerId}:`, err));
             }

             // 3. Inject "Item Sold" message into the chat
             // Create or get chat to ensure message delivery
             const chat = await chatService.createChat(id, [listing.sellerId, updates.soldToUserId]);

             if (chat) {
                await chatService.sendMessage({
                    chatId: chat.id,
                    senderId: listing.sellerId, // System message attributed to seller
                    content: '🎉 Item marked as sold',
                    type: 'item_sold'
                });
             }
        }

        res.status(200).json(updatedListing);
    } catch (error) {
        console.error('Error updating listing:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Delete a listing
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { uid } = req.user;

        const listing = await listingService.getListingById(id);

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        // Authorization check
        if (listing.sellerId !== uid) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        await listingService.deleteListing(id);
        res.status(200).json({ message: 'Listing deleted successfully' });
    } catch (error) {
        console.error('Error deleting listing:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Manually expire a listing (Test Only)
router.patch('/:id/expire', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { uid } = req.user;

        const listing = await listingService.getListingById(id);

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        // Authorization check
        if (listing.sellerId !== uid) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Set expiresAt to 1 second ago so the background job picks it up
        const expiredListing = await listingService.updateListing(id, {
            expiresAt: new Date(Date.now() - 1000).toISOString()
        });

        res.status(200).json({ message: 'Listing expired successfully. Cleanup job will remove it shortly.', listing: expiredListing });
    } catch (error) {
        console.error('Error expiring listing:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
