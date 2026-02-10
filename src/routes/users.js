const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'users' });
});
const verifyToken = require('../middleware/auth');
const userService = require('../services/userService');

// Sync user data after login
router.post('/sync', verifyToken, async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user;
    const userData = req.body;

    const userToSync = {
      uid,
      email,
      name,
      picture,
      ...userData
    };

    const updatedUser = await userService.syncUser(userToSync);
    
    console.log('Syncing user:', uid, email);

    res.status(200).json({
      message: 'User synced successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await userService.getUserById(req.user.uid);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Update user profile
router.put('/me', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;
        const updates = req.body;
        
        // Check if user exists first
        const existingUser = await userService.getUserById(uid);
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updatedUser = await userService.updateUser(uid, updates);
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Get user by ID
router.get('/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await userService.getUserById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Return public profile (exclude sensitive data if any)
        const { email, ...publicProfile } = user;
        res.status(200).json(publicProfile);
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Delete user
router.delete('/me', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;
        
        const existingUser = await userService.getUserById(uid);
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        await userService.deleteUser(uid);
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
