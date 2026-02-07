/**
 * Client-side routes for deep linking
 * Must match the routing structure in the frontend (Expo Router)
 */
const ROUTES = {
    CHAT: '/chat',
    PROFILE: {
        LISTING_OFFERS: '/profile-listing-offers',
        MY_LISTINGS: '/profile-my-listings',
        PAST_ORDERS: '/profile-past-orders',
        WISHLIST: '/profile-my-wishlist'
    },
    MARKETPLACE: {
        PRODUCT_DETAILS: '/product-detail'
    },
    DASHBOARD: '/dashboard',
    LISTING_DETAILS: '/product-detail'
};

/**
 * Creates a deep link URL for the client app
 * @param {string} route - The route path (e.g., '/chat')
 * @param {object} params - Query parameters
 * @returns {string} - The constructed URL (e.g., '/chat?id=123')
 */
const createDeepLink = (route, params = {}) => {
    if (!params || Object.keys(params).length === 0) {
        return route;
    }

    const queryParts = Object.entries(params).map(([key, value]) => {
        let valStr = value;
        if (typeof value === 'object' && value !== null) {
            valStr = JSON.stringify(value);
        }
        return `${encodeURIComponent(key)}=${encodeURIComponent(valStr)}`;
    });

    return `${route}?${queryParts.join('&')}`;
};

module.exports = {
    ROUTES,
    createDeepLink
};
