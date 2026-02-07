const express = require('express');
const router = express.Router();
const Fuse = require('fuse.js');
const verifyToken = require('../middleware/auth');
const { offers, chats, messages } = require('../data/store');
const userService = require('../services/userService');
const listingService = require('../services/listingService');
const notificationService = require('../services/notificationService');

// Get all listings with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, category, sortBy, sellerId, q, minPrice, maxPrice } = req.query;
        
        // Use ListingService to fetch listings with DB filtering
        // Note: Fuse.js search is best done in memory for small datasets, 
        // or using Postgres Full Text Search for large ones.
        // For now, we'll fetch filtered results from DB and then apply Fuse if needed, 
        // OR fetch all and filter in memory if the dataset is small.
        // Given the previous implementation loaded all into memory, let's try to push filters to DB.
        
        // However, 'q' (search) is tricky with simple DB queries without Full Text Search setup.
        // Let's implement a hybrid approach:
        // 1. If 'q' is present, we might need to fetch more and filter in memory (or use ILIKE in service).
        // 2. Ideally, listingService.getAllListings should handle 'q' using Supabase textSearch if possible, 
        //    but our service currently doesn't support 'q'.
        
        // Let's fetch all matching basic filters from DB first.
        const dbFilters = {
            category,
            sellerId,
            minPrice,
            maxPrice,
            excludeSold: req.query.excludeSold === 'true',
            sortBy
        };

        // If searching, we might want to fetch more to fuzzy match.
        // For MVP/Migration, let's fetch based on filters and then search in memory if 'q' exists.
        // Warning: Pagination breaks if we filter in memory after fetching a page.
        // Correct approach: Fetch ALL matching DB filters, then Fuse search, then paginate in memory.
        // OR: Update ListingService to handle 'q' with ILIKE (simple) or TextSearch (advanced).
        
        // Let's stick to the previous behavior: Fetch "all" (or a large batch) and process.
        // But `getAllListings` in service supports pagination.
        // If we want to maintain the exact behavior of the previous code (Fuzzy search), 
        // we should probably fetch all active listings if 'q' is present.
        
        let allListings;
        if (q) {
             // If searching, ignore pagination in DB query, fetch all candidates
             allListings = await listingService.getAllListings({ ...dbFilters, page: 1, limit: 1000 });
        } else {
             // If not searching, we can use DB pagination (if we didn't need to enrich with offers first...)
             // The original code calculated offer counts for ALL listings.
             // "Calculate offer counts for each listing ... O(N*M)"
             // We should fetch the page we need.
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

        // 2-4. Filters (category, sellerId, price) are handled by DB (dbFilters)
        // But if we fetched all for 'q', we rely on DB filters to have narrowed it down somewhat,
        // or we trust the DB returned what we asked for.
        
        // 5. Exclude Sold - Handled by DB

        // Calculate offer counts
        // Note: efficiently we should do this in DB or only for the displayed items.
        // We'll do it for the current batch `allListings`.
        const allOffers = Array.from(offers.values());
        
        // Fetch sellers
        const sellerIds = [...new Set(allListings.map(l => l.sellerId))];
        const sellers = await userService.getUsersByIds(sellerIds);
        const sellersMap = new Map(sellers.map(s => [s.uid, s]));

        allListings = allListings.map(listing => {
            const offerCount = allOffers.filter(offer => 
                offer.items && offer.items.some(item => item.id.toString() === listing.id.toString())
            ).length;
            
            // Enrich with seller info
            const seller = sellersMap.get(listing.sellerId);
            
            return {
                ...listing,
                offerCount,
                sellerName: seller ? seller.name : 'Unknown Seller',
                sellerAvatar: seller ? (seller.picture || seller.photoURL) : null
            };
        });

        // Sort - Handled by DB if not searching. 
        // If searching, Fuse might have messed up sort order (it sorts by relevance).
        // If 'q' is present, we usually want relevance.
        // If 'sortBy' is present AND 'q' is present, we might want to re-sort?
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

        res.status(200).json(paginatedListings);
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

             // 2. Inject "Item Sold" message into the chat
             // Note: chats are still in-memory for now
             const chat = Array.from(chats.values()).find(c => 
                c.listingId === id && 
                c.participants.includes(listing.sellerId) && 
                c.participants.includes(updates.soldToUserId)
             );

             // 3. Update the accepted offer status to 'sold'
             // Note: offers are still in-memory for now
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
