const express = require('express');
const router = express.Router();
const supportService = require('../services/supportService');
const authMiddleware = require('../middleware/auth');

// Get all tickets for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tickets = await supportService.getUserTickets(req.user.uid);
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Create a new ticket
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { subject, topic, description } = req.body;
    
    if (!subject || !topic || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ticket = await supportService.createTicket(req.user.uid, {
      subject,
      topic,
      description
    });
    
    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

module.exports = router;
