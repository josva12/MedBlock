const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Middleware to authenticate the user via JWT
exports.authenticate = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Use a try-catch specifically for JWT verification
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Log the decoded payload to help with debugging
      logger.debug('JWT Decoded Successfully', { decoded });

      req.user = await User.findById(decoded.userId).select('-password');

      if (!req.user) {
        logger.warn('SECURITY_EVENT: Authentication failed. User from token not found in DB.', { userId: decoded.userId });
        return res.status(401).json({ error: 'Not authorized, user not found' });
      }

      // Log the user that was successfully attached to the request
      logger.debug('User authenticated and attached to request', { userId: req.user._id, role: req.user.role });
      
      return next(); // Explicitly return next() to stop execution here
    } catch (error) {
      logger.error('SECURITY_EVENT: Token verification failed.', { 
        tokenProvided: !!token,
        error: error.message,
        name: error.name // 'JsonWebTokenError' or 'TokenExpiredError'
      });
      return res.status(401).json({ error: 'Not authorized, token is invalid or expired.' });
    }
  }

  // This block runs if the 'if' condition is false
  logger.warn('SECURITY_EVENT: Authentication failed. No Bearer token provided in header.');
  return res.status(401).json({ error: 'Not authorized, no token provided' });
};

// Middleware to authorize based on user role(s) - Made more crash-proof
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // This check is the most important part to prevent crashes.
    // It ensures that 'authenticate' middleware ran successfully before this.
    if (!req.user || !req.user.role) {
        logger.error('CRITICAL_ERROR: authorize middleware was called without a user on the request. Ensure authenticate middleware runs first.');
        return res.status(500).json({ error: 'Server configuration error. Unable to verify user role.' });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('SECURITY_EVENT: Authorization failed (Forbidden).', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.originalUrl
      });
      return res.status(403).json({ error: 'Forbidden: You do not have permission to perform this action.' });
    }
    
    next();
  };
}; 