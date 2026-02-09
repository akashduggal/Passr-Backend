const supabase = require('../config/supabase');

class SupportService {
  // Helper to map DB model to App model
  _toAppModel(ticket) {
    if (!ticket) return null;
    return {
      id: ticket.id,
      userId: ticket.user_id,
      subject: ticket.subject,
      topic: ticket.topic,
      description: ticket.description,
      status: ticket.status,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };
  }

  async createTicket(userId, ticketData) {
    const { subject, topic, description } = ticketData;

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: userId,
        subject,
        topic,
        description,
        status: 'Open'
      })
      .select()
      .single();

    if (error) throw error;
    return this._toAppModel(data);
  }

  async getUserTickets(userId) {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(ticket => this._toAppModel(ticket));
  }
}

module.exports = new SupportService();
