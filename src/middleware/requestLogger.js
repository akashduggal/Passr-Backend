const requestLogger = (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  console.log(`\n[${timestamp}] 🔵 REQUEST: ${req.method} ${req.originalUrl}`);
  
  if (Object.keys(req.params).length > 0) {
    console.log('Params:', JSON.stringify(req.params, null, 2));
  }
  
  if (Object.keys(req.query).length > 0) {
    console.log('Query:', JSON.stringify(req.query, null, 2));
  }

  if (req.body && Object.keys(req.body).length > 0) {
    // Mask sensitive fields if necessary (e.g., password)
    const bodyLog = { ...req.body };
    if (bodyLog.password) bodyLog.password = '*****';
    console.log('Body:', JSON.stringify(bodyLog, null, 2));
  }

  // Capture response
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] 🟢 RESPONSE: ${res.statusCode} (${duration}ms)`);
    
    // Attempt to log response body
    try {
      let bodyToLog = body;
      if (typeof body === 'string') {
        try {
          bodyToLog = JSON.parse(body);
        } catch (e) {
          // It's just a string
        }
      }
      console.log('Response:', JSON.stringify(bodyToLog, null, 2));
    } catch (e) {
      console.log('Response (raw):', body);
    }
    console.log('--------------------------------------------------');
    
    return originalSend.call(this, body);
  };

  next();
};

module.exports = requestLogger;
