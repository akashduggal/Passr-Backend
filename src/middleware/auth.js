const admin = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // Allow mock token for development/testing
  if (process.env.NODE_ENV !== 'production') {
    if (token === 'mock-id-token' || token === 'mock-id-token-for-development-only') {
      req.user = {
        uid: 'dev-user-123',
        email: 'dev@asu.edu',
        name: 'Dev Student',
        picture: null
      };
      return next();
    }
    
    if (token.startsWith('DEV_TOKEN:')) {
      const uid = token.split(':')[1];
      req.user = {
        uid,
        email: `${uid}@test.com`,
        name: 'Dev User',
        picture: null
      };
      return next();
    }
  }

  try {
    // Check if admin app is initialized (in case of missing credentials)
    if (!admin.apps.length) {
      return res.status(500).json({ message: 'Internal Server Error: Firebase not initialized' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(403).json({ message: 'Unauthorized: Invalid token', error: error.message });
  }
};

module.exports = verifyToken;
