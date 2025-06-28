const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const logger = require('../utils/logger');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware
const validateUser = [
  body('fullName').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['doctor', 'nurse', 'admin', 'front-desk']),
  body('phone').matches(/^(\+254|0)[17]\d{8}$/),
  body('title').isIn(['Dr.', 'Prof.', 'Mr.', 'Mrs.', 'Ms.', 'Nurse', 'Pharm.', 'Tech.']),
  body('address.county').isIn([
    'Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita Taveta', 'Garissa', 'Wajir', 'Mandera',
    'Marsabit', 'Isiolo', 'Meru', 'Tharaka Nithi', 'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua',
    'Nyeri', 'Kirinyaga', 'Murang\'a', 'Kiambu', 'Turkana', 'West Pokot', 'Samburu', 'Trans Nzoia',
    'Uasin Gishu', 'Elgeyo Marakwet', 'Nandi', 'Baringo', 'Laikipia', 'Nakuru', 'Narok', 'Kajiado',
    'Kericho', 'Bomet', 'Kakamega', 'Vihiga', 'Bungoma', 'Busia', 'Siaya', 'Kisumu', 'Homa Bay',
    'Migori', 'Kisii', 'Nyamira', 'Nairobi'
  ]),
  body('address.subCounty').trim().notEmpty()
];

const validatePassword = [
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
];

// GET /api/v1/users - Get ALL registered users (admin only)
router.get(
  '/',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      // Additional safety check for req.user
      if (!req.user || !req.user._id) {
        logger.error('CRITICAL_ERROR: req.user is not properly set in users route');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const users = await User.find({}).select('-password');
      logger.audit('FETCH_ALL_USERS_SUCCESS', req.user._id, 'All Users List');
      res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
      const accessorId = req.user ? req.user._id : 'N/A';
      logger.error('FETCH_ALL_USERS_FAILED', { userId: accessorId, error: err.message });
      res.status(500).json({ error: 'Server error while fetching users' });
    }
  }
);

// GET /api/v1/users/me - Get current user profile
router.get('/me', authenticate, (req, res) => {
  try {
    // Additional safety check for req.user
    if (!req.user) {
      logger.error('CRITICAL_ERROR: req.user is not properly set in /me route');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    res.status(200).json({ success: true, data: req.user });
  } catch (err) {
    logger.error('FETCH_USER_PROFILE_FAILED', { error: err.message });
    res.status(500).json({ error: 'Server error while fetching user profile' });
  }
});

// @route   GET /api/v1/users/:id
// @desc    Get user by ID
// @access  Private (Admin or self)
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findOne({ 
      $or: [
        { userId: req.params.id },
        { _id: req.params.id }
      ]
    }).select('-password -passwordResetToken');

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Hardened authorization check
    if (req.user.role !== 'admin' && user._id.toString() !== req.user._id.toString()) {
      logger.warn('SECURITY_EVENT: Unauthorized access attempt on user profile.', {
        accessorId: req.user._id,
        targetId: req.params.id
      });
      return res.status(403).json({ error: 'Forbidden: You do not have permission to access this resource.' });
    }

    logger.audit('FETCH_USER_SUCCESS', req.user._id, `User ID: ${user._id}`);
    res.json({
      success: true,
      data: user.getSummary()
    });
  } catch (error) {
    logger.error('Get user failed:', error);
    res.status(500).json({
      error: 'Failed to get user'
    });
  }
});

// @route   POST /api/v1/users
// @desc    Create a new user
// @access  Private (Admin only)
router.post('/', requireRole(['admin']), validateUser, validatePassword, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: req.body.email },
        { phone: req.body.phone },
        { licenseNumber: req.body.licenseNumber }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email, phone, or license number already exists'
      });
    }

    // Create user
    const user = new User({
      ...req.body,
      createdBy: req.user._id
    });

    await user.save();

    logger.audit('user_created', req.user.userId, `user:${user.userId}`, {
      createdUserId: user.userId,
      createdUserRole: user.role
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: user.getSummary()
      }
    });
  } catch (error) {
    logger.error('Create user failed:', error);
    res.status(500).json({
      error: 'Failed to create user',
      details: error.message
    });
  }
});

// @route   PUT /api/v1/users/:id
// @desc    Update user
// @access  Private (Admin or self)
router.put('/:id', validateUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Users can only update their own profile unless they're admin
    if (req.params.id !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const user = await User.findOne({ 
      $or: [
        { userId: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check for duplicate email/phone if being updated
    if (req.body.email || req.body.phone || req.body.licenseNumber) {
      const existingUser = await User.findOne({
        $and: [
          {
            $or: [
              { email: req.body.email || user.email },
              { phone: req.body.phone || user.phone },
              { licenseNumber: req.body.licenseNumber || user.licenseNumber }
            ]
          },
          { _id: { $ne: user._id } }
        ]
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'User with this email, phone, or license number already exists'
        });
      }
    }

    // Update user
    const updateFields = [
      'fullName', 'title', 'specialization', 'department', 'phone', 'address',
      'bio', 'workSchedule', 'permissions', 'assignedFacilities'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    // Only admin can update role and license
    if (req.user.role === 'admin') {
      if (req.body.role) user.role = req.body.role;
      if (req.body.licenseNumber) user.licenseNumber = req.body.licenseNumber;
      if (req.body.licenseExpiry) user.licenseExpiry = req.body.licenseExpiry;
      if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
      if (req.body.isVerified !== undefined) user.isVerified = req.body.isVerified;
    }

    user.updatedBy = req.user._id;
    await user.save();

    logger.audit('user_updated', req.user.userId, `user:${user.userId}`, {
      updatedUserId: user.userId
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: user.getSummary()
      }
    });
  } catch (error) {
    logger.error('Update user failed:', error);
    res.status(500).json({
      error: 'Failed to update user'
    });
  }
});

// @route   DELETE /api/v1/users/:id
// @desc    Delete user (soft delete)
// @access  Private (Admin only)
router.delete('/:id', requireRole(['admin']), async (req, res) => {
  try {
    const user = await User.findOne({ 
      $or: [
        { userId: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        error: 'Cannot delete your own account'
      });
    }

    // Soft delete
    user.isActive = false;
    user.updatedBy = req.user._id;
    await user.save();

    logger.audit('user_deleted', req.user.userId, `user:${user.userId}`, {
      deletedUserId: user.userId,
      deletedUserRole: user.role
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Delete user failed:', error);
    res.status(500).json({
      error: 'Failed to delete user'
    });
  }
});

// @route   GET /api/v1/users/role/:role
// @desc    Get users by role
// @access  Private (Admin, Doctor)
router.get('/role/:role', requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    const { role } = req.params;
    const options = {};
    
    if (req.query.isActive !== undefined) {
      options.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.department) {
      options.department = req.query.department;
    }

    const users = await User.findByRole(role, options);

    logger.audit('users_by_role_listed', req.user.userId, 'users', {
      role,
      count: users.length
    });

    res.json({
      success: true,
      data: {
        users: users.map(u => u.getSummary())
      }
    });
  } catch (error) {
    logger.error('Get users by role failed:', error);
    res.status(500).json({
      error: 'Failed to get users by role'
    });
  }
});

// @route   GET /api/v1/users/facility/:facilityId
// @desc    Get users by facility
// @access  Private (Admin, Doctor)
router.get('/facility/:facilityId', requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    const { facilityId } = req.params;
    const options = {};
    
    if (req.query.role) {
      options.role = req.query.role;
    }
    
    if (req.query.isActive !== undefined) {
      options.isActive = req.query.isActive === 'true';
    }

    const users = await User.findByFacility(facilityId, options);

    logger.audit('users_by_facility_listed', req.user.userId, 'users', {
      facilityId,
      count: users.length
    });

    res.json({
      success: true,
      data: {
        users: users.map(u => u.getSummary())
      }
    });
  } catch (error) {
    logger.error('Get users by facility failed:', error);
    res.status(500).json({
      error: 'Failed to get users by facility'
    });
  }
});

// @route   GET /api/v1/users/statistics/overview
// @desc    Get user statistics
// @access  Private (Admin only)
router.get('/statistics/overview', requireRole(['admin']), async (req, res) => {
  try {
    const stats = await User.getStatistics();

    res.json({
      success: true,
      data: {
        statistics: stats
      }
    });
  } catch (error) {
    logger.error('Get user statistics failed:', error);
    res.status(500).json({
      error: 'Failed to get user statistics'
    });
  }
});

// @route   POST /api/v1/users/:id/reset-password
// @desc    Reset user password (Admin only)
// @access  Private (Admin only)
router.post('/:id/reset-password', requireRole(['admin']), validatePassword, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const user = await User.findOne({ 
      $or: [
        { userId: req.params.id },
        { _id: req.params.id }
      ]
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Update password
    user.password = req.body.password;
    user.updatedBy = req.user._id;
    await user.save();

    logger.audit('user_password_reset', req.user.userId, `user:${user.userId}`, {
      resetUserId: user.userId
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error('Reset user password failed:', error);
    res.status(500).json({
      error: 'Failed to reset password'
    });
  }
});

module.exports = router; 