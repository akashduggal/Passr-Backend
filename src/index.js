const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const listingRoutes = require('./routes/listings');
const offerRoutes = require('./routes/offers');
const chatRoutes = require('./routes/chat');
const uploadRoutes = require('./routes/upload');
const requestLogger = require('./middleware/requestLogger');
const { listings, offers, chats, messages } = require('./data/store');
const { DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('./config/s3');
const { ENABLE_EXPIRED_LISTING_CLEANUP } = require('./config/featureFlags');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/auth', authRoutes); // Keep existing auth routes
app.use('/api/users', userRoutes); // Add user routes under /api/users
app.use('/api/listings', listingRoutes); // Add listing routes under /api/listings
app.use('/api/offers', offerRoutes); // Add offer routes under /api/offers
app.use('/api/chats', chatRoutes); // Add chat routes under /api/chats
app.use('/api/upload', uploadRoutes); // Add upload routes under /api/upload

app.get('/', (req, res) => {
  res.send('Passr Backend is running');
});

// Periodic cleanup task for expired listings
setInterval(async () => {
  if (!ENABLE_EXPIRED_LISTING_CLEANUP) return;

  console.log('[Cleanup] Starting expired listings cleanup...');
  const now = new Date();
  const expiredListings = [];
  console.log("[Cleanup] All listings:", listings);
  // 1. Identify expired listings
  for (const [id, listing] of listings.entries()) {
    if (listing.expiresAt && new Date(listing.expiresAt) <= now) {
      expiredListings.push(id);
    }
  }

  if (expiredListings.length > 0) {
    console.log(`[Cleanup] Found ${expiredListings.length} expired listings:`, expiredListings);
    const s3KeysToDelete = [];

    expiredListings.forEach(listingId => {
      const listing = listings.get(listingId);
      if (!listing) return;

      // 2. Collect images for S3 deletion
      if (listing.images && Array.isArray(listing.images)) {
        listing.images.forEach(imageUrl => {
          try {
             // Extract Key from URL
             // Format: https://BUCKET.s3.REGION.amazonaws.com/KEY
             // We assume the URL is a valid URL string
             const url = new URL(imageUrl);
             // pathname includes leading slash, e.g. /listings/uid/file.jpg
             const key = url.pathname.slice(1);
             if (key) s3KeysToDelete.push(key);
          } catch (e) {
             // Ignore invalid URLs (might be local paths or placeholders)
          }
        });
      }

      // 3. Remove associated offers
      // Offers can contain multiple items, but if this listing is part of an offer, 
      // strictly speaking, the offer for THIS item is invalid. 
      // If it's a bundle, removing just one item might be complex. 
      // For this MVP/implementation, if a listing expires, we invalidate/remove offers containing it.
      const associatedOffers = [];
      for (const [offerId, offer] of offers.entries()) {
        if (offer.items && offer.items.some(item => item.id === listingId)) {
          associatedOffers.push(offerId);
        }
      }
      associatedOffers.forEach(offerId => offers.delete(offerId));
      if (associatedOffers.length > 0) console.log(`  - Deleted ${associatedOffers.length} associated offers`);

      // 4. Remove associated chats and messages
      const associatedChats = [];
      for (const [chatId, chat] of chats.entries()) {
        if (chat.listingId === listingId) {
          associatedChats.push(chatId);
        }
      }

      associatedChats.forEach(chatId => {
        // Remove messages for this chat
        const chatMessages = [];
        for (const [msgId, msg] of messages.entries()) {
          if (msg.chatId === chatId) {
            chatMessages.push(msgId);
          }
        }
        chatMessages.forEach(msgId => messages.delete(msgId));
        
        // Remove the chat
        chats.delete(chatId);
      });
      if (associatedChats.length > 0) console.log(`  - Deleted ${associatedChats.length} associated chats`);

      // 5. Delete the listing
      listings.delete(listingId);
    });

    // 6. Delete images from S3
    if (s3KeysToDelete.length > 0) {
      try {
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Delete: {
            Objects: s3KeysToDelete.map(Key => ({ Key })),
            Quiet: true
          }
        }));
        console.log(`  - Deleted ${s3KeysToDelete.length} images from S3`);
      } catch (error) {
        console.error('Error deleting images from S3:', error);
      }
    }
    
    console.log('[Cleanup] Expired listings cleanup complete.');
  }
}, 30 * 1000); // Run every 30 seconds

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
