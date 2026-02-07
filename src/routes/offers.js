const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { offers, listings, users, chats, messages } = require('../data/store');
const notificationService = require('../services/notificationService');

// Create a new offer
router.post('/', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;
        const offerData = req.body;
        
        // Validate required fields
        if (!offerData.items || !offerData.totalOfferAmount) {
            return res.status(400).json({ error: 'Items and offer amount are required' });
        }

        // Create offer object
        const newOffer = {
            id: Date.now().toString(),
            buyerId: uid, // uid is from the authenticated token (the logged-in user making the offer)
            createdAt: new Date().toISOString(),
            status: 'pending', // pending, accepted, rejected
            ...offerData
        };

        // Ensure we don't overwrite buyerId if it was passed in body (though it shouldn't be)
        newOffer.buyerId = uid;

        // Enhance with buyer details (simulated join)
        const buyer = users.get(uid);
        if (buyer) {
            newOffer.buyerName = buyer.name || 'ASU Student';
        }

        // Validate sellerId is NOT the same as buyerId
        if (newOffer.sellerId === newOffer.buyerId) {
             return res.status(400).json({ error: 'You cannot make an offer on your own listing' });
        }

        // Store offer
        offers.set(newOffer.id, newOffer);

        // Create initial chat message for the offer
        if (offerData.items.length > 0) {
            const firstListingId = offerData.items[0].id.toString();
            const firstListing = listings.get(firstListingId);
            
            if (firstListing) {
                const sellerId = firstListing.sellerId;
                
                // Create or find chat
                // Check for existing chat for this listing/offer?
                // Actually, usually offers start a NEW conversation context or append to existing?
                // For this MVP, let's create a chat entry if it doesn't exist, or just use the logic from chat.js
                // But wait, if we just want to "send a message", we need a chat ID.
                // Let's create a chat session implicitly here so the message has a home.
                
                // Logic adapted from chat.js create
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
                    createdAt: new Date().toISOString(),
                    user: {
                        _id: uid,
                        name: buyer ? buyer.name : 'Buyer',
                        avatar: buyer ? buyer.photoURL : null
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
        // -----------------------------------------------------

        res.status(201).json(newOffer);
    } catch (error) {
        console.error('Create offer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get offers for a specific user (as buyer)
router.get('/my-offers', verifyToken, (req, res) => {
    try {
        const { uid } = req.user;
        
        // Filter offers where user is the buyer
        const myOffers = Array.from(offers.values())
            .filter(offer => offer.buyerId === uid)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first

        // Enhance offers with seller name and listing details if possible
        const enhancedOffers = myOffers.map(offer => {
            // Find first item's listing to get seller info
            if (offer.items && offer.items.length > 0) {
                const firstListing = listings.get(offer.items[0].id.toString());
                if (firstListing) {
                    const seller = users.get(firstListing.sellerId);
                    return {
                        ...offer,
                        sellerId: firstListing.sellerId,
                        sellerName: seller ? seller.name : 'Unknown Seller'
                    };
                }
            }
            return { ...offer, sellerName: 'Unknown Seller', sellerId: null };
        });

        res.json(enhancedOffers);
    } catch (error) {
        console.error('Get my offers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single offer by ID
router.get('/:id', verifyToken, (req, res) => {
    try {
        const { id } = req.params;
        const offer = offers.get(id);
        
        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        // Enrich with seller info if missing
        let enrichedOffer = { ...offer };
        if (offer.items && offer.items.length > 0) {
            const firstListing = listings.get(offer.items[0].id.toString());
            if (firstListing) {
                const seller = users.get(firstListing.sellerId);
                enrichedOffer.sellerId = firstListing.sellerId;
                enrichedOffer.sellerName = seller ? seller.name : 'Unknown Seller';
            }
        }
        
        // Ensure buyer info is present (should be in store, but just in case)
        if (!enrichedOffer.buyerName && enrichedOffer.buyerId) {
             const buyer = users.get(enrichedOffer.buyerId);
             enrichedOffer.buyerName = buyer ? buyer.name : 'Buyer';
        }

        res.json(enrichedOffer);
    } catch (error) {
        console.error('Get offer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get offers received for a specific listing (as seller)
router.get('/listing/:listingId', verifyToken, (req, res) => {
    try {
        const { listingId } = req.params;
        const { uid } = req.user;

        // Verify the user owns this listing
        const listing = listings.get(listingId);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        if (listing.sellerId !== uid) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Find offers that include this listing
        const receivedOffers = Array.from(offers.values())
            .filter(offer => offer.items.some(item => item.id.toString() === listingId))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Enhance with dynamic buyer details
        const enhancedOffers = receivedOffers.map(offer => {
            const buyer = users.get(offer.buyerId);
            return {
                ...offer,
                buyerName: buyer ? buyer.name : (offer.buyerName || 'Buyer')
            };
        });

        res.json(enhancedOffers);
    } catch (error) {
        console.error('Get listing offers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update offer status (accept/reject)
router.put('/:id/status', verifyToken, (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // accepted, rejected
        const { uid } = req.user;

        const offer = offers.get(id);
        if (!offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        // Verify the user is the seller of the items in the offer
        // For simplicity, we check the first item
        if (offer.items && offer.items.length > 0) {
            const firstListingId = offer.items[0].id.toString();
            const firstListing = listings.get(firstListingId);
            
            console.log(`Checking auth for accept offer. UID: ${uid}`);
            console.log(`Listing ID: ${firstListingId}`);
            if (firstListing) {
                console.log(`Listing Seller ID: ${firstListing.sellerId}`);
            } else {
                console.log("Listing not found!");
            }

            if (!firstListing || firstListing.sellerId !== uid) {
                console.log("Unauthorized: Seller ID mismatch or listing missing");
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        // Update status
        offer.status = status;
        offers.set(id, offer);

        // --- NEW: Send "Offer Accepted" message to chat ---
        if (status === 'accepted') {
            console.log("Status is accepted, triggering chat message logic...");
            const buyerId = offer.buyerId;
            const sellerId = uid; // Current user is seller accepting the offer
            console.log(`Buyer: ${buyerId}, Seller: ${sellerId}`);

            // Find the chat (it should exist now since we create it on offer creation, 
            // but if not, we create it)
            // We need to look up listingId from the offer items
            if (offer.items && offer.items.length > 0) {
                 const firstListingId = offer.items[0].id.toString();
                 console.log(`Listing ID: ${firstListingId}`);
                 
                 let chat = Array.from(chats.values()).find(c => 
                     c.listingId === firstListingId && 
                     c.participants.includes(buyerId) && 
                     c.participants.includes(sellerId)
                 );

                 if (chat) {
                     console.log(`Found existing chat: ${chat._id}`);
                 } else {
                     console.log("Chat not found, creating new one...");
                 }

                 // If for some reason chat doesn't exist (e.g. old offer), create it
                 if (!chat) {
                     chat = {
                        _id: Date.now().toString(),
                        participants: [buyerId, sellerId],
                        listingId: firstListingId,
                        offerId: offer.id,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        lastMessage: null
                     };
                     chats.set(chat._id, chat);
                 }

                 // Create system message for acceptance
                 // "Offer Accepted! You can now arrange pickup."
                 const text = "Offer Accepted! You can now arrange pickup.";
                 
                 const newMessage = {
                    _id: Date.now().toString(),
                    chatId: chat._id,
                    text: text,
                    image: null,
                    createdAt: new Date().toISOString(),
                    // Sender is Seller
                    user: {
                        _id: sellerId,
                        name: users.get(sellerId)?.name || 'Seller',
                        avatar: users.get(sellerId)?.photoURL
                    },
                    system: true // Optional marker for UI styling if needed, or just plain text
                 };
                 
                 messages.set(newMessage._id, newMessage);
                 console.log(`Created acceptance message: ${newMessage._id}`);

                 // Update chat
                 chat.lastMessage = {
                     text: text,
                     createdAt: newMessage.createdAt
                 };
                 chat.updatedAt = newMessage.createdAt;
                 chats.set(chat._id, chat);
            } else {
                console.log("No items in offer, skipping chat message.");
            }
        }
        // --------------------------------------------------

        // If accepted, we might want to mark listings as sold or pending
        // but for now we just update offer status

        res.json(offer);
    } catch (error) {
        console.error('Update offer status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
