const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin SDK
// Ensure you have GOOGLE_APPLICATION_CREDENTIALS set in your .env file
// pointing to the path of your serviceAccountKey.json file.
// Example .env: GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"

try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('Firebase Admin Initialized successfully.');
  } else {
    console.warn('WARNING: GOOGLE_APPLICATION_CREDENTIALS not found in environment. Firebase Admin not initialized.');
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error);
}

module.exports = admin;
