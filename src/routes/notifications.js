const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'notifications' });
});
const verifyToken = require('../middleware/auth');
const supabase = require('../config/supabase');

// Get user's notifications
router.get('/', verifyToken, async (req, res) => {
    const { uid } = req.user;
    
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('recipient_id', uid)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark notification as read
router.patch('/:id/read', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { uid } = req.user;
    
    try {
        const { data, error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id)
            .eq('recipient_id', uid) // Security check
            .select()
            .single();
            
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark all as read
router.patch('/read-all', verifyToken, async (req, res) => {
    const { uid } = req.user;
    
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('recipient_id', uid);
            
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete notification
router.delete('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { uid } = req.user;
    
    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id)
            .eq('recipient_id', uid); // Security check
            
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
