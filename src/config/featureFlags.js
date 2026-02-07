require('dotenv').config();

const featureFlags = {
  // Default to false unless explicitly set to 'true'
  ENABLE_EXPIRED_LISTING_CLEANUP: process.env.ENABLE_EXPIRED_LISTING_CLEANUP === 'true',
};

module.exports = featureFlags;
