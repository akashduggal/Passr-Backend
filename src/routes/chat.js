const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const chatService = require('../services/chatService');
const userService = require('../services/userService');
const listingService = require('../services/listingService');
const notificationService = require('../services/notificationService');

// Create or get existing chat
router.post('/', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;
        const { otherUserId, listingId, offerId } = req.body;

        if (!otherUserId || !listingId) {
            return res.status(400).json({ error: 'otherUserId and listingId are required' });
        }

        const chat = await chatService.createChat(listingId, [uid, otherUserId], offerId);
        res.status(201).json(chat);
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all chats for current user
router.get('/', verifyToken, async (req, res) => {
    try {
        const { uid } = req.user;

        const userChats = await chatService.getChatsForUser(uid);

        // Get all unique other user IDs
        const otherUserIds = [...new Set(userChats.map(chat => chat.participants.find(p => p !== uid)).filter(id => id))];
        const otherUsers = await userService.getUsersByIds(otherUserIds);
        const usersMap = new Map(otherUsers.map(u => [u.uid, u]));

        // Enrich with other user details and listing details
        const enrichedChats = await Promise.all(userChats.map(async (chat) => {
            const otherUserId = chat.participants.find(p => p !== uid);
            const otherUser = usersMap.get(otherUserId);
            
            let listing = null;
            try {
                listing = await listingService.getListingById(chat.listingId);
            } catch (e) {
                console.error(`Error fetching listing ${chat.listingId} for chat ${chat.id}:`, e);
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
router.get('/:chatId/messages', verifyToken, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { uid } = req.user;

        const chat = await chatService.getChatById(chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (!chat.participants.includes(uid)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const messages = await chatService.getMessages(chatId);

        // Enrich messages with user details for GiftedChat
        const senderIds = [...new Set(messages.map(m => m.senderId))];
        const users = await userService.getUsersByIds(senderIds);
        const usersMap = new Map(users.map(u => [u.uid, u]));

        const enrichedMessages = messages.map(m => {
            const sender = usersMap.get(m.senderId);
            return {
                ...m,
                user: {
                    _id: m.senderId,
                    name: sender?.name || 'User',
                    avatar: sender?.picture || sender?.photoURL
                }
            };
        });

        res.json(enrichedMessages);
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

        const chat = await chatService.getChatById(chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (!chat.participants.includes(uid)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const sender = await userService.getUserById(uid);

        const newMessage = await chatService.sendMessage({
            chatId,
            senderId: uid,
            content: text,
            type,
            image,
            schedule
        });

        // Enrich with user object for response
        const responseMessage = {
            ...newMessage,
            user: {
                _id: uid,
                name: sender?.name || 'User',
                avatar: sender?.picture || sender?.photoURL
            }
        };

        // --- SEND PUSH NOTIFICATION ---
        const recipientId = chat.participants.find(p => p !== uid);
        const senderName = sender?.name || 'User';
        let listing = null;
        try {
            listing = await listingService.getListingById(chat.listingId);
        } catch (e) {
             console.error(`Error fetching listing for notification:`, e);
        }

        // Notification service expects raw params, not objects usually, but let's check signature
        // notificationService.sendChatMessageNotification(recipientId, senderName, text, type, chat, listing, schedule);
        // We can pass the enriched message or just the params. The original code passed params.
        
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

        res.status(201).json(responseMessage);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
