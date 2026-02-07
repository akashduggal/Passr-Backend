const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { chats, messages } = require('../data/store');
const userService = require('../services/userService');
const listingService = require('../services/listingService');
const notificationService = require('../services/notificationService');
const offerService = require('../services/offerService');

// Create a new offer
router.post('/', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;
        const offerData = req.body;
        
        // Validate required fields
        if (!offerData.items || !offerData.totalOfferAmount) {
            return res.status(400).json({ error: 'Items and offer amount are required' });
        }

        // Validate sellerId is NOT the same as buyerId
        // Assuming sellerId is passed in body, or we derive it from first item
        // The original code assumed newOffer.sellerId was set. 
        // Let's check where sellerId comes from.
        // Usually offerData contains sellerId.
        if (offerData.sellerId && offerData.sellerId === uid) {
             return res.status(400).json({ error: 'You cannot make an offer on your own listing' });
        }

        // Create offer object payload
        const offerPayload = {
            buyerId: uid,
            status: 'pending',
            items: offerData.items,
            totalOfferAmount: offerData.totalOfferAmount,
            message: offerData.message,
            sellerId: offerData.sellerId // Ensure this is passed or derived
        };

        // If sellerId is missing, try to derive from first listing (legacy support/safety)
        if (!offerPayload.sellerId && offerData.items.length > 0) {
            const firstListingId = offerData.items[0].id;
            const listing = await listingService.getListingById(firstListingId);
            if (listing) {
                offerPayload.sellerId = listing.sellerId;
            }
        }

        if (!offerPayload.sellerId) {
            return res.status(400).json({ error: 'Could not determine seller' });
        }
        
        if (offerPayload.sellerId === uid) {
             return res.status(400).json({ error: 'You cannot make an offer on your own listing' });
        }

        // Create offer in DB
        const newOffer = await offerService.createOffer(offerPayload);

        // Enhance with buyer details (simulated join)
        const buyer = await userService.getUserById(uid);
        if (buyer) {
            newOffer.buyerName = buyer.name || 'ASU Student';
        }

        // Create initial chat message for the offer
        if (offerData.items.length > 0) {
            const firstListingId = offerData.items[0].id.toString();
            // We already fetched listing above if needed, but let's be safe
            const firstListing = await listingService.getListingById(firstListingId);
            
            if (firstListing) {
                const sellerId = firstListing.sellerId;
                
                // Create or find chat
                let chat = Array.from(chats.values()).find(c => 
                    c.listingId === firstListingId && 
                    c.participants.includes(uid) && 
                    c.participants.includes(sellerId)
                );

                if (!chat) {
                    chat = {
                        _id: Date.now().toString(),
                        participants: [uid, sellerId],
                        listingId: firstListingId,
                        offerId: newOffer.id,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        lastMessage: null
                    };
                    chats.set(chat._id, chat);
                }

                // Construct the initial message text
                let text = '';
                const isBundle = offerData.items.length > 1;
                if (isBundle) {
                    const itemList = offerData.items.map(item => `• ${item.title || 'Item'} ($${item.price})`).join('\n');
                    text = `Hi! I'm interested in purchasing a bundle of the following items from your listings:\n\n${itemList}\n\nI'd like to offer a total of $${offerData.totalOfferAmount.toFixed(0)} for this bundle.`;
                } else {
                    const item = offerData.items[0];
                    text = `Hi! I'm interested in your ${item.title || 'item'}. I'd like to make an offer of $${offerData.totalOfferAmount.toFixed(0)}.`;
                }

                if (offerData.message && offerData.message.trim()) {
                    text += `\n\n${offerData.message.trim()}`;
                }

                // Create the message
                const newMessage = {
                    _id: Date.now().toString(),
                    chatId: chat._id,
                    text: text,
                    image: null,
                    type: 'offer',
                    createdAt: new Date().toISOString(),
                    user: {
                        _id: uid,
                        name: buyer ? buyer.name : 'Buyer',
                        avatar: buyer ? (buyer.picture || buyer.photoURL) : null
                    }
                };

                messages.set(newMessage._id, newMessage);

                // Update chat last message
                chat.lastMessage = {
                    text: text.substring(0, 50) + '...',
                    createdAt: newMessage.createdAt
                };
                chat.updatedAt = newMessage.createdAt;
                chats.set(chat._id, chat);

                // --- SEND PUSH NOTIFICATION TO SELLER ---
                const buyerName = newOffer.buyerName || 'Someone';
                const itemName = isBundle ? 'your bundle' : (offerData.items[0].title || 'your item');
                
                notificationService.sendOfferNotification(
                    sellerId,
                    buyerName,
                    offerData.totalOfferAmount,
                    itemName,
                    firstListing,
                    newOffer.id
                );
            }
        }

        res.status(201).json(newOffer);
    } catch (error) {
        console.error('Create offer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get offers for a specific user (as buyer)
router.get('/my-offers', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;
        
        // Filter offers where user is the buyer
        const myOffers = await offerService.getOffersByBuyerId(uid);

        // Enhance offers with seller name and listing details if possible
        const enhancedOffers = await Promise.all(myOffers.map(async (offer) => {
            // Find first item's listing to get seller info
            if (offer.items && offer.items.length > 0) {
                try {
                    const firstListing = await listingService.getListingById(offer.items[0].id.toString());
                    if (firstListing) {
                        const seller = await userService.getUserById(firstListing.sellerId);
                        return {
                            ...offer,
                            sellerId: firstListing.sellerId,
                            sellerName: seller ? seller.name : 'Unknown Seller'
                        };
                    }
                } catch (e) {
                    console.error('Error fetching listing details for offer:', e);
                }
            }
            return { ...offer, sellerName: 'Unknown Seller', sellerId: offer.sellerId || null };
        }));

        res.json(enhancedOffers);
    } catch (error) {
        console.error('Get my offers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single offer by ID
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await offerService.getOfferById(id);
        
        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        // Enrich with seller info if missing
        let enrichedOffer = { ...offer };
        if (offer.items && offer.items.length > 0) {
            try {
                const firstListing = await listingService.getListingById(offer.items[0].id.toString());
                if (firstListing) {
                    const seller = await userService.getUserById(firstListing.sellerId);
                    enrichedOffer.sellerId = firstListing.sellerId;
                    enrichedOffer.sellerName = seller ? seller.name : 'Unknown Seller';
                }
            } catch (e) {
                console.error('Error fetching listing details:', e);
            }
        }
        
        // Ensure buyer info is present
        if (!enrichedOffer.buyerName && enrichedOffer.buyerId) {
             const buyer = await userService.getUserById(enrichedOffer.buyerId);
             enrichedOffer.buyerName = buyer ? buyer.name : 'Buyer';
        }

        res.json(enrichedOffer);
    } catch (error) {
        console.error('Get offer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get offers received for a specific listing (as seller)
router.get('/listing/:listingId', verifyToken, async (req, res) => {
    try {
        const { listingId } = req.params;
        const { uid } = req.user;

        // Verify the user owns this listing
        const listing = await listingService.getListingById(listingId);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        if (listing.sellerId !== uid) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Find offers that include this listing
        const receivedOffers = await offerService.getOffersByListingId(listingId);

        // Enhance with dynamic buyer details
        const enhancedOffers = await Promise.all(receivedOffers.map(async (offer) => {
            const buyer = await userService.getUserById(offer.buyerId);
            return {
                ...offer,
                buyerName: buyer ? buyer.name : (offer.buyerName || 'Buyer')
            };
        }));

        res.json(enhancedOffers);
    } catch (error) {
        console.error('Get listing offers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update offer status (accept/reject)
router.put('/:id/status', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // accepted, rejected
        const { uid } = req.user;

        const offer = await offerService.getOfferById(id);
        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        // Verify the user is the seller of the items in the offer
        if (offer.sellerId) {
            if (offer.sellerId !== uid) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        } else if (offer.items && offer.items.length > 0) {
            // Fallback if sellerId not in offer
            const firstListingId = offer.items[0].id.toString();
            const firstListing = await listingService.getListingById(firstListingId);
            
            if (!firstListing || firstListing.sellerId !== uid) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        // Update status
        const updatedOffer = await offerService.updateOffer(id, { status });

        // --- NEW: Send "Offer Accepted" message to chat ---
        if (status === 'accepted') {
            console.log("Status is accepted, triggering chat message logic...");
            const buyerId = offer.buyerId;
            const sellerId = uid;
            
            // Find chat
            // We need listingId for the chat. Use first item.
            if (offer.items && offer.items.length > 0) {
                const listingId = offer.items[0].id;
                
                const chat = Array.from(chats.values()).find(c => 
                    c.listingId === listingId && 
                    c.participants.includes(buyerId) && 
                    c.participants.includes(sellerId)
                );

                if (chat) {
                    // Create acceptance message
                    const text = "🎉 Offer Accepted! Please schedule a pickup time.";
                    const newMessage = {
                        _id: Date.now().toString(),
                        chatId: chat._id,
                        text: text,
                        image: null,
                        type: 'text', // plain text for now, or 'system'
                        createdAt: new Date().toISOString(),
                        user: {
                            _id: sellerId, // Sent by seller
                            name: 'Seller', // Should be enriched really
                        }
                    };
                    
                    messages.set(newMessage._id, newMessage);
                    
                    chat.lastMessage = {
                        text: text,
                        createdAt: newMessage.createdAt
                    };
                    chat.updatedAt = newMessage.createdAt;
                    chats.set(chat._id, chat);

                    // Send notification to buyer
                    notificationService.sendOfferStatusNotification(
                        buyerId,
                        status,
                        offer.items[0].title || 'Item',
                        updatedOffer.id
                    );
                }
            }
        }

        res.json(updatedOffer);
    } catch (error) {
        console.error('Update offer status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
