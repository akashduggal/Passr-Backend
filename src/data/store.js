// Simple in-memory data store for prototyping
// NOTE: Data will be lost when the server restarts

const users = new Map();
const listings = new Map();
const offers = new Map();
const chats = new Map();
const messages = new Map();

// Pre-populate for testing
users.set("dev-user-123", {
    uid: "dev-user-123",
    "email": "dev@asu.edu",
    "name": "Dev Student",
});

users.set('mct7lEJvAGhCRGgYxfiJOp2U49V2', {
    uid: 'mct7lEJvAGhCRGgYxfiJOp2U49V2',
    email: 'akash@test.com',
    name: 'Akash Test',
    expoPushToken: 'ExponentPushToken[aiuwOELk819-696Vl97s6O]' // Placeholder for testing
});

listings.set('1770438944905', {
    id: '1770438944905',
    sellerId: 'mct7lEJvAGhCRGgYxfiJOp2U49V2',
    postedAt: '2026-02-07T04:35:44.905Z',
    expiresAt: '2026-02-08T04:35:44.905Z',
    sold: false,
    title: 'Akash Android',
    description: 'Hdhd',
    price: 64,
    category: 'Furniture',
    brand: 'IKEA',
    condition: 'New',
    livingCommunity: 'Tooker',
    urgent: true,
    eventDate: '',
    venue: '',
    images: [
      'https://passr-listings.s3.us-east-1.amazonaws.com/listings/dev-user-123/1770439386878-ee461df8-f427-4f32-a1ac-33d99d344396.webp'
    ],
    coverImage: 'https://passr-listings.s3.us-east-1.amazonaws.com/listings/dev-user-123/1770439386878-ee461df8-f427-4f32-a1ac-33d99d344396.webp'
  });


  listings.set('1770439387683', {
    id: '1770439387683',
    sellerId: 'dev-user-123',
    postedAt: '2026-02-07T04:43:07.683Z',
    expiresAt: '2026-02-08T04:43:07.683Z',
    sold: false,
    title: 'Akash Iphone',
    description: 'Hh',
    price: 55,
    category: 'Furniture',
    brand: 'Wayfair',
    condition: 'New',
    livingCommunity: 'The District on Apache',
    urgent: true,
    eventDate: '',
    venue: '',
    images: [
      'https://passr-listings.s3.us-east-1.amazonaws.com/listings/dev-user-123/1770439386878-ee461df8-f427-4f32-a1ac-33d99d344396.webp'
    ],
    coverImage: 'https://passr-listings.s3.us-east-1.amazonaws.com/listings/dev-user-123/1770439386878-ee461df8-f427-4f32-a1ac-33d99d344396.webp'
  });

module.exports = {
    users,
    listings,
    offers,
    chats,
    messages
};
