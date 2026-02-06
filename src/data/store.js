// Simple in-memory data store for prototyping
// NOTE: Data will be lost when the server restarts

const users = new Map();
const listings = new Map();
const offers = new Map();
const chats = new Map();
const messages = new Map();

// Pre-populate for testing
users.set('seller123', {
    uid: 'seller123',
    email: 'seller@test.com',
    name: 'Seller User'
});

listings.set('listing1', {
    id: 'listing1',
    sellerId: 'seller123',
    title: 'Test Item',
    price: 100,
    description: 'A test item',
    images: [],
    createdAt: new Date(),
    sold: false
});

module.exports = {
    users,
    listings,
    offers,
    chats,
    messages
};
