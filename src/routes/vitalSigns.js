const express = require('express');
const router = express.Router();
const VitalSign = require('../models/VitalSign');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { validateObjectId } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * @route   POST /api/vital-signs
 * @desc    Create a new vital sign record (draft or final)
 * @access  Private (doctors, nurses, admins)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { patientId, status = 'draft', ...vitalData } = req.body;
    
    // Validate patient ID
    if (!validateObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
        debug: { patientId }
      });
    }
    
    // Check if patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
        debug: { patientId }
      });
    }
    
    // Validate status
    if (!['draft', 'final'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "draft" or "final"',
        debug: { status }
      });
    }
    
    // Create vital sign record
    const vitalSign = new VitalSign({
      patient: patientId,
      recordedBy: req.user.id,
      status,
      ...vitalData
    });
    
    await vitalSign.save();
    
    // Add reference to patient's vital signs array
    await patient.addVitalSignReference(vitalSign._id);
    
    // Populate references for response
    await vitalSign.populate([
      { path: 'patient', select: 'patientId fullName age gender' },
      { path: 'recordedBy', select: 'fullName email' }
    ]);
    
    logger.info('Vital sign created', {
      vitalSignId: vitalSign._id,
      patientId,
      recordedBy: req.user.id,
      status,
      userRole: req.user.role
    });
    
    res.status(201).json({
      success: true,
      message: `Vital sign ${status === 'draft' ? 'draft saved' : 'recorded successfully'}`,
      data: vitalSign.getSummary(),
      debug: {
        vitalSignId: vitalSign._id,
        patientId,
        status,
        recordedAt: vitalSign.recordedAt
      }
    });
    
  } catch (error) {
    logger.error('Error creating vital sign:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors,
        debug: { error: error.message }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug: { error: error.message }
    });
  }
});

/**
 * @route   GET /api/vital-signs
 * @desc    Get vital signs with filtering and pagination
 * @access  Private (doctors, nurses, admins)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      patientId,
      status,
      page = 1,
      limit = 20,
      sortBy = 'recordedAt',
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;
    
    // Build query
    const query = {};
    
    if (patientId) {
      if (!validateObjectId(patientId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid patient ID format',
          debug: { patientId }
        });
      }
      query.patient = patientId;
    }
    
    if (status) {
      if (!['draft', 'final', 'amended'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status filter',
          debug: { status }
        });
      }
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.recordedAt = {};
      if (startDate) query.recordedAt.$gte = new Date(startDate);
      if (endDate) query.recordedAt.$lte = new Date(endDate);
    }
    
    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer',
        debug: { page, pageNum }
      });
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be a positive integer between 1 and 100',
        debug: { limit, limitNum }
      });
    }
    
    // Validate sorting parameters
    const allowedSortFields = [
      'recordedAt', 'status', 'temperature.value', 'bloodPressure.systolic',
      'heartRate', 'oxygenSaturation', 'weight.value', 'height.value', 'bmi'
    ];
    
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sort field',
        debug: { sortBy, allowedSortFields }
      });
    }
    
    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Sort order must be "asc" or "desc"',
        debug: { sortOrder }
      });
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query with pagination
    const skip = (pageNum - 1) * limitNum;
    
    const [vitalSigns, total] = await Promise.all([
      VitalSign.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('patient', 'patientId fullName age gender')
        .populate('recordedBy', 'fullName email')
        .populate('amendedBy', 'fullName email'),
      VitalSign.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(total / limitNum);
    
    logger.info('Vital signs retrieved', {
      userRole: req.user.role,
      query,
      total,
      page: pageNum,
      limit: limitNum
    });
    
    res.json({
      success: true,
      message: 'Vital signs retrieved successfully',
      data: {
        vitalSigns: vitalSigns.map(vs => vs.getSummary()),
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: total,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      },
      debug: {
        query,
        sort,
        skip,
        limit: limitNum,
        total,
        totalPages
      }
    });
    
  } catch (error) {
    logger.error('Error retrieving vital signs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug: { error: error.message }
    });
  }
});

/**
 * @route   GET /api/vital-signs/:id
 * @desc    Get a specific vital sign record
 * @access  Private (doctors, nurses, admins)
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vital sign ID format',
        debug: { id }
      });
    }
    
    const vitalSign = await VitalSign.findById(id)
      .populate('patient', 'patientId fullName age gender bloodType')
      .populate('recordedBy', 'fullName email role')
      .populate('amendedBy', 'fullName email');
    
    if (!vitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Vital sign record not found',
        debug: { id }
      });
    }
    
    logger.info('Vital sign retrieved', {
      vitalSignId: id,
      userRole: req.user.role,
      patientId: vitalSign.patient._id
    });
    
    res.json({
      success: true,
      message: 'Vital sign retrieved successfully',
      data: vitalSign.getSummary(),
      debug: {
        vitalSignId: id,
        patientId: vitalSign.patient._id,
        status: vitalSign.status
      }
    });
    
  } catch (error) {
    logger.error('Error retrieving vital sign:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug: { error: error.message }
    });
  }
});

/**
 * @route   PUT /api/vital-signs/:id
 * @desc    Update a vital sign record (draft only)
 * @access  Private (doctors, nurses, admins)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vital sign ID format',
        debug: { id }
      });
    }
    
    const vitalSign = await VitalSign.findById(id);
    
    if (!vitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Vital sign record not found',
        debug: { id }
      });
    }
    
    // Only allow updates to draft records
    if (vitalSign.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft vital signs can be updated',
        debug: { 
          currentStatus: vitalSign.status,
          vitalSignId: id 
        }
      });
    }
    
    // Remove status from update data to prevent unauthorized status changes
    delete updateData.status;
    delete updateData.patient;
    delete updateData.recordedBy;
    delete updateData.recordedAt;
    
    // Update the vital sign
    Object.assign(vitalSign, updateData);
    await vitalSign.save();
    
    // Populate references for response
    await vitalSign.populate([
      { path: 'patient', select: 'patientId fullName age gender' },
      { path: 'recordedBy', select: 'fullName email' }
    ]);
    
    logger.info('Vital sign updated', {
      vitalSignId: id,
      updatedBy: req.user.id,
      userRole: req.user.role,
      patientId: vitalSign.patient._id
    });
    
    res.json({
      success: true,
      message: 'Vital sign updated successfully',
      data: vitalSign.getSummary(),
      debug: {
        vitalSignId: id,
        patientId: vitalSign.patient._id,
        updatedFields: Object.keys(updateData)
      }
    });
    
  } catch (error) {
    logger.error('Error updating vital sign:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors,
        debug: { error: error.message }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug: { error: error.message }
    });
  }
});

/**
 * @route   PATCH /api/vital-signs/:id/finalize
 * @desc    Mark a draft vital sign as final
 * @access  Private (doctors, nurses, admins)
 */
router.patch('/:id/finalize', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vital sign ID format',
        debug: { id }
      });
    }
    
    const vitalSign = await VitalSign.findById(id);
    
    if (!vitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Vital sign record not found',
        debug: { id }
      });
    }
    
    if (vitalSign.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft vital signs can be finalized',
        debug: { 
          currentStatus: vitalSign.status,
          vitalSignId: id 
        }
      });
    }
    
    // Mark as final
    await vitalSign.markAsFinal();
    
    // Populate references for response
    await vitalSign.populate([
      { path: 'patient', select: 'patientId fullName age gender' },
      { path: 'recordedBy', select: 'fullName email' }
    ]);
    
    logger.info('Vital sign finalized', {
      vitalSignId: id,
      finalizedBy: req.user.id,
      userRole: req.user.role,
      patientId: vitalSign.patient._id
    });
    
    res.json({
      success: true,
      message: 'Vital sign finalized successfully',
      data: vitalSign.getSummary(),
      debug: {
        vitalSignId: id,
        patientId: vitalSign.patient._id,
        finalizedAt: vitalSign.updatedAt
      }
    });
    
  } catch (error) {
    logger.error('Error finalizing vital sign:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug: { error: error.message }
    });
  }
});

/**
 * @route   PATCH /api/vital-signs/:id/amend
 * @desc    Mark a vital sign as amended with reason
 * @access  Private (doctors, nurses, admins)
 */
router.patch('/:id/amend', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vital sign ID format',
        debug: { id }
      });
    }
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Amendment reason is required',
        debug: { reason }
      });
    }
    
    const vitalSign = await VitalSign.findById(id);
    
    if (!vitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Vital sign record not found',
        debug: { id }
      });
    }
    
    if (vitalSign.status === 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Draft vital signs cannot be amended',
        debug: { 
          currentStatus: vitalSign.status,
          vitalSignId: id 
        }
      });
    }
    
    // Mark as amended
    await vitalSign.markAsAmended(req.user.id, reason.trim());
    
    // Populate references for response
    await vitalSign.populate([
      { path: 'patient', select: 'patientId fullName age gender' },
      { path: 'recordedBy', select: 'fullName email' },
      { path: 'amendedBy', select: 'fullName email' }
    ]);
    
    logger.info('Vital sign amended', {
      vitalSignId: id,
      amendedBy: req.user.id,
      userRole: req.user.role,
      patientId: vitalSign.patient._id,
      reason: reason.trim()
    });
    
    res.json({
      success: true,
      message: 'Vital sign amended successfully',
      data: vitalSign.getSummary(),
      debug: {
        vitalSignId: id,
        patientId: vitalSign.patient._id,
        amendedAt: vitalSign.amendedAt,
        reason: reason.trim()
      }
    });
    
  } catch (error) {
    logger.error('Error amending vital sign:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug: { error: error.message }
    });
  }
});

/**
 * @route   DELETE /api/vital-signs/:id
 * @desc    Delete a vital sign record (draft only)
 * @access  Private (doctors, nurses, admins)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!validateObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vital sign ID format',
        debug: { id }
      });
    }
    
    const vitalSign = await VitalSign.findById(id);
    
    if (!vitalSign) {
      return res.status(404).json({
        success: false,
        message: 'Vital sign record not found',
        debug: { id }
      });
    }
    
    // Only allow deletion of draft records
    if (vitalSign.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft vital signs can be deleted',
        debug: { 
          currentStatus: vitalSign.status,
          vitalSignId: id 
        }
      });
    }
    
    // Remove reference from patient
    await Patient.findByIdAndUpdate(
      vitalSign.patient,
      { $pull: { vitalSigns: id } }
    );
    
    // Delete the vital sign
    await VitalSign.findByIdAndDelete(id);
    
    logger.info('Vital sign deleted', {
      vitalSignId: id,
      deletedBy: req.user.id,
      userRole: req.user.role,
      patientId: vitalSign.patient
    });
    
    res.json({
      success: true,
      message: 'Vital sign deleted successfully',
      debug: {
        vitalSignId: id,
        patientId: vitalSign.patient
      }
    });
    
  } catch (error) {
    logger.error('Error deleting vital sign:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug: { error: error.message }
    });
  }
});

/**
 * @route   GET /api/vital-signs/patient/:patientId
 * @desc    Get all vital signs for a specific patient
 * @access  Private (doctors, nurses, admins)
 */
router.get('/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status, limit = 50, sortOrder = 'desc' } = req.query;
    
    if (!validateObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
        debug: { patientId }
      });
    }
    
    // Check if patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
        debug: { patientId }
      });
    }
    
    // Build query
    const query = { patient: patientId };
    
    if (status) {
      if (!['draft', 'final', 'amended'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status filter',
          debug: { status }
        });
      }
      query.status = status;
    }
    
    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be a positive integer between 1 and 100',
        debug: { limit, limitNum }
      });
    }
    
    // Validate sort order
    if (!['asc', 'desc'].includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Sort order must be "asc" or "desc"',
        debug: { sortOrder }
      });
    }
    
    const vitalSigns = await VitalSign.find(query)
      .sort({ recordedAt: sortOrder === 'desc' ? -1 : 1 })
      .limit(limitNum)
      .populate('recordedBy', 'fullName email')
      .populate('amendedBy', 'fullName email');
    
    logger.info('Patient vital signs retrieved', {
      patientId,
      userRole: req.user.role,
      count: vitalSigns.length,
      status
    });
    
    res.json({
      success: true,
      message: 'Patient vital signs retrieved successfully',
      data: {
        patient: {
          _id: patient._id,
          patientId: patient.patientId,
          fullName: patient.fullName,
          age: patient.age,
          gender: patient.gender
        },
        vitalSigns: vitalSigns.map(vs => vs.getSummary()),
        totalCount: vitalSigns.length
      },
      debug: {
        patientId,
        query,
        limit: limitNum,
        sortOrder
      }
    });
    
  } catch (error) {
    logger.error('Error retrieving patient vital signs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      debug: { error: error.message }
    });
  }
});

module.exports = router; 