const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { chats, messages, offers } = require('../data/store');
const userService = require('../services/userService');
const listingService = require('../services/listingService');
const notificationService = require('../services/notificationService');

// Create or get existing chat
router.post('/', verifyToken, (req, res) => {
    try {
        const { uid } = req.user;
        const { otherUserId, listingId, offerId } = req.body;

        if (!otherUserId || !listingId) {
            return res.status(400).json({ error: 'otherUserId and listingId are required' });
        }

        // Check for existing chat
        const existingChat = Array.from(chats.values()).find(c => 
            c.listingId === listingId && 
            c.participants.includes(uid) && 
            c.participants.includes(otherUserId)
        );

        if (existingChat) {
            return res.json(existingChat);
        }

        // Create new chat
        const newChat = {
            _id: Date.now().toString(),
            participants: [uid, otherUserId],
            listingId,
            offerId: offerId || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessage: null
        };

        chats.set(newChat._id, newChat);
        res.status(201).json(newChat);
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all chats for current user
router.get('/', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;

        const userChats = Array.from(chats.values())
            .filter(c => c.participants.includes(uid))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        // Get all unique other user IDs
        const otherUserIds = [...new Set(userChats.map(chat => chat.participants.find(p => p !== uid)).filter(id => id))];
        const otherUsers = await userService.getUsersByIds(otherUserIds);
        const usersMap = new Map(otherUsers.map(u => [u.uid, u]));

        // Enrich with other user details and listing details
        // Note: Promise.all needed for listing fetch
        const enrichedChats = await Promise.all(userChats.map(async (chat) => {
            const otherUserId = chat.participants.find(p => p !== uid);
            const otherUser = usersMap.get(otherUserId);
            
            let listing = null;
            try {
                listing = await listingService.getListingById(chat.listingId);
            } catch (e) {
                console.error(`Error fetching listing ${chat.listingId} for chat ${chat._id}:`, e);
            }
            
            return {
                ...chat,
                otherUser: otherUser ? {
                    id: otherUser.uid,
                    name: otherUser.name,
                    photoURL: otherUser.picture || otherUser.photoURL
                } : { name: 'Unknown User' },
                listing: listing ? {
                    id: listing.id,
                    title: listing.title,
                    image: listing.images && listing.images[0]
                } : null
            };
        }));

        res.json(enrichedChats);
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get messages for a chat
router.get('/:chatId/messages', verifyToken, (req, res) => {
    try {
        const { chatId } = req.params;
        const { uid } = req.user;

        const chat = chats.get(chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (!chat.participants.includes(uid)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const chatMessages = Array.from(messages.values())
            .filter(m => m.chatId === chatId)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        res.json(chatMessages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send a message
router.post('/:chatId/messages', verifyToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { uid } = req.user;
        const { text, image, type, schedule } = req.body;

        const chat = chats.get(chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (!chat.participants.includes(uid)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const sender = await userService.getUserById(uid);

        const newMessage = {
            _id: Date.now().toString(), // Use _id for GiftedChat compatibility
            chatId,
            text: text || '',
            image: image || null,
            type: type || 'text',
            schedule: schedule || null,
            createdAt: new Date().toISOString(),
            user: {
                _id: uid,
                name: sender?.name || 'User',
                avatar: sender?.picture || sender?.photoURL
            }
        };

        messages.set(newMessage._id, newMessage);

        // Update chat's last message
        let lastMsgText = text;
        if (type === 'schedule') {
            lastMsgText = '📅 Pickup Scheduled';
        } else if (type === 'schedule_cancellation') {
            lastMsgText = '🚫 Pickup Cancelled';
        } else if (type === 'schedule_acceptance') {
            lastMsgText = '✅ Pickup Confirmed';
        } else if (type === 'schedule_rejection') {
            lastMsgText = '❌ Pickup Declined';
        } else if (!text && image) {
            lastMsgText = 'Sent an image';
        } else if (text) {
            lastMsgText = text.length > 50 ? text.substring(0, 50) + '...' : text;
        }

        chat.lastMessage = {
            text: lastMsgText,
            createdAt: newMessage.createdAt
        };
        chat.updatedAt = newMessage.createdAt;
        chats.set(chatId, chat);

        // --- SEND PUSH NOTIFICATION ---
        // Identify recipient (the participant who is NOT the sender)
        const recipientId = chat.participants.find(p => p !== uid);
        const senderName = sender?.name || 'User';
        let listing = null;
        try {
            listing = await listingService.getListingById(chat.listingId);
        } catch (e) {
             console.error(`Error fetching listing for notification:`, e);
        }

        notificationService.sendChatMessageNotification(
            recipientId,
            senderName,
            text,
            type,
            chat,
            listing,
            schedule
        );
        // -----------------------------

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
