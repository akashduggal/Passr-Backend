const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { users } = require('../data/store');

// Sync user data after login
router.post('/sync', verifyToken, async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user;
    const userData = req.body;

    // Merge existing user data with new data
    const existingUser = users.get(uid) || {};
    const updatedUser = {
      uid,
      email,
      name,
      picture,
      ...existingUser,
      ...userData,
      lastSeen: new Date().toISOString()
    };

    // Save to in-memory store
    users.set(uid, updatedUser);
    
    console.log('Syncing user:', uid, email);
    console.log('Current Store Size:', users.size);

    res.status(200).json({
      message: 'User synced successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/me', verifyToken, (req, res) => {
    const user = users.get(req.user.uid);
    
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
});

// Update user profile
router.put('/me', verifyToken, (req, res) => {
    const { uid } = req.user;
    const updates = req.body;
    
    const existingUser = users.get(uid);
    if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = {
        ...existingUser,
        ...updates,
        updatedAt: new Date().toISOString()
    };

    users.set(uid, updatedUser);
    res.status(200).json(updatedUser);
});

// Get user by ID
router.get('/:userId', verifyToken, (req, res) => {
    const { userId } = req.params;
    const user = users.get(userId);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Return public profile (exclude sensitive data if any)
    const { email, ...publicProfile } = user;
    res.status(200).json(publicProfile);
});

// Delete user
router.delete('/me', verifyToken, (req, res) => {
    const { uid } = req.user;
    
    if (!users.has(uid)) {
        return res.status(404).json({ message: 'User not found' });
    }

    users.delete(uid);
    res.status(200).json({ message: 'User deleted successfully' });
});

module.exports = router;
