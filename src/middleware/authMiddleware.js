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

      // IMPORTANT: Populate isGovernmentVerified from the DB directly,
      // as the token's isGovernmentVerified might be stale if updated recently.
      req.user = await User.findById(decoded.userId).select('-password');

      if (!req.user) {
        logger.warn('SECURITY_EVENT: Authentication failed. User from token not found in DB.', { userId: decoded.userId });
        return res.status(401).json({ error: 'Not authorized, user not found' });
      }

      // Log the user that was successfully attached to the request
      logger.debug('User authenticated and attached to request', { 
        userId: req.user._id, 
        role: req.user.role,
        isGovernmentVerified: req.user.isGovernmentVerified 
      });
      
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

// Alias for authenticate (for backward compatibility)
exports.authenticateToken = exports.authenticate;

// Middleware to authorize based on user role(s) - Made more crash-proof
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // This check is the most important part to prevent crashes.
    // It ensures that 'authenticate' middleware ran successfully before this.
    if (!req.user || !req.user.role) {
        logger.error('CRITICAL_ERROR: authorize middleware was called without a user on the request. Ensure authenticate middleware runs first.');
        return res.status(500).json({ error: 'Server configuration error. User authorization missing.' });
    }

    // --- ADD DEBUG LOGGING ---
    console.log('--- authorize Middleware Debug ---');
    console.log('req.user.role:', req.user.role);
    console.log('required roles:', roles);
    console.log('roles.includes(req.user.role):', roles.includes(req.user.role));
    console.log('--- End authorize Debug ---');
    // --- END DEBUG LOGGING ---

    if (roles.includes(req.user.role)) {
      return next();
    }

    logger.warn('SECURITY_EVENT: Unauthorized access attempt.', {
      userId: req.user._id,
      userRole: req.user.role,
      requiredRoles: roles,
      path: req.originalUrl
    });

    return res.status(403).json({ 
      error: 'Forbidden: You do not have permission to access this resource.',
      details: `Required roles: ${roles.join(', ')}. Your role: ${req.user.role}.`
    });
  };
};

// Alias for authorize (for backward compatibility)
exports.requireRole = (allowedRoles) => {
  // Ensure allowedRoles is always an array to prevent runtime errors with .includes()
  if (!Array.isArray(allowedRoles)) {
    logger.error('CRITICAL_ERROR: requireRole middleware called with non-array roles. Defaulting to no roles allowed.', { providedRoles: allowedRoles });
    allowedRoles = []; // Set to empty array to safely proceed or block
  }

  // Return the actual Express middleware function
  return (req, res, next) => {
    // Crucial check: Ensure req.user is populated by authenticateToken before proceeding
    if (!req.user || !req.user.role) {
        logger.error('CRITICAL_ERROR: requireRole middleware was called without a user on the request. Ensure authenticateToken middleware runs first.');
        return res.status(500).json({ error: 'Server configuration error. Unable to verify user role.' });
    }

    // --- requireRole Middleware Debug ---
    // These logs are crucial for debugging role checks
    console.log('--- requireRole Middleware Debug ---');
    console.log('req.user.role (from token):', req.user.role);
    console.log('allowedRoles (param passed to requireRole):', allowedRoles); 
    console.log('Is user role included in allowed roles?:', allowedRoles.includes(req.user.role));
    console.log('--- End requireRole Debug ---');

    // Check if the user's role is included in the list of allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('SECURITY_EVENT: Authorization failed (Forbidden).', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.originalUrl // Log the path of the blocked request
      });
      return res.status(403).json({ error: 'Forbidden: You do not have permission to access this resource.' });
    }

    // If authorized, proceed to the next middleware/route handler
    next();
  };
};

// --- NEW MIDDLEWARE: isGovernmentVerifiedProfessional ---
// Middleware to enforce that certain actions can only be performed by
// government-verified doctors or nurses.
exports.isGovernmentVerifiedProfessional = (req, res, next) => {
  // Ensure authenticate middleware has run and req.user is available
  if (!req.user) {
    logger.error('CRITICAL_ERROR: isGovernmentVerifiedProfessional middleware called before authenticate.');
    return res.status(500).json({ error: 'Server configuration error. User authentication missing.' });
  }

  // --- ADD THESE CONSOLE.LOGS ---
  console.log('--- isGovernmentVerifiedProfessional Middleware Debug ---');
  console.log('req.user.role:', req.user.role);
  console.log('req.user.isGovernmentVerified:', req.user.isGovernmentVerified);
  console.log('req.user.professionalVerification.status:', req.user.professionalVerification?.status); // Use optional chaining
  console.log('--- End Debug ---');
  // --- END ADDED CONSOLE.LOGS ---

  const { role, isGovernmentVerified } = req.user;

  // Only apply this check to 'doctor' and 'nurse' roles
  if (role === 'doctor' || role === 'nurse') {
    if (!isGovernmentVerified) { // This is the core check
      logger.warn('SECURITY_EVENT: Non-verified professional attempted restricted action.', {
        userId: req.user._id,
        userRole: role,
        isGovernmentVerified: isGovernmentVerified,
        path: req.originalUrl
      });
      return res.status(403).json({ 
        error: 'Forbidden: You must be a government-verified professional to perform this action.',
        details: 'Please ensure your professional verification status is "verified".'
      });
    }
  }

  // For other roles (admin, front-desk) or for verified professionals, proceed
  next();
};

// --- PATIENT ACCESS CONTROL MIDDLEWARE ---
// Middleware to check if user can access a specific patient
exports.canAccessPatient = (patientIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const patientId = req.params[patientIdParam];
      
      if (!patientId) {
        return res.status(400).json({
          error: 'Patient ID is required',
          code: 'MISSING_PATIENT_ID'
        });
      }

      // Validate ObjectId format
      if (!require('mongoose').Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({
          error: 'Invalid patient ID format',
          code: 'INVALID_PATIENT_ID'
        });
      }

      // Import Patient model here to avoid circular dependencies
      const Patient = require('../models/Patient');
      
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        return res.status(404).json({
          error: 'Patient not found',
          code: 'PATIENT_NOT_FOUND'
        });
      }

      // Check if user has access to this patient
      // Admins and doctors can access all patients
      if (req.user.role === 'admin' || req.user.role === 'doctor') {
        return next();
      }

      // Nurses can access patients assigned to their department
      if (req.user.role === 'nurse') {
        if (patient.assignedDepartment === req.user.department) {
          return next();
        }
      }

      // Front desk can access patients they created
      if (req.user.role === 'front-desk') {
        if (patient.createdBy && patient.createdBy.toString() === req.user._id.toString()) {
          return next();
        }
      }

      logger.warn('SECURITY_EVENT: Unauthorized patient access attempt.', {
        userId: req.user._id,
        userRole: req.user.role,
        patientId: patientId,
        path: req.originalUrl
      });

      return res.status(403).json({
        error: 'Forbidden: You do not have permission to access this patient.',
        code: 'PATIENT_ACCESS_DENIED'
      });
    } catch (error) {
      logger.error('Error in canAccessPatient middleware:', error);
      return res.status(500).json({
        error: 'Internal server error during patient access check',
        code: 'PATIENT_ACCESS_ERROR'
      });
    }
  };
};

// --- REFRESH TOKEN MIDDLEWARE ---
// Middleware to authenticate refresh tokens
exports.authenticateRefreshToken = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

      req.user = await User.findById(decoded.userId).select('-password');
      if (!req.user) {
        return res.status(401).json({ error: 'Not authorized, user not found' });
      }

      return next();
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      return res.status(401).json({ error: 'Not authorized, refresh token is invalid or expired.' });
    }
  }

  return res.status(401).json({ error: 'Not authorized, no refresh token provided' });
};

// --- RATE LIMITING CONFIGURATION ---
// Rate limiting configuration for auth endpoints
exports.authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
}; 