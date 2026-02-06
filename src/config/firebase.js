const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Firebase Admin SDK
// Ensure you have GOOGLE_APPLICATION_CREDENTIALS set in your .env file
// pointing to the path of your serviceAccountKey.json file.
// Example .env: GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"

try {
  // Check for direct JSON content in environment variable (Best for Vercel/Cloud)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin Initialized using FIREBASE_SERVICE_ACCOUNT JSON.');
  } 
  // Fallback to file path mechanism (Best for Local Dev)
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('Firebase Admin Initialized using GOOGLE_APPLICATION_CREDENTIALS file path.');
  } else {
    console.warn('WARNING: No Firebase credentials found in environment. Firebase Admin not initialized.');
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error);
}

module.exports = admin;
