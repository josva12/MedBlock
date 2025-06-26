const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.security('missing_token', null, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl
      });
      return res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists and is active
    const user = await User.findById(decoded.userId).select('-password -twoFactorSecret');
    
    if (!user) {
      logger.security('invalid_token_user_not_found', decoded.userId, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl
      });
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    if (!user.isActive) {
      logger.security('inactive_user_access_attempt', user._id, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl
      });
      return res.status(401).json({
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Attach user to request
    req.user = user;
    
    // Log successful authentication
    logger.audit('user_authenticated', user._id, req.originalUrl, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.security('invalid_token_format', null, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl,
        error: error.message
      });
      return res.status(401).json({
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.security('expired_token', null, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.originalUrl
      });
      return res.status(401).json({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Verify refresh token
 */
const authenticateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    logger.error('Refresh token authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Check if user has required role(s)
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.security('insufficient_role', req.user._id, {
        requiredRoles: allowedRoles,
        userRole,
        ip: req.ip,
        path: req.originalUrl,
        method: req.method
      });
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole
      });
    }

    next();
  };
};

/**
 * Check if user has required permission(s)
 */
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const hasPermission = req.user.hasPermission(resource, action);

    if (!hasPermission) {
      logger.security('insufficient_permission', req.user._id, {
        requiredResource: resource,
        requiredAction: action,
        ip: req.ip,
        path: req.originalUrl,
        method: req.method
      });
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredResource: resource,
        requiredAction: action
      });
    }

    next();
  };
};

/**
 * Check if user can access patient data
 */
const canAccessPatient = (patientIdParam = 'patientId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const patientId = req.params[patientIdParam] || req.body[patientIdParam];
      
      if (!patientId) {
        return res.status(400).json({
          error: 'Patient ID required',
          code: 'MISSING_PATIENT_ID'
        });
      }

      // Admin, doctors, and nurses can access all patients
      if (['admin', 'doctor', 'nurse'].includes(req.user.role)) {
        return next();
      }

      // Other roles need specific permissions
      if (req.user.permissions && req.user.hasPermission('patients', 'read')) {
        return next();
      }

      logger.security('unauthorized_patient_access', req.user._id, {
        patientId,
        userRole: req.user.role,
        ip: req.ip,
        path: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        error: 'Access to patient data not authorized',
        code: 'UNAUTHORIZED_PATIENT_ACCESS'
      });
    } catch (error) {
      logger.error('Patient access check error:', error);
      return res.status(500).json({
        error: 'Access verification failed',
        code: 'ACCESS_VERIFICATION_ERROR'
      });
    }
  };
};

/**
 * Check if user can access medical record
 */
const canAccessMedicalRecord = (recordIdParam = 'recordId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const recordId = req.params[recordIdParam] || req.body[recordIdParam];
      
      if (!recordId) {
        return res.status(400).json({
          error: 'Record ID required',
          code: 'MISSING_RECORD_ID'
        });
      }

      // Admin can access all records
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user has medical records permission
      if (req.user.hasPermission('medical_records', 'read')) {
        return next();
      }

      // Check if user is the creator of the record
      // This would need to be implemented by fetching the record and checking createdBy
      // For now, allow access but log it
      logger.audit('medical_record_access', req.user._id, `record:${recordId}`, {
        ip: req.ip,
        path: req.originalUrl,
        method: req.method
      });

      return next();
    } catch (error) {
      logger.error('Medical record access check error:', error);
      return res.status(500).json({
        error: 'Access verification failed',
        code: 'ACCESS_VERIFICATION_ERROR'
      });
    }
  };
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password -twoFactorSecret');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

/**
 * Rate limiting for authentication endpoints
 */
const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  handler: (req, res) => {
    logger.security('auth_rate_limit_exceeded', null, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl
    });
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 900
    });
  }
};

/**
 * Validate API key for external integrations
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      code: 'MISSING_API_KEY'
    });
  }

  // Validate against stored API keys
  // This would need to be implemented based on your API key management
  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];
  
  if (!validApiKeys.includes(apiKey)) {
    logger.security('invalid_api_key', null, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.originalUrl
    });
    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  authenticateRefreshToken,
  requireRole,
  requirePermission,
  canAccessPatient,
  canAccessMedicalRecord,
  optionalAuth,
  authRateLimit,
  validateApiKey
}; 