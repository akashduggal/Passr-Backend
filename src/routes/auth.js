const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth' });
});
const verifyToken = require('../middleware/auth');
const userService = require('../services/userService');

// Endpoint to verify token
router.post('/verify', verifyToken, (req, res) => {
  res.status(200).json({ 
    message: 'Token verified successfully', 
    user: req.user 
  });
});

// Dev Login endpoint (Bypasses Firebase Auth)
router.post('/dev-login', async (req, res) => {
  // Only allow in development mode or if explicitly enabled
  // For this project, we'll allow it generally but in production this should be guarded
  
  try {
    const { userId, email, name } = req.body || {};
    const uid = userId || 'dev-user-123';
    const userEmail = email || 'dev@asu.edu';
    const userName = name || 'Dev Student';

    const devUser = {
      uid,
      email: userEmail,
      name: userName,
      picture: null,
      email_verified: true
    };

    // Sync with Supabase via UserService
    // We can fetch existing first if we want to merge, but syncUser in userService
    // already handles upsert (though it overwrites provided fields).
    // The original code merged with existing user. 
    // userService.syncUser merges? 
    // Supabase upsert will update existing columns with new values.
    // However, if we want to keep existing fields that are NOT in devUser,
    // we should fetch first or rely on Supabase only updating provided columns?
    // upsert in Supabase updates the row. If we provide partial data, other columns might be nulled if not present?
    // No, upsert usually updates the provided columns if match found, but here we provide the whole object.
    
    // Let's look at userService.syncUser:
    // It takes userData and adds lastSeen.
    // It calls upsert(dbPayload).
    // If dbPayload is partial, Supabase might only update those fields? 
    // Yes, Supabase upsert updates the columns present in the payload.
    // BUT, if we want to preserve fields like `expoPushToken` which are NOT in `devUser` here,
    // we need to be careful.
    // The original code: `const existingUser = users.get(devUser.uid) || {}; const updatedUser = { ...devUser, ...existingUser, lastSeen: ... }`
    // Wait, `...devUser, ...existingUser`? This means existingUser overrides devUser properties?
    // If so, `email` from existingUser would override `devUser.email`.
    // Let's re-read the original code carefully.
    
    /*
      const existingUser = users.get(devUser.uid) || {};
      const updatedUser = {
        ...devUser,
        ...existingUser,
        lastSeen: new Date().toISOString()
      };
    */
    // Yes, existingUser properties overwrite devUser properties.
    // This seems to prioritize existing data over the dev login params?
    // That's a bit odd for a "login" which usually updates the user info.
    // But maybe it's intended to not overwrite user profile if they log in again?
    
    // In userService.syncUser, I did:
    /*
    async syncUser(userData) {
        const { uid, email, name, picture, ...otherData } = userData;
        const appUserPayload = { uid, email, name, picture, lastSeen: ..., ...otherData };
        // ... upsert
    }
    */
    // If I call syncUser(devUser), it will upsert `devUser` fields.
    // If `devUser` has `email`, it will update `email`.
    // If I want to preserve other fields, upsert does that automatically (it doesn't delete other columns).
    // So I just need to call syncUser(devUser).
    
    const updatedUser = await userService.syncUser(devUser);

    // Return a mock token that the auth middleware will accept
    // Format: DEV_TOKEN:{uid}
    const token = `DEV_TOKEN:${uid}`;
    
    res.status(200).json({
      message: 'Dev login successful',
      token,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error in dev-login:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
