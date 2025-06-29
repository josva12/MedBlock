console.log('✅ Auth router (src/routes/auth.js) loaded');
const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { authenticateToken, authenticateRefreshToken, authRateLimit } = require('../middleware/authMiddleware');
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
  body('title').isIn(['Dr.', 'Prof.', 'Mr.', 'Mrs.', 'Ms.', 'Nurse', 'Pharm.', 'Tech.']),
  // NEW: Optional fields for professional verification submission during registration
  body('submittedLicenseNumber')
    .optional()
    .trim()
    .custom((value, { req }) => {
      // Only require license number if role is doctor or nurse and value is provided
      if (['doctor', 'nurse'].includes(req.body.role) && value) {
        // Basic length check, specific format regex can be added here if known
        if (value.length < 5 || value.length > 50) {
          throw new Error('License number must be between 5 and 50 characters.');
        }
      }
      return true;
    }),
  body('licensingBody')
    .optional()
    .isIn(['KMPDC', 'NCK', 'PPB', 'other'])
    .withMessage('Invalid licensing body. Must be KMPDC, NCK, PPB, or other.')
    .custom((value, { req }) => {
      // If a licensingBody is provided, a submittedLicenseNumber must also be provided
      if (value && !req.body.submittedLicenseNumber) {
        throw new Error('License number is required if licensing body is specified.');
      }
      return true;
    })
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

// --- NEW DIAGNOSTIC ENDPOINT ---
// @route   GET /api/v1/auth/test-token
// @desc    Test if authentication token is valid and user object is attached
// @access  Private (requires valid token)
router.get('/test-token', authenticateToken, (req, res) => {
  logger.info('TEST_TOKEN_ENDPOINT_HIT', { userId: req.user._id, role: req.user.role });
  res.json({
    success: true,
    message: 'Token is valid and user attached!',
    data: {
      userId: req.user._id,
      email: req.user.email,
      role: req.user.role,
      isGovernmentVerified: req.user.isGovernmentVerified,
      professionalVerificationStatus: req.user.professionalVerification?.status // Access with optional chaining
    }
  });
});
// --- END NEW DIAGNOSTIC ENDPOINT ---

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
      licenseNumber, // This is the old field, we will handle professionalVerification.submittedLicenseNumber instead
      submittedLicenseNumber, // NEW field from request body
      licensingBody, // NEW field from request body
      address
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email }, 
        { phone },
        // NEW: Check for existing professional registration if provided
        (submittedLicenseNumber && licensingBody) ? { 
            'professionalVerification.submittedLicenseNumber': submittedLicenseNumber,
            'professionalVerification.licensingBody': licensingBody 
        } : {} // Empty object means no additional query if no license info
      ]
    });

    if (existingUser) {
        // More specific error messages for clarity
        if (existingUser.email === email) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        if (existingUser.phone === phone) {
            return res.status(400).json({ error: 'User with this phone number already exists' });
        }
        if (submittedLicenseNumber && licensingBody && 
            existingUser.professionalVerification && 
            existingUser.professionalVerification.submittedLicenseNumber === submittedLicenseNumber &&
            existingUser.professionalVerification.licensingBody === licensingBody) {
            return res.status(400).json({ error: 'A user with this professional license number is already registered.' });
        }
        // Fallback for other cases
        return res.status(400).json({
          error: 'User with provided credentials already exists'
        });
    }

    // Prepare professionalVerification object for new user
    const professionalVerificationData = {};
    if (['doctor', 'nurse'].includes(role) && submittedLicenseNumber && licensingBody) {
        professionalVerificationData.status = 'pending'; // Auto-set to pending for review
        professionalVerificationData.submittedLicenseNumber = submittedLicenseNumber;
        professionalVerificationData.licensingBody = licensingBody;
        professionalVerificationData.submissionDate = new Date();
    } else if (['doctor', 'nurse'].includes(role)) {
        professionalVerificationData.status = 'unsubmitted'; // Doctor/Nurse without license info
    }
    // For other roles (admin, front-desk), professionalVerification will default to 'unsubmitted' by schema

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
      // Remove the old licenseNumber field from direct assignment unless it's explicitly part of req.body
      // licenseNumber: licenseNumber, // This field is now redundant with professionalVerification.submittedLicenseNumber
      address,
      createdBy: req.user?._id, // If an admin is creating a user, req.user will be available
      // NEW: Assign the professionalVerification sub-document
      professionalVerification: professionalVerificationData 
    });

    await user.save();

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();

    logger.audit('user_registered', user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      createdBy: req.user?._id,
      role: user.role,
      professionalVerificationStatus: user.professionalVerification.status // Log the initial verification status
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.getSummary(), // Use getSummary which now includes new verification flags
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    });
  } catch (error) {
    logger.error('Registration failed:', error);
    // Handle duplicate key errors specifically (e.g., for professionalVerification.submittedLicenseNumber)
    if (error.code === 11000) { // MongoDB duplicate key error
        // Extract the duplicated field name from the error message
        const field = Object.keys(error.keyValue)[0];
        let errorMessage = `A user with this ${field} already exists.`;
        if (field.includes('professionalVerification.submittedLicenseNumber')) {
            errorMessage = 'A user with this professional license number and licensing body is already registered.';
        }
        return res.status(400).json({
            error: 'Duplicate entry',
            details: errorMessage
        });
    }
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
    
    // Use the new getProfile method, which returns the full user object
    // Then, based on the role, we decide what to expose
    if (user.role === 'admin' || user.role === 'doctor' || user.role === 'nurse') {
        // Admin, Doctor, Nurse can see their full professionalVerification details
        res.json({
            success: true,
            data: {
                user: user.getProfile() // Full profile including professionalVerification
            }
        });
    } else {
        // Other roles only get the summary
        res.json({
            success: true,
            data: {
                user: user.getSummary() // Standard summary
            }
        });
    }

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
  body('address').optional().isObject(),
  // NEW: Allow updating professionalVerification fields via /me endpoint
  body('professionalVerification.submittedLicenseNumber')
    .optional()
    .trim()
    .custom((value, { req }) => {
      if (['doctor', 'nurse'].includes(req.user.role) && value) {
        if (value.length < 5 || value.length > 50) {
          throw new Error('License number must be between 5 and 50 characters.');
        }
      }
      return true;
    }),
  body('professionalVerification.licensingBody')
    .optional()
    .isIn(['KMPDC', 'NCK', 'PPB', 'other'])
    .withMessage('Invalid licensing body. Must be KMPDC, NCK, PPB, or other.')
    .custom((value, { req }) => {
      if (value && !req.body.professionalVerification?.submittedLicenseNumber) {
        throw new Error('License number is required if licensing body is specified.');
      }
      return true;
    }),
  body('professionalVerification.notes') // For admins updating notes on a user's profile
    .optional()
    .trim()
    .custom((value, { req }) => {
        // Only allow notes update by admins
        if (value && req.user.role !== 'admin') {
            throw new Error('Only administrators can add verification notes.');
        }
        return true;
    })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { fullName, phone, address, professionalVerification } = req.body;
    const user = await User.findById(req.user._id);

    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (address) user.address = { ...user.address, ...address };

    // Handle updating professionalVerification fields
    if (user.role === 'doctor' || user.role === 'nurse') {
        // Only allow submitting for verification if status is 'unsubmitted' or 'rejected'
        if (professionalVerification && professionalVerification.submittedLicenseNumber && professionalVerification.licensingBody) {
            // If they are submitting for the first time or re-submitting after rejection
            if (user.professionalVerification.status === 'unsubmitted' || user.professionalVerification.status === 'rejected') {
                user.professionalVerification.submittedLicenseNumber = professionalVerification.submittedLicenseNumber;
                user.professionalVerification.licensingBody = professionalVerification.licensingBody;
                user.professionalVerification.status = 'pending';
                user.professionalVerification.submissionDate = new Date();
                // Clear rejection reason if re-submitting
                user.professionalVerification.rejectionReason = undefined; 
                user.isGovernmentVerified = false; // Reset verified status upon re-submission
            } else if (user.professionalVerification.status === 'pending') {
                // Allow updating license number if already pending, e.g., correction
                user.professionalVerification.submittedLicenseNumber = professionalVerification.submittedLicenseNumber;
                user.professionalVerification.licensingBody = professionalVerification.licensingBody;
                // No change to status or submissionDate unless explicitly re-submitting.
            } else if (user.professionalVerification.status === 'verified') {
                // If already verified, do not allow changing license number via /me (requires admin interaction)
                return res.status(403).json({
                    success: false,
                    message: 'Professional verification details cannot be changed once verified. Please contact an administrator.'
                });
            }
        }
    }

    // Admins can update notes for any user via this endpoint, if the request is from an admin
    if (req.user.role === 'admin' && professionalVerification && professionalVerification.notes !== undefined) {
        user.professionalVerification.notes = professionalVerification.notes;
    }


    user.updatedBy = req.user._id;
    await user.save();

    logger.audit('profile_updated', user._id, 'auth', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      updatedFields: Object.keys(req.body)
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
    // Handle duplicate key errors specifically for licenseNumber
    if (error.code === 11000) { // MongoDB duplicate key error
        const field = Object.keys(error.keyValue)[0];
        let errorMessage = `A user with this ${field} already exists.`;
        if (field.includes('professionalVerification.submittedLicenseNumber')) {
            errorMessage = 'A user with this professional license number and licensing body is already registered.';
        }
        return res.status(400).json({
            error: 'Duplicate entry',
            details: errorMessage
        });
    }
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
    const isMatch = await user.matchPassword(currentPassword);
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
 