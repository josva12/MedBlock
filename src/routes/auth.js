console.log('✅ Auth router (src/routes/auth.js) loaded');
const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { authenticateToken, authenticateRefreshToken, authRateLimit } = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit(authRateLimit);

// Validation middleware
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 })
];

const validateRegister = [
  body('fullName').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  body('role').isIn(['doctor', 'nurse', 'admin', 'front-desk']),
  body('phone').matches(/^(\+254|0)[17]\d{8}$/),
  body('title').isIn(['Dr.', 'Prof.', 'Mr.', 'Mrs.', 'Ms.', 'Nurse', 'Pharm.', 'Tech.'])
];

const validatePasswordReset = [
  body('email').isEmail().normalizeEmail()
];

const validateNewPassword = [
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
];

// Diagnostic GET route for router testing
router.get('/ping-auth', (req, res) => {
  console.log('PING-AUTH route hit in auth router');
  res.send('pong from auth router');
});

console.log('🔶 Defining POST /register in auth router');
// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, validateRegister, async (req, res) => {
  console.log('🔶 POST /register handler reached!');
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      fullName,
      email,
      password,
      role,
      phone,
      title,
      specialization,
      department,
      licenseNumber,
      address
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email or phone number already exists'
      });
    }

    // Create new user
    const user = new User({
      fullName,
      email,
      password,
      role,
      phone,
      title,
      specialization,
      department,
      licenseNumber,
      address,
      createdBy: req.user?._id
    });

    await user.save();

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    logger.audit('user_registered', user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      createdBy: req.user?._id
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.getSummary(),
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    });
  } catch (error) {
    logger.error('Registration failed:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message
    });
  }
});

// @route   POST /api/v1/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Authenticate user
    const user = await User.authenticate(email, password);
    
    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    logger.audit('user_login', user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getSummary(),
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(401).json({
      error: error.message || 'Authentication failed'
    });
  }
});

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', authenticateRefreshToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Generate new tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    logger.audit('token_refreshed', user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    });
  } catch (error) {
    logger.error('Token refresh failed:', error);
    res.status(500).json({
      error: 'Token refresh failed'
    });
  }
});

// @route   POST /api/v1/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    logger.audit('user_logout', req.user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout failed:', error);
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

// @route   POST /api/v1/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', authLimiter, validatePasswordReset, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // TODO: Send email with reset link
    // For now, just log it
    logger.info('Password reset requested', {
      userId: user._id,
      email: user.email,
      resetToken
    });

    logger.audit('password_reset_requested', user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  } catch (error) {
    logger.error('Password reset request failed:', error);
    res.status(500).json({
      error: 'Password reset request failed'
    });
  }
});

// @route   POST /api/v1/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', authLimiter, validateNewPassword, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset token'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.audit('password_reset_completed', user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    logger.error('Password reset failed:', error);
    res.status(500).json({
      error: 'Password reset failed'
    });
  }
});

// @route   GET /api/v1/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -passwordResetToken');
    
    res.json({
      success: true,
      data: {
        user: user.getSummary()
      }
    });
  } catch (error) {
    logger.error('Get profile failed:', error);
    res.status(500).json({
      error: 'Failed to get profile'
    });
  }
});

// @route   PUT /api/v1/auth/me
// @desc    Update current user profile
// @access  Private
router.put('/me', authenticateToken, [
  body('fullName').optional().trim().isLength({ min: 2, max: 100 }),
  body('phone').optional().matches(/^(\+254|0)[17]\d{8}$/),
  body('address').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { fullName, phone, address } = req.body;
    const user = await User.findById(req.user._id);

    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (address) user.address = { ...user.address, ...address };

    user.updatedBy = req.user._id;
    await user.save();

    logger.audit('profile_updated', user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.getSummary()
      }
    });
  } catch (error) {
    logger.error('Profile update failed:', error);
    res.status(500).json({
      error: 'Profile update failed'
    });
  }
});

// @route   POST /api/v1/auth/change-password
// @desc    Change password
// @access  Private
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    user.updatedBy = req.user._id;
    await user.save();

    logger.audit('password_changed', user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Password change failed:', error);
    res.status(500).json({
      error: 'Password change failed'
    });
  }
});

module.exports = router; 