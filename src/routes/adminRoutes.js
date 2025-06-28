const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// GET /api/v1/admin/admins - List all admin users
router.get(
  '/admins',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      // Additional safety check for req.user
      if (!req.user || !req.user._id) {
        logger.error('CRITICAL_ERROR: req.user is not properly set in admin route');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const admins = await User.find({ role: 'admin' }).select('-password');
      logger.audit('FETCH_ADMINS_SUCCESS', req.user._id, 'Admins List');
      res.status(200).json({ success: true, count: admins.length, data: admins });
    } catch (err) {
      const accessorId = req.user ? req.user._id : 'N/A';
      logger.error('FETCH_ADMINS_FAILED', { userId: accessorId, error: err.message });
      res.status(500).json({ error: 'Server error while fetching admins' });
    }
  }
);

// DELETE /api/v1/admin/users/:id - Delete any user (admin only, not self)
router.delete(
  '/users/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      // Additional safety check for req.user
      if (!req.user || !req.user._id) {
        logger.error('CRITICAL_ERROR: req.user is not properly set in admin delete route');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const userToDeleteId = req.params.id;
      if (req.user._id.toString() === userToDeleteId) {
        logger.warn('SECURITY_EVENT: Admin attempted self-deletion via admin route.', { adminId: req.user._id });
        return res.status(400).json({ error: 'You cannot delete your own admin account.' });
      }
      const user = await User.findById(userToDeleteId);
      if (!user) {
        return res.status(404).json({ error: 'User not found with that ID.' });
      }
      await user.deleteOne();
      logger.audit('ADMIN_DELETE_USER_SUCCESS', req.user._id, `Deleted User ID: ${userToDeleteId}`);
      res.status(200).json({ success: true, message: `User with ID ${userToDeleteId} has been successfully deleted.` });
    } catch (err) {
      const accessorId = req.user ? req.user._id : 'N/A';
      logger.error('ADMIN_DELETE_USER_FAILED', { adminId: accessorId, targetId: req.params.id, error: err.message });
      res.status(500).json({ error: 'Server error while deleting user' });
    }
  }
);

module.exports = router; 