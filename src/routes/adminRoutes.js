const express = require('express');
const router = express.Router();
const User = require('../models/User');
// Assuming you have validateObjectId in ../utils/validation, if not, add it
const { validateObjectId } = require('../utils/validation'); 
const { authenticate, authorize } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { body, validationResult } = require('express-validator'); // Import for validation

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

// --- NEW ROUTE: PATCH /api/v1/admin/users/:id/verify-professional ---
// @route   PATCH /api/v1/admin/users/:id/verify-professional
// @desc    Update a user's professional verification status (Admin only)
// @access  Private (Admin)
router.patch(
  '/users/:id/verify-professional',
  authenticate,
  authorize('admin'),
  [
    body('verificationStatus')
      .notEmpty()
      .isIn(['verified', 'rejected', 'unsubmitted', 'pending'])
      .withMessage('Verification status must be one of: verified, rejected, unsubmitted, pending.'),
    body('rejectionReason')
      .optional()
      .trim()
      .custom((value, { req }) => {
        if (req.body.verificationStatus === 'rejected' && !value) {
          throw new Error('Rejection reason is required when status is rejected.');
        }
        return true;
      }),
    body('notes').optional().trim(),
    // Allow updating license number through this route (admin oversight)
    body('submittedLicenseNumber').optional().trim(),
    body('licensingBody').optional().isIn(['KMPDC', 'NCK', 'PPB', 'other'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          details: errors.array()
        });
      }

      // Admin making the request
      const adminId = req.user._id;
      const userIdToVerify = req.params.id;
      const { verificationStatus, rejectionReason, notes, submittedLicenseNumber, licensingBody } = req.body;

      // Validate userIdToVerify is a valid ObjectId
      if (!validateObjectId(userIdToVerify)) {
        logger.warn(`Invalid ObjectId format received for user professional verification: ${userIdToVerify}`, { adminId: adminId });
        return res.status(400).json({ success: false, error: 'Invalid user ID format.' });
      }

      // Prevent admin from verifying/rejecting their own account
      if (adminId.toString() === userIdToVerify) {
        logger.warn('SECURITY_EVENT: Admin attempted to verify/reject their own account.', { adminId: adminId });
        return res.status(400).json({ success: false, error: 'You cannot modify your own professional verification status.' });
      }

      const user = await User.findById(userIdToVerify);
      if (!user) {
        logger.warn(`Attempt to verify non-existent user with ID: ${userIdToVerify}`, { adminId: adminId });
        return res.status(404).json({ success: false, error: 'User not found.' });
      }

      // Only allow professional verification for 'doctor' and 'nurse' roles
      if (!['doctor', 'nurse'].includes(user.role)) {
        return res.status(400).json({ success: false, message: `User with role '${user.role}' cannot have professional verification status.` });
      }

      // Update the user's professional verification status
      user.professionalVerification.status = verificationStatus;
      user.professionalVerification.rejectionReason = (verificationStatus === 'rejected') ? rejectionReason : undefined;
      user.professionalVerification.notes = notes;
      
      // Update license number/body if provided by admin (e.g., correcting an error)
      if (submittedLicenseNumber !== undefined) {
          user.professionalVerification.submittedLicenseNumber = submittedLicenseNumber;
      }
      if (licensingBody !== undefined) {
          user.professionalVerification.licensingBody = licensingBody;
      }

      if (verificationStatus === 'verified') {
        user.isGovernmentVerified = true;
        user.professionalVerification.verificationDate = new Date();
        user.professionalVerification.verifiedBy = adminId;
      } else {
        user.isGovernmentVerified = false;
        user.professionalVerification.verificationDate = undefined;
        user.professionalVerification.verifiedBy = undefined;
      }
      
      user.updatedBy = adminId;
      user.updatedAt = new Date();

      await user.save();

      logger.audit('professional_verification_updated', adminId, `user:${userIdToVerify}`, {
        userId: userIdToVerify,
        action: `Set professional verification status to ${verificationStatus}`,
        newStatus: verificationStatus,
        adminUser: adminId
      });

      res.status(200).json({
        success: true,
        message: `User's professional verification status updated to '${verificationStatus}'.`,
        data: {
          user: user.getProfile() // Return the full profile after update
        }
      });

    } catch (err) {
      const accessorId = req.user ? req.user._id : 'N/A';
      logger.error('PROFESSIONAL_VERIFICATION_FAILED', { adminId: accessorId, targetId: req.params.id, error: err.message });
      // Handle duplicate key errors if admin tries to set an already existing license number
      if (err.code === 11000) { 
        return res.status(400).json({ success: false, error: 'Duplicate license number. This license is already associated with another user.' });
      }
      res.status(500).json({ success: false, error: 'Server error while updating professional verification status' });
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