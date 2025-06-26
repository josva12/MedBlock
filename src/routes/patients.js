const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, canAccessPatient } = require('../middleware/auth');
const Patient = require('../models/Patient');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware
const validatePatient = [
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('lastName').trim().isLength({ min: 2, max: 50 }),
  body('dateOfBirth').isISO8601().toDate(),
  body('gender').isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  body('nationalId').optional().matches(/^\d{8}$/),
  body('phoneNumber').matches(/^(\+254|0)[17]\d{8}$/),
  body('email').optional().isEmail().normalizeEmail(),
  body('address.county').isIn([
    'Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita Taveta', 'Garissa', 'Wajir', 'Mandera',
    'Marsabit', 'Isiolo', 'Meru', 'Tharaka Nithi', 'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua',
    'Nyeri', 'Kirinyaga', 'Murang\'a', 'Kiambu', 'Turkana', 'West Pokot', 'Samburu', 'Trans Nzoia',
    'Uasin Gishu', 'Elgeyo Marakwet', 'Nandi', 'Baringo', 'Laikipia', 'Nakuru', 'Narok', 'Kajiado',
    'Kericho', 'Bomet', 'Kakamega', 'Vihiga', 'Bungoma', 'Busia', 'Siaya', 'Kisumu', 'Homa Bay',
    'Migori', 'Kisii', 'Nyamira', 'Nairobi'
  ]),
  body('address.subCounty').trim().notEmpty(),
  body('address.ward').trim().notEmpty(),
  body('bloodType').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'])
];

const validateVitalSigns = [
  body('bloodPressure.systolic').isInt({ min: 70, max: 200 }),
  body('bloodPressure.diastolic').isInt({ min: 40, max: 130 }),
  body('temperature').isFloat({ min: 35, max: 42 }),
  body('pulse').isInt({ min: 40, max: 200 }),
  body('respiratoryRate').optional().isInt({ min: 8, max: 40 }),
  body('oxygenSaturation').optional().isInt({ min: 70, max: 100 }),
  body('weight').optional().isFloat({ min: 1, max: 300 }),
  body('height').optional().isFloat({ min: 50, max: 250 })
];

const validateAllergy = [
  body('allergen').trim().notEmpty(),
  body('severity').isIn(['mild', 'moderate', 'severe']),
  body('reaction').optional().trim(),
  body('notes').optional().trim()
];

// @route   GET /api/v1/patients
// @desc    Get all patients with pagination and filtering
// @access  Private
router.get('/', requireRole(['admin', 'doctor', 'nurse']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { patientId: searchRegex },
        { nationalId: searchRegex },
        { phoneNumber: searchRegex }
      ];
    }

    if (req.query.county) {
      query['address.county'] = req.query.county;
    }

    if (req.query.gender) {
      query.gender = req.query.gender;
    }

    if (req.query.bloodType) {
      query.bloodType = req.query.bloodType;
    }

    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    // Execute query
    const patients = await Patient.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Patient.countDocuments(query);

    logger.audit('patients_listed', req.user._id, 'patients', {
      count: patients.length,
      page,
      limit
    });

    res.json({
      success: true,
      data: {
        patients: patients.map(p => p.getSummary()),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get patients failed:', error);
    res.status(500).json({
      error: 'Failed to get patients'
    });
  }
});

// @route   GET /api/v1/patients/statistics/county
// @desc    Get patient statistics by county
// @access  Private
router.get('/statistics/county', requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    const stats = await Patient.getCountyStatistics();

    res.json({
      success: true,
      data: {
        statistics: stats
      }
    });
  } catch (error) {
    logger.error('Get county statistics failed:', error);
    res.status(500).json({
      error: 'Failed to get county statistics'
    });
  }
});

// @route   GET /api/v1/patients/:id
// @desc    Get patient by ID
// @access  Private
router.get('/:id', canAccessPatient('id'), async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid ObjectId format received for patient retrieval: ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    const patient = await Patient.findById(id).select('-password');

    if (!patient) {
      logger.warn(`Attempt to retrieve non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: {
        patient: patient.getSummary()
      }
    });
  } catch (error) {
    logger.error('Get patient failed:', error);
    res.status(500).json({
      error: 'Failed to get patient'
    });
  }
});

// @route   POST /api/v1/patients
// @desc    Create a new patient
// @access  Private
router.post('/', requireRole(['admin', 'doctor', 'nurse']), validatePatient, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if patient already exists
    const existingPatient = await Patient.findOne({
      $or: [
        { nationalId: req.body.nationalId },
        { email: req.body.email },
        { phoneNumber: req.body.phoneNumber }
      ]
    });

    if (existingPatient) {
      return res.status(400).json({
        error: 'Patient with this national ID, email, or phone number already exists'
      });
    }

    // Create patient
    const patient = new Patient({
      ...req.body,
      createdBy: req.user._id
    });

    await patient.save();

    logger.audit('patient_created', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      patientName: patient.fullName
    });

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: {
        patient: patient.getSummary()
      }
    });
  } catch (error) {
    logger.error('Create patient failed:', error);
    res.status(500).json({
      error: 'Failed to create patient',
      details: error.message
    });
  }
});

// @route   PUT /api/v1/patients/:id
// @desc    Update patient
// @access  Private
router.put('/:id', canAccessPatient('id'), validatePatient, async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid ObjectId format received for patient update: ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const patient = await Patient.findById(id);

    if (!patient) {
      logger.warn(`Attempt to update non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    // Update patient fields
    Object.assign(patient, req.body);
    patient.updatedBy = req.user._id;
    await patient.save();

    logger.audit('patient_updated', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      updatedFields: Object.keys(req.body)
    });

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: {
        patient: patient.getSummary()
      }
    });
  } catch (error) {
    logger.error('Update patient failed:', error);
    res.status(500).json({
      error: 'Failed to update patient'
    });
  }
});

// @route   PATCH /api/v1/patients/:id
// @desc    Partially update patient
// @access  Private
router.patch('/:id', canAccessPatient('id'), async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid ObjectId format received for patient partial update: ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    const patient = await Patient.findById(id);

    if (!patient) {
      logger.warn(`Attempt to partially update non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    // Update only provided fields
    Object.keys(req.body).forEach(key => {
      if (patient.schema.paths[key]) {
        patient[key] = req.body[key];
      }
    });
    
    patient.updatedBy = req.user._id;
    await patient.save();

    logger.audit('patient_partially_updated', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      updatedFields: Object.keys(req.body)
    });

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: {
        patient: patient.getSummary()
      }
    });
  } catch (error) {
    logger.error('Partial update patient failed:', error);
    res.status(500).json({
      error: 'Failed to update patient'
    });
  }
});

// @route   DELETE /api/v1/patients/bulk
// @desc    Bulk delete patients (soft delete)
// @access  Private (Admin only)
router.delete('/bulk', requireRole(['admin']), async (req, res) => {
  try {
    const { ids } = req.body;
    
    // Validate that the ids array exists and is not empty
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        details: 'An array of patient IDs must be provided in the `ids` field.' 
      });
    }

    // Filter out any values that are not valid MongoDB ObjectIds
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        details: 'No valid patient IDs were provided.',
        invalidIds: invalidIds
      });
    }

    // Perform the bulk operation (soft delete)
    const result = await Patient.updateMany(
      { _id: { $in: validIds } },  // Condition: where _id is in our array of valid IDs
      { $set: { isActive: false } }   // Action: set isActive to false
    );

    // Provide a clear success response
    const response = {
      message: 'Bulk deactivation operation completed.',
      success: true,
      details: {
        deactivatedCount: result.modifiedCount,
        notFoundCount: validIds.length - result.modifiedCount, // How many valid IDs were not found in the DB
        invalidIdCount: invalidIds.length,
        invalidIds: invalidIds.length > 0 ? invalidIds : undefined // Only include if there are any
      }
    };

    logger.audit('bulk_patient_deactivated', req.user._id, `count:${result.modifiedCount}`, response.details);

    res.status(200).json(response);

  } catch (error) {
    logger.error('Error during bulk patient deactivation:', error);
    res.status(500).json({ error: 'Server error during bulk delete', details: error.message });
  }
});

// @route   DELETE /api/v1/patients/:id
// @desc    Delete patient (soft delete)
// @access  Private
router.delete('/:id', requireRole(['admin']), canAccessPatient('id'), async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  // This happens before any database query is attempted
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid ObjectId format received for patient deletion: ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    const patient = await Patient.findById(id);

    if (!patient) {
      logger.warn(`Attempt to delete non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    // Soft delete
    patient.isActive = false;
    patient.updatedBy = req.user._id;
    await patient.save();

    logger.audit('patient_deleted', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      patientName: patient.fullName
    });

    res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    logger.error('Delete patient failed:', error);
    res.status(500).json({
      error: 'Failed to delete patient due to a server error.'
    });
  }
});

// @route   POST /api/v1/patients/:id/vital-signs
// @desc    Add vital signs to patient
// @access  Private
router.post('/:id/vital-signs', canAccessPatient('id'), validateVitalSigns, async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid ObjectId format received for vital signs addition: ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const patient = await Patient.findById(id);

    if (!patient) {
      logger.warn(`Attempt to add vital signs to non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    await patient.addVitalSigns(req.body, req.user._id);

    logger.audit('vital_signs_added', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      vitalSigns: req.body
    });

    res.json({
      success: true,
      message: 'Vital signs added successfully',
      data: {
        vitalSigns: patient.latestVitalSigns
      }
    });
  } catch (error) {
    logger.error('Add vital signs failed:', error);
    res.status(500).json({
      error: 'Failed to add vital signs'
    });
  }
});

// @route   POST /api/v1/patients/:id/allergies
// @desc    Add allergy to patient
// @access  Private
router.post('/:id/allergies', canAccessPatient('id'), validateAllergy, async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid ObjectId format received for allergy addition: ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const patient = await Patient.findById(id);

    if (!patient) {
      logger.warn(`Attempt to add allergy to non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    await patient.addAllergy(req.body);

    logger.audit('allergy_added', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      allergy: req.body
    });

    res.json({
      success: true,
      message: 'Allergy added successfully',
      data: {
        allergies: patient.allergies
      }
    });
  } catch (error) {
    logger.error('Add allergy failed:', error);
    res.status(500).json({
      error: 'Failed to add allergy'
    });
  }
});

// @route   GET /api/v1/patients/:id/vital-signs
// @desc    Get patient vital signs
// @access  Private
router.get('/:id/vital-signs', canAccessPatient('id'), async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid ObjectId format received for vital signs retrieval: ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    const patient = await Patient.findById(id).select('vitalSigns');

    if (!patient) {
      logger.warn(`Attempt to get vital signs for non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: {
        vitalSigns: patient.vitalSigns
      }
    });
  } catch (error) {
    logger.error('Get vital signs failed:', error);
    res.status(500).json({
      error: 'Failed to get vital signs'
    });
  }
});

module.exports = router; 