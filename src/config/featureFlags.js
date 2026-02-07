require('dotenv').config();

module.exports = {
    // Feature: Cleanup expired listings
    // Default: false (Safety first)
    ENABLE_EXPIRED_LISTING_CLEANUP: true,

    // Feature: Log API requests and responses
    // Default: true (Helpful for debugging)
    ENABLE_API_LOGGING: true
};
