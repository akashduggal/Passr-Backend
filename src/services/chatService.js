const supabase = require('../config/supabase');

class ChatService {
  _toAppModel(dbChat) {
    if (!dbChat) return null;
    const {
      listing_id,
      offer_id,
      last_message,
      created_at,
      updated_at,
      ...rest
    } = dbChat;

    return {
      ...rest,
      _id: dbChat.id, // Frontend might expect _id
      id: dbChat.id,
      listingId: listing_id,
      offerId: offer_id,
      lastMessage: last_message,
      createdAt: created_at,
      updatedAt: updated_at,
    };
  }

  _messageToAppModel(dbMessage) {
    if (!dbMessage) return null;
    const {
      chat_id,
      sender_id,
      image_url,
      message_type,
      schedule_data,
      created_at,
      ...rest
    } = dbMessage;

    return {
      ...rest,
      _id: dbMessage.id, // GiftedChat requires _id
      id: dbMessage.id,
      text: dbMessage.content, // Frontend expects 'text'
      chatId: chat_id,
      senderId: sender_id,
      image: image_url,
      type: message_type,
      schedule: schedule_data,
      createdAt: created_at,
      // GiftedChat compatibility usually handled in route or frontend, 
      // but keeping basic fields here
    };
  }

  async createChat(listingId, participants, offerId = null) {
    // Check if chat exists
    const { data: existingChats, error: searchError } = await supabase
      .from('chats')
      .select('*')
      .eq('listing_id', listingId)
      .contains('participants', participants);

    if (searchError) throw searchError;

    // Filter for exact match of participants if needed, but contains is usually enough for 2 people
    const existingChat = existingChats.find(c => 
        c.participants.length === participants.length && 
        participants.every(p => c.participants.includes(p))
    );

    if (existingChat) {
      return this._toAppModel(existingChat);
    }

    const { data, error } = await supabase
      .from('chats')
      .insert({
        listing_id: listingId,
        participants,
        offer_id: offerId
      })
      .select()
      .single();

    if (error) throw error;
    return this._toAppModel(data);
  }

  async getChatsForUser(userId) {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .contains('participants', [userId])
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data.map(this._toAppModel);
  }

  async getChatById(chatId) {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (error) throw error;
    return this._toAppModel(data);
  }

  async getMessages(chatId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data.map(this._messageToAppModel);
  }

  async sendMessage({ chatId, senderId, content, type = 'text', image = null, schedule = null }) {
    // Insert message
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: senderId,
        content: content,
        image_url: image,
        message_type: type,
        schedule_data: schedule
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Update chat last_message and updated_at
    let lastMsgText = content;
    if (type === 'schedule') lastMsgText = '📅 Pickup Scheduled';
    else if (type === 'schedule_cancellation') lastMsgText = '🚫 Pickup Cancelled';
    else if (type === 'schedule_acceptance') lastMsgText = '✅ Pickup Confirmed';
    else if (type === 'schedule_rejection') lastMsgText = '❌ Pickup Declined';
    else if (!content && image) lastMsgText = 'Sent an image';

    const lastMessage = {
      text: lastMsgText,
      createdAt: message.created_at
    };

    const { error: chatError } = await supabase
      .from('chats')
      .update({
        last_message: lastMessage,
        updated_at: message.created_at
      })
      .eq('id', chatId);

    if (chatError) console.error('Error updating chat last message:', chatError);

    return this._messageToAppModel(message);
  }

  async deleteChatsForListing(listingId) {
    const { data, error } = await supabase
      .from('chats')
      .delete()
      .eq('listing_id', listingId)
      .select();

    if (error) throw error;
    return data ? data.length : 0;
  }
}

module.exports = new ChatService();
