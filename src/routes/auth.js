const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { users } = require('../data/store');

// Endpoint to verify token
router.post('/verify', verifyToken, (req, res) => {
  res.status(200).json({ 
    message: 'Token verified successfully', 
    user: req.user 
  });
});

// Dev Login endpoint (Bypasses Firebase Auth)
router.post('/dev-login', (req, res) => {
  // Only allow in development mode or if explicitly enabled
  // For this project, we'll allow it generally but in production this should be guarded
  
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

  // Sync with store
  const existingUser = users.get(devUser.uid) || {};
  const updatedUser = {
    ...devUser,
    ...existingUser,
    lastSeen: new Date().toISOString()
  };
  users.set(devUser.uid, updatedUser);

  // Return a mock token that the auth middleware will accept
  // Format: DEV_TOKEN:{uid}
  const token = `DEV_TOKEN:${uid}`;
  
  res.status(200).json({
    message: 'Dev login successful',
    token,
    user: updatedUser
  });
});

module.exports = router;
