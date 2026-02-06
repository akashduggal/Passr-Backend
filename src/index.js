const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const listingRoutes = require('./routes/listings');
const offerRoutes = require('./routes/offers');
const chatRoutes = require('./routes/chat');
const requestLogger = require('./middleware/requestLogger');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/auth', authRoutes); // Keep existing auth routes
app.use('/api/users', userRoutes); // Add user routes under /api/users
app.use('/api/listings', listingRoutes); // Add listing routes under /api/listings
app.use('/api/offers', offerRoutes); // Add offer routes under /api/offers
app.use('/api/chats', chatRoutes); // Add chat routes under /api/chats

app.get('/', (req, res) => {
  res.send('Passr Backend is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
