const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const listingRoutes = require('./routes/listings');
const offerRoutes = require('./routes/offers');
const chatRoutes = require('./routes/chat');
const wishlistRoutes = require('./routes/wishlist');
const uploadRoutes = require('./routes/upload');
const notificationRoutes = require('./routes/notifications');
const requestLogger = require('./middleware/requestLogger');
const listingService = require('./services/listingService');
const offerService = require('./services/offerService');
const chatService = require('./services/chatService');
const wishlistService = require('./services/wishlistService');
const notificationService = require('./services/notificationService');
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
app.use('/api/wishlist', wishlistRoutes); // Add wishlist routes under /api/wishlist
app.use('/api/upload', uploadRoutes); // Add upload routes under /api/upload
app.use('/api/notifications', notificationRoutes); // Add notification routes under /api/notifications

app.get('/', (req, res) => {
  res.send('Passr Backend is running');
});

// Periodic cleanup task for expired listings
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_CRON_JOBS === 'true') {
  setInterval(async () => {
    if (!ENABLE_EXPIRED_LISTING_CLEANUP) return;

    console.log('[Cleanup] Starting expired listings cleanup...');
    
    try {
        // 1. Identify expired listings from DB
        const expiredListings = await listingService.getExpiredListings();

        if (expiredListings.length > 0) {
          console.log(`[Cleanup] Found ${expiredListings.length} expired listings:`, expiredListings.map(l => l.id));
          const s3KeysToDelete = [];

          for (const listing of expiredListings) {
            // 2. Collect images for S3 deletion
            if (listing.images && Array.isArray(listing.images)) {
              listing.images.forEach(imageUrl => {
                try {
                   // Extract Key from URL
                   // Format: https://BUCKET.s3.REGION.amazonaws.com/KEY
                   const url = new URL(imageUrl);
                   const key = url.pathname.slice(1);
                   if (key) s3KeysToDelete.push(key);
                } catch (e) {
                   // Ignore invalid URLs
                }
              });
            }

            // 3. Remove associated offers
            const deletedOffersCount = await offerService.deleteOffersForListing(listing.id);
            if (deletedOffersCount > 0) console.log(`  - Deleted ${deletedOffersCount} associated offers for listing ${listing.id}`);

            // 4. Remove associated chats and messages (cascaded)
            const deletedChatsCount = await chatService.deleteChatsForListing(listing.id);
            if (deletedChatsCount > 0) console.log(`  - Deleted ${deletedChatsCount} associated chats for listing ${listing.id}`);

            // 5. Delete the listing from DB
            await listingService.deleteListing(listing.id);
          }

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
    } catch (error) {
        console.error('[Cleanup] Error during cleanup:', error);
    }
  }, 30 * 1000); // Run every 30 seconds

  // Periodic check for expiring listings (Warning Notifications)
  setInterval(async () => {
    console.log('[Expiration Check] Starting expiration warning check...');
    try {
      // Check for listings expiring in 24 hours (24 to 25 hours window)
      const listingsExpiringSoon = await listingService.getListingsExpiringInWindow(24, 25);
      
      if (listingsExpiringSoon.length > 0) {
          console.log(`[Expiration Check] Found ${listingsExpiringSoon.length} listings expiring in 24h.`);
          
          for (const listing of listingsExpiringSoon) {
              // 1. Notify Seller
              notificationService.sendExpirationWarningToSeller(listing.sellerId, listing, 24)
                  .catch(err => console.error(`Error notifying seller for listing ${listing.id}:`, err));

              // 2. Notify Wishlist Users
              const wishlistUsers = await wishlistService.getUsersWhoWishlisted(listing.id);
              for (const userId of wishlistUsers) {
                  if (userId !== listing.sellerId) {
                      notificationService.sendExpirationWarningToWishlist(userId, listing, 24)
                          .catch(err => console.error(`Error notifying wishlist user ${userId} for listing ${listing.id}:`, err));
                  }
              }
          }
      }
    } catch (error) {
        console.error('[Expiration Check] Error during check:', error);
    }
  }, 60 * 60 * 1000); // Run every hour
}

// Only start the server if running directly (not via Vercel/Serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
