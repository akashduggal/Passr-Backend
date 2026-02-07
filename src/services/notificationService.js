const { Expo } = require('expo-server-sdk');
const { users } = require('../data/store');
const { ROUTES, createDeepLink } = require('../constants/clientRoutes');

const expo = new Expo();

/**
 * Core function to send a push notification to a user
 * @param {string} recipientId - The UID of the recipient
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom data payload
 */
const sendPushNotification = async (recipientId, title, body, data) => {
    try {
        const recipient = users.get(recipientId);

        if (!recipient || !recipient.expoPushToken || !Expo.isExpoPushToken(recipient.expoPushToken)) {
            console.log(`[Push] User ${recipientId} does not have a valid push token.`);
            return;
        }

        const notification = {
            to: recipient.expoPushToken,
            sound: 'default',
            title: title,
            body: body,
            data: data
        };

        const chunks = expo.chunkPushNotifications([notification]);
        for (let chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
        }
        console.log(`[Push] Sent notification to ${recipientId}: ${title}`);
    } catch (error) {
        console.error('[Push] Error sending notification:', error);
    }
};

/**
 * Handles logic for sending chat message notifications
 */
const sendChatMessageNotification = async (recipientId, senderName, messageText, messageType, chat, listing, scheduleData = null) => {
    // 1. Construct Deep Link
    // If recipient is the seller of the listing:
    const isRecipientSeller = listing && recipientId === listing.sellerId;
    
    const deepLinkParams = {
        listingId: chat.listingId,
        offerId: chat.offerId || '',
        isSeller: isRecipientSeller ? 'true' : 'false',
    };
    const deepLinkUrl = createDeepLink(ROUTES.CHAT, deepLinkParams);

    // 2. Construct Title and Body
    let body = messageText;
    let title = 'New message'; // Default title
    let notificationType = 'message';

    if (messageText) {
        body = `${senderName}: "${messageText}"`;
    } else if (!messageText && messageType === 'image') { // assuming 'image' type or check if text is empty but image exists
        body = `${senderName} sent an image 📷`;
    } else if (!messageText) {
        // Fallback
        body = 'New message'; 
    }

    // Customize for schedule events
    switch (messageType) {
        case 'schedule':
            notificationType = 'pickup_scheduled';
            title = 'Pickup scheduled';
            if (scheduleData) {
                try {
                    const dateObj = new Date(scheduleData.date);
                    const timeObj = new Date(scheduleData.time);
                    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = timeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    const locationStr = scheduleData.location ? ` — ${scheduleData.location}` : '';
                    body = `${dateStr} at ${timeStr}${locationStr}`;
                } catch (e) {
                    body = '📅 Proposed a pickup time';
                }
            } else {
                body = '📅 Proposed a pickup time';
            }
            break;
        case 'schedule_acceptance':
            notificationType = 'offer_accepted';
            title = 'Pickup confirmed';
            body = '✅ Accepted pickup time';
            break;
        case 'schedule_rejection':
            notificationType = 'offer_rejected';
            title = 'Pickup declined';
            body = '❌ Declined pickup time';
            break;
        case 'schedule_cancellation':
            notificationType = 'offer_rejected';
            title = 'Pickup cancelled';
            body = '🚫 Cancelled pickup';
            break;
    }

    // 3. Construct Data Payload
    const payload = {
        type: notificationType,
        url: deepLinkUrl,
        chatId: chat._id,
        listingId: chat.listingId,
        listingTitle: listing ? listing.title : 'Listing',
        listingImage: (listing && listing.images && listing.images[0]) ? listing.images[0] : null,
        productPrice: listing ? listing.price : 0,
        createdAt: new Date().toISOString()
    };

    await sendPushNotification(recipientId, title, body, payload);
};

/**
 * Handles logic for sending new offer notifications
 */
const sendOfferNotification = async (sellerId, buyerName, amount, itemName, listing, offerId) => {
    // 1. Construct Deep Link
    const listingObj = {
        id: listing.id,
        title: listing.title || 'Listing',
        price: listing.price || 0,
        image: (listing.images && listing.images.length > 0) ? listing.images[0] : null,
        sold: false
    };
    const deepLinkUrl = createDeepLink(ROUTES.PROFILE.LISTING_OFFERS, { listing: listingObj });

    // 2. Construct Content
    const title = 'New Offer Received! 💰';
    const body = `${buyerName} offered $${amount.toFixed(0)} for ${itemName}`;

    // 3. Construct Payload
    const payload = {
        type: 'offer',
        listingId: listing.id,
        offerId: offerId,
        listingTitle: listing.title,
        listingPrice: listing.price,
        listingImage: listingObj.image,
        url: deepLinkUrl
    };

    await sendPushNotification(sellerId, title, body, payload);
};

module.exports = {
    sendPushNotification,
    sendChatMessageNotification,
    sendOfferNotification
};
