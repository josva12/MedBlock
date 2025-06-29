const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, canAccessPatient } = require('../middleware/auth');
const Patient = require('../models/Patient');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const upload = require('../config/multerConfig'); // Import multer configuration
const fs = require('fs').promises; // Use fs.promises for async file operations
const path = require('path'); // Import path module
const multer = require('multer');
const { validateObjectId } = require('../utils/validation'); // UNCOMMENT THIS

const router = express.Router();

// Rate limiting for mutation endpoints
const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // REVERTED TO PRODUCTION VALUE
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Temporary test route for file upload (remove in production) - MUST BE BEFORE AUTH MIDDLEWARE
router.post('/:id/files/test', async (req, res) => {
    try {
        const patientId = req.params.id;
        const { fileType, description } = req.body;
        
        logger.info(`Test upload - patientId: ${patientId}, fileType: ${fileType}`);

        // Create a custom multer configuration for this specific upload
        const customStorage = multer.diskStorage({
            destination: (req, file, cb) => {
                // Use the fileType from the route handler (more reliable)
                let uploadPath;
                
                logger.info(`Custom multer destination: fileType from route: ${fileType}, type: ${typeof fileType}`);

                // Normalize fileType
                const normalizedFileType = typeof fileType === 'string' ? fileType.toLowerCase().trim() : 'other';
                
                if (['medical_report', 'prescription', 'lab_result'].includes(normalizedFileType)) {
                    uploadPath = path.join(__dirname, '..', 'uploads', 'documents');
                    logger.info(`File will be saved to documents folder for fileType: ${normalizedFileType}`);
                } else if (normalizedFileType === 'xray') {
                    uploadPath = path.join(__dirname, '..', 'uploads', 'images');
                    logger.info(`File will be saved to images folder for fileType: ${normalizedFileType}`);
                } else {
                    uploadPath = path.join(__dirname, '..', 'uploads', 'others');
                    logger.info(`File will be saved to others folder for fileType: ${normalizedFileType}`);
                }

                // Create the directory if it doesn't exist
                fs.mkdirSync(uploadPath, { recursive: true });
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                cb(null, `${Date.now()}-${file.originalname}`);
            }
        });

        const customUpload = multer({
            storage: customStorage,
            fileFilter: (req, file, cb) => {
                const allowedMimeTypes = [
                    'image/jpeg', 'image/png', 'image/gif',
                    'application/pdf', 'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'text/plain'
                ];

                if (allowedMimeTypes.includes(file.mimetype)) {
                    logger.info(`File type ${file.mimetype} accepted for upload`);
                    cb(null, true);
                } else {
                    logger.warn(`File type ${file.mimetype} rejected for upload`);
                    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
                }
            },
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB limit
                files: 1
            }
        });

        // Use the custom upload middleware
        customUpload.single('file')(req, res, async (err) => {
            if (err) {
                logger.error('File upload error:', err);
                return res.status(400).json({
                    success: false,
                    message: err.message,
                    code: 'FILE_UPLOAD_ERROR'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded',
                    code: 'NO_FILE_UPLOADED'
                });
            }

            logger.info('Test file upload successful', {
                fileType,
                path: req.file.path,
                filename: req.file.filename
            });

            res.status(201).json({
                success: true,
                message: 'Test file upload successful',
                data: {
                    fileId: req.file.filename,
                    originalName: req.file.originalname,
                    path: req.file.path,
                    size: req.file.size,
                    fileType,
                    description,
                    uploadedAt: new Date()
                }
            });
        });

    } catch (error) {
        logger.error('Error in test file upload:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * @route   POST /api/v1/patients/:id/files
 * @desc    Upload a file/report for a specific patient
 * @access  Private (doctors, nurses, admins)
 * @body    Requires 'fileType' (medical_report, prescription, lab_result, xray, other) in form-data
 * and 'description' (optional)
 * File itself should be sent as 'file' field in form-data
 */
// IMPORTANT: authenticateToken runs BEFORE Multer now for security.
router.post('/:id/files', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params; // Patient ID
        const { fileType, description } = req.body; // Metadata from form-data

        // Diagnostic logs removed as the issue is understood.
        // logger.info('Received req.file object (after Multer, before Auth):', req.file);
        // logger.info('Received req.body object (after Multer, before Auth):', req.body);

        // Validate patient ID
        if (!validateObjectId(id)) {
            // If patient ID is invalid, delete the uploaded file from temp
            if (req.file) {
                await fs.unlink(req.file.path).catch(err => logger.error(`Failed to delete temp file ${req.file.path}:`, err));
            }
            return res.status(400).json({
                success: false,
                message: 'Invalid patient ID format',
                debug: { id }
            });
        }

        // Check if file was uploaded by multer
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded or Multer failed to process the file.',
                debug: { multerError: req.fileError ? req.fileError.message : 'Unknown Multer error' }
            });
        }

        // Find the patient
        const patient = await Patient.findById(id);
        if (!patient) {
            // If patient not found, delete the uploaded file from temp
            await fs.unlink(req.file.path).catch(err => logger.error(`Failed to delete temp file ${req.file.path}:`, err));
            return res.status(404).json({
                success: false,
                message: 'Patient not found',
                debug: { patientId: id }
            });
        }

        // --- NEW FILE MOVING LOGIC ---
        let targetDirectory;
        const normalizedFileType = (fileType || 'other').toLowerCase();

        switch (normalizedFileType) {
            case 'medical_report':
            case 'prescription':
            case 'lab_result':
                targetDirectory = path.join(__dirname, '..', 'uploads', 'documents');
                break;
            case 'xray':
                targetDirectory = path.join(__dirname, '..', 'uploads', 'images');
                break;
            case 'other': // Explicitly handle 'other' as well
                targetDirectory = path.join(__dirname, '..', 'uploads', 'others');
                break;
            case 'report': // If you have 'reports' as a fileType as per your README
                 targetDirectory = path.join(__dirname, '..', 'uploads', 'reports');
                 break;
            default:
                // Fallback for unrecognized fileType, though fileFilter should ideally catch this
                targetDirectory = path.join(__dirname, '..', 'uploads', 'others');
                logger.warn(`Unrecognized fileType '${fileType}', defaulting to 'others' directory.`);
        }

        // Create the target directory if it doesn't exist
        await fs.mkdir(targetDirectory, { recursive: true });

        const newFilePath = path.join(targetDirectory, req.file.filename);

        // Move the file from its temporary location to the final categorized location
        await fs.rename(req.file.path, newFilePath);
        // --- END NEW FILE MOVING LOGIC ---

        // Construct file metadata to save in patient document
        const fileMetadata = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            path: newFilePath, // Update path to the final location
            fileType: normalizedFileType, // Use the normalized fileType
            uploadedBy: req.user.id, // ID of the user uploading the file
            uploadedAt: new Date(),
            description: description || ''
        };

        // Add file metadata to patient's files array and save
        patient.files.push(fileMetadata);
        await patient.save();

        logger.info('File uploaded, categorized, and linked to patient', {
            patientId: id,
            fileId: fileMetadata.filename,
            fileType: fileMetadata.fileType,
            uploadedBy: req.user.id,
            userRole: req.user.role,
            finalPath: fileMetadata.path
        });

        res.status(201).json({
            success: true,
            message: 'File uploaded and linked successfully',
            data: {
                patientId: patient._id,
                file: fileMetadata
            },
            debug: { patientId: id, fileMetadata: fileMetadata }
        });

    } catch (error) {
        logger.error('Error uploading file in route handler:', error);
        // If an error occurred after file upload but before final save, try to delete the temporary file
        if (req.file && req.file.path && req.file.destination && req.file.destination.includes('uploads/temp')) { // Only delete from temp if it was there
            await fs.unlink(req.file.path).catch(err => logger.error(`Failed to delete orphaned temp file ${req.file.path} after error:`, err));
        } else if (req.file && req.file.path) { // If it was already moved but error after that
            await fs.unlink(req.file.path).catch(err => logger.error(`Failed to delete orphaned final file ${req.file.path} after error:`, err));
        }

        if (error instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: error.message,
                debug: { code: error.code }
            });
        }

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

// Apply authentication to all routes
router.use(authenticateToken);

// Apply rate limiting to mutation endpoints
router.use(['/'], mutationLimiter);

// Validation middleware
const validatePatient = [
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('lastName').trim().isLength({ min: 2, max: 50 }),
  body('dateOfBirth').isISO8601().toDate(),
  body('gender').isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  body('nationalId').optional().matches(/^\d{7,8}$/),
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
  body('allergen').optional().trim().notEmpty().withMessage('Allergen is required'),
  body('substance').optional().trim().notEmpty().withMessage('Substance is required'),
  body('severity').isIn(['mild', 'moderate', 'severe']).withMessage('Severity must be mild, moderate, or severe'),
  body('reaction').optional().trim(),
  body('notes').optional().trim(),
  body('diagnosedDate').optional().isISO8601().withMessage('Diagnosed date must be a valid date'),
  body('recordedAt').optional().isISO8601().withMessage('Recorded date must be a valid date'),
  // Custom validation to ensure either allergen or substance is provided
  (req, res, next) => {
    const { allergen, substance } = req.body;
    if (!allergen && !substance) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ msg: 'Either allergen or substance field is required', param: 'allergen' }]
      });
    }
    next();
  }
];

// @route   GET /api/v1/patients
// @desc    Get all patients with pagination and filtering
// @access  Private
router.get('/', requireRole(['admin', 'doctor', 'nurse']), async (req, res) => {
  try {
    // --- Robust Pagination Validation ---
    const { page, limit } = req.query;
    
    // Parse page parameter with strict validation
    let pageNumber;
    if (page !== undefined) {
      pageNumber = parseInt(page, 10);
      if (isNaN(pageNumber) || pageNumber <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameter',
          message: 'Pagination "page" parameter must be a positive integer.'
        });
      }
    } else {
      pageNumber = 1; // Default to page 1 if not provided
    }
    
    // Parse limit parameter with strict validation
    let limitNumber;
    if (limit !== undefined) {
      limitNumber = parseInt(limit, 10);
      if (isNaN(limitNumber) || limitNumber <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameter',
          message: 'Pagination "limit" parameter must be a positive integer.'
        });
      }
      
      // Add maximum limit constraint for performance
      if (limitNumber > 100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameter',
          message: 'Pagination "limit" cannot exceed 100.'
        });
      }
    } else {
      limitNumber = 20; // Default to 20 if not provided
    }
    
    const skip = (pageNumber - 1) * limitNumber;
    // --- END Pagination Validation ---

    // Build query
    const query = {};
    
    // Define allowed filterable fields to prevent injection
    const allowedFilterFields = [
      'fullName', 'firstName', 'lastName', 'patientId', 'email', 'phoneNumber',
      'gender', 'county', 'subCounty', 'isActive', 'checkInStatus', 'bloodType',
      'assignedDepartment', 'nationalId', 'age', 'dateOfBirth'
    ];
    
    // Validate filterBy parameter if provided
    if (req.query.filterBy && !allowedFilterFields.includes(req.query.filterBy)) {
      logger.warn(`Invalid filter field provided: ${req.query.filterBy}`, { 
        userId: req.user._id,
        attemptedFilter: req.query.filterBy,
        allowedFilters: allowedFilterFields
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameter',
        message: `Filtering by '${req.query.filterBy}' is not supported.`,
        details: `Allowed filter fields: ${allowedFilterFields.join(', ')}`
      });
    }
    
    // Apply filterBy and filterValue if both are provided and valid
    if (req.query.filterBy && req.query.filterValue) {
      const filterBy = req.query.filterBy;
      const filterValue = req.query.filterValue;
      
      // Handle different field types with appropriate filtering logic
      if (['fullName', 'firstName', 'lastName', 'email', 'patientId', 'county', 'subCounty'].includes(filterBy)) {
        // String fields with case-insensitive regex search
        query[filterBy] = { $regex: filterValue, $options: 'i' };
      } else if (filterBy === 'phoneNumber') {
        // Phone number with case-insensitive regex search
        query[filterBy] = { $regex: filterValue, $options: 'i' };
      } else if (filterBy === 'nationalId') {
        // National ID with exact match
        query[filterBy] = filterValue;
      } else if (filterBy === 'gender') {
        // Gender with exact match (case-insensitive)
        query[filterBy] = { $regex: `^${filterValue}$`, $options: 'i' };
      } else if (filterBy === 'bloodType') {
        // Blood type with exact match (case-insensitive)
        query[filterBy] = { $regex: `^${filterValue}$`, $options: 'i' };
      } else if (filterBy === 'checkInStatus') {
        // Check-in status with exact match (case-insensitive)
        query[filterBy] = { $regex: `^${filterValue}$`, $options: 'i' };
      } else if (filterBy === 'assignedDepartment') {
        // Assigned department with case-insensitive regex search
        query[filterBy] = { $regex: filterValue, $options: 'i' };
      } else if (filterBy === 'isActive') {
        // Boolean field
        query[filterBy] = filterValue.toLowerCase() === 'true';
      } else if (filterBy === 'age') {
        // Age filtering by dateOfBirth range (approximate)
        const age = parseInt(filterValue);
        if (isNaN(age)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid age value',
            message: 'Age must be a valid number'
          });
        }
        const today = new Date();
        const minDate = new Date(today.getFullYear() - age - 1, today.getMonth(), today.getDate());
        const maxDate = new Date(today.getFullYear() - age, today.getMonth(), today.getDate());
        query.dateOfBirth = { $gte: minDate, $lte: maxDate };
      } else if (filterBy === 'dateOfBirth') {
        // Date of birth with range support
        const dateValue = new Date(filterValue);
        if (isNaN(dateValue.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid date value',
            message: 'Date of birth must be a valid date (YYYY-MM-DD format)'
          });
        }
        query[filterBy] = dateValue;
      } else {
        // Default exact match for other fields
        query[filterBy] = filterValue;
      }
    }
    
    // Legacy search functionality (maintains backward compatibility)
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

    // Legacy individual filter parameters (maintains backward compatibility)
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

    if (req.query.checkInStatus) {
      query.checkInStatus = req.query.checkInStatus;
    }

    if (req.query.assignedDepartment) {
      query.assignedDepartment = req.query.assignedDepartment;
    }

    // Build sort object
    let sort = { createdAt: -1 }; // default sort
    
    // Define allowed sortable fields to prevent injection
    const allowedSortFields = [
      'createdAt', 'updatedAt', 'firstName', 'lastName', 'fullName', 
      'dateOfBirth', 'age', 'patientId', 'checkInStatus', 'isActive',
      'gender', 'bloodType', 'county'
    ];
    
    // Support both formats: single 'sort' parameter and separate 'sortBy'/'sortOrder' parameters
    if (req.query.sortBy && req.query.sortOrder) {
      // New format: separate sortBy and sortOrder parameters
      const sortBy = req.query.sortBy;
      const sortOrder = req.query.sortOrder.toLowerCase();
      
      if (allowedSortFields.includes(sortBy)) {
        const order = (sortOrder === 'desc') ? -1 : 1;
        
        // Handle virtual fields that can't be sorted directly in MongoDB
        if (sortBy === 'fullName') {
          // Sort by firstName first, then lastName for fullName
          sort = { firstName: order, lastName: order };
        } else if (sortBy === 'age') {
          // Sort by dateOfBirth (younger people have later dates)
          sort = { dateOfBirth: order === 1 ? -1 : 1 };
        } else if (sortBy === 'county') {
          // Sort by address.county
          sort = { 'address.county': order };
        } else {
          sort = { [sortBy]: order };
        }
      } else {
        return res.status(400).json({
          error: 'Invalid sort field',
          details: `Allowed sort fields: ${allowedSortFields.join(', ')}`
        });
      }
    } else if (req.query.sort) {
      // Legacy format: single sort parameter with minus prefix for descending
      const sortField = req.query.sort.replace(/^-/, ''); // remove leading minus
      const sortOrder = req.query.sort.startsWith('-') ? -1 : 1;
      
      if (allowedSortFields.includes(sortField)) {
        // Handle virtual fields that can't be sorted directly in MongoDB
        if (sortField === 'fullName') {
          // Sort by firstName first, then lastName for fullName
          sort = { firstName: sortOrder, lastName: sortOrder };
        } else if (sortField === 'age') {
          // Sort by dateOfBirth (younger people have later dates)
          sort = { dateOfBirth: sortOrder === 1 ? -1 : 1 };
        } else if (sortField === 'county') {
          // Sort by address.county
          sort = { 'address.county': sortOrder };
        } else {
          sort = { [sortField]: sortOrder };
        }
      } else {
        return res.status(400).json({
          error: 'Invalid sort field',
          details: `Allowed sort fields: ${allowedSortFields.join(', ')}`
        });
      }
    }

    // Execute query with pagination
    const patients = await Patient.find(query)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedDoctor', 'fullName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNumber);

    // Get total count for pagination info
    const totalPatients = await Patient.countDocuments(query);
    const totalPages = Math.ceil(totalPatients / limitNumber);

    // Transform data based on user role
    const transformedPatients = patients.map(patient => patient.getSummaryForRole(req.user.role));

    // Build debug info for troubleshooting
    const debugInfo = {
      query: req.query,
      appliedFilters: Object.keys(query).length > 0 ? query : 'none',
      sort: sort,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        skip,
        totalPatients,
        totalPages
      },
      resultsCount: transformedPatients.length
    };

    res.json({
      success: true,
      data: {
        patients: transformedPatients,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalPatients,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
          limit: limitNumber
        }
      },
      debug: debugInfo
    });

    logger.audit('patients_retrieved', req.user._id, 'patients_list', {
      count: transformedPatients.length,
      filters: req.query,
      pagination: { page: pageNumber, limit: limitNumber }
    });
  } catch (error) {
    logger.error('Get patients failed:', error);
    res.status(500).json({
      error: 'Failed to get patients',
      details: error.message
    });
  }
});

// @route   GET /api/v1/patients/export
// @desc    Export patients data
// @access  Private (Admin only)
router.get('/export', requireRole(['admin']), async (req, res) => {
  try {
    const { format = 'csv', department, startDate, endDate } = req.query;
    
    if (!['csv', 'xlsx'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Must be "csv" or "xlsx".' });
    }

    // Build query
    const query = {};
    if (department) {
      query.assignedDepartment = department;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const patients = await Patient.find(query)
      .populate('createdBy', 'fullName email')
      .populate('assignedDoctor', 'fullName email')
      .sort({ createdAt: -1 });

    // Transform data for export
    const exportData = patients.map(patient => ({
      patientId: patient.patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      nationalId: patient.nationalId,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      phoneNumber: patient.phoneNumber,
      email: patient.email,
      county: patient.address?.county,
      assignedDepartment: patient.assignedDepartment,
      checkInStatus: patient.checkInStatus,
      createdAt: patient.createdAt,
      createdBy: patient.createdBy?.fullName || 'N/A',
      assignedDoctor: patient.assignedDoctor?.fullName || 'N/A'
    }));

    if (format === 'csv') {
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=patients-${new Date().toISOString().split('T')[0]}.csv`);
      
      // Create CSV content
      const headers = Object.keys(exportData[0] || {}).join(',');
      const rows = exportData.map(row => Object.values(row).map(value => 
        typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
      ).join(','));
      
      const csvContent = [headers, ...rows].join('\n');
      res.send(csvContent);
    } else {
      // For xlsx, return JSON data (you can implement xlsx generation later)
      res.json({
        success: true,
        data: exportData,
        count: exportData.length
      });
    }

    logger.audit('patients_exported', req.user._id, 'patients_export', {
      format,
      count: exportData.length,
      filters: { department, startDate, endDate }
    });
  } catch (error) {
    logger.error('Patient export failed:', error);
    res.status(500).json({ error: 'Failed to export patients data' });
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
  if (!validateObjectId(id)) {
    logger.warn(`Invalid ObjectId format received for patient retrieval: ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    // Remove .select('-password') to include all fields including audit fields
    const patient = await Patient.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedDoctor', 'fullName email');

    if (!patient) {
      logger.warn(`Attempt to retrieve non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    // Get the summary and add audit fields explicitly
    const patientSummary = patient.getSummaryForRole(req.user.role);
    const patientData = {
      ...patientSummary,
      // Explicitly include audit fields
      createdBy: patient.createdBy ? {
        _id: patient.createdBy._id,
        fullName: patient.createdBy.fullName,
        email: patient.createdBy.email
      } : null,
      updatedBy: patient.updatedBy ? {
        _id: patient.updatedBy._id,
        fullName: patient.updatedBy.fullName,
        email: patient.updatedBy.email
      } : null,
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt
    };

    res.json({
      success: true,
      data: {
        patient: patientData
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

    // Fetch the created patient with populated fields for response
    const createdPatient = await Patient.findById(patient._id)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedDoctor', 'fullName email');

    logger.audit('patient_created', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      patientName: patient.fullName
    });

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: {
        patient: createdPatient.getSummaryForRole(req.user.role)
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
  if (!validateObjectId(id)) {
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
    patient.updatedAt = new Date();
    await patient.save();

    // Fetch the updated patient with populated fields for response
    const updatedPatient = await Patient.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedDoctor', 'fullName email');

    logger.audit('patient_updated', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      updatedFields: Object.keys(req.body)
    });

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: {
        patient: updatedPatient.getSummaryForRole(req.user.role)
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
  if (!validateObjectId(id)) {
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

    // Explicit check for nationalId immutability
    if (req.body.nationalId && req.body.nationalId !== patient.nationalId) {
      logger.warn('SECURITY_EVENT: Attempted to modify immutable nationalId field', {
        userId: req.user._id,
        patientId: patient.patientId,
        currentNationalId: patient.nationalId,
        attemptedNationalId: req.body.nationalId
      });
      return res.status(400).json({
        error: 'National ID cannot be modified.',
        details: 'The national ID field is immutable and cannot be changed once set.'
      });
    }

    // Prevent updates to other immutable fields
    const immutableFields = ['patientId', 'createdBy', 'createdAt'];
    const attemptedImmutableUpdates = immutableFields.filter(field => req.body.hasOwnProperty(field));
    
    if (attemptedImmutableUpdates.length > 0) {
      logger.warn('SECURITY_EVENT: Attempted to update immutable fields', {
        userId: req.user._id,
        patientId: patient.patientId,
        attemptedFields: attemptedImmutableUpdates
      });
      return res.status(400).json({
        error: 'Cannot update immutable fields',
        details: `The following fields cannot be updated: ${attemptedImmutableUpdates.join(', ')}`
      });
    }

    // Update only provided fields
    Object.keys(req.body).forEach(key => {
      if (patient.schema.paths[key]) {
        patient[key] = req.body[key];
      }
    });
    
    patient.updatedBy = req.user._id;
    patient.updatedAt = new Date();
    await patient.save();

    // Fetch the updated patient with populated fields for response
    const updatedPatient = await Patient.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedDoctor', 'fullName email');

    logger.audit('patient_partially_updated', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      updatedFields: Object.keys(req.body)
    });

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: {
        patient: updatedPatient.getSummaryForRole(req.user.role)
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
    const validIds = ids.filter(id => validateObjectId(id));
    const invalidIds = ids.filter(id => !validateObjectId(id));

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
router.delete('/:id', requireRole(['admin']), async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!validateObjectId(id)) {
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

    // Prevent double-deletion of soft-deleted patients
    if (!patient.isActive) {
      logger.warn(`Attempt to delete already soft-deleted patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found or already deleted'
      });
    }

    // Check for embedded active records before deletion
    const linkedRecords = [];

    // Check allergies
    if (patient.allergies && patient.allergies.length > 0) {
      linkedRecords.push({
        type: 'allergies',
        count: patient.allergies.length,
        message: 'Patient has active allergy records'
      });
    }

    // Check medical history
    if (patient.medicalHistory && patient.medicalHistory.length > 0) {
      const activeConditions = patient.medicalHistory.filter(condition => 
        condition.status === 'active'
      );
      if (activeConditions.length > 0) {
        linkedRecords.push({
          type: 'medical_history',
          count: activeConditions.length,
          message: 'Patient has active medical conditions'
        });
      }
    }

    // Check vital signs
    if (patient.vitalSigns && patient.vitalSigns.length > 0) {
      linkedRecords.push({
        type: 'vital_signs',
        count: patient.vitalSigns.length,
        message: 'Patient has vital signs records'
      });
    }

    // Check insurance details
    if (patient.insuranceDetails && patient.insuranceDetails.length > 0) {
      const activeInsurance = patient.insuranceDetails.filter(insurance => 
        insurance.isActive
      );
      if (activeInsurance.length > 0) {
        linkedRecords.push({
          type: 'insurance',
          count: activeInsurance.length,
          message: 'Patient has active insurance policies'
        });
      }
    }

    // Check uploaded files
    if (patient.files && patient.files.length > 0) {
      linkedRecords.push({
        type: 'files',
        count: patient.files.length,
        message: 'Patient has uploaded medical files'
      });
    }

    // Check for linked records in other collections
    const MedicalRecord = require('../models/MedicalRecord');
    const Encounter = require('../models/Encounter');

    // Check medical records
    const medicalRecords = await MedicalRecord.find({
      patientId: patient._id,
      isActive: true
    }).limit(1);

    if (medicalRecords.length > 0) {
      linkedRecords.push({
        type: 'medical_records',
        count: medicalRecords.length,
        message: 'Patient has linked medical records'
      });
    }

    // Check encounters
    const encounters = await Encounter.find({
      patientId: patient._id,
      isActive: true
    }).limit(1);

    if (encounters.length > 0) {
      linkedRecords.push({
        type: 'encounters',
        count: encounters.length,
        message: 'Patient has active encounters'
      });
    }

    // If any linked records exist, reject the deletion
    if (linkedRecords.length > 0) {
      logger.warn(`Attempt to delete patient with linked active records: ${id}`, { 
        userId: req.user._id,
        linkedRecords: linkedRecords
      });
      
      return res.status(409).json({
        error: 'Cannot delete patient with active linked records',
        details: 'Please archive or delete the linked records first',
        linkedRecords: linkedRecords.map(record => ({
          type: record.type,
          count: record.count,
          message: record.message
        }))
      });
    }

    // Soft delete the patient
    patient.isActive = false;
    patient.updatedBy = req.user._id;
    patient.updatedAt = new Date();
    await patient.save();

    logger.audit('patient_deleted', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`
    });

    res.json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    logger.error('Delete patient failed:', error);
    res.status(500).json({
      error: 'Failed to delete patient'
    });
  }
});

// @route   POST /api/v1/patients/:id/vital-signs
// @desc    Add vital signs to patient
// @access  Private
router.post('/:id/vital-signs', canAccessPatient('id'), validateVitalSigns, async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!validateObjectId(id)) {
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
  if (!validateObjectId(id)) {
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

    // Fix E1 & E7: Standardize incoming data. Accept 'substance' as an alias for 'allergen' and 'recordedAt' for 'diagnosedDate'.
    const { allergen, substance, reaction, severity, diagnosedDate, recordedAt } = req.body;
    
    const allergyData = {
      allergen: allergen || substance, // Use 'allergen' if present, otherwise fall back to 'substance'
      reaction: reaction,
      severity: severity,
      diagnosedDate: diagnosedDate || recordedAt || new Date() // Use a specific date or default to now
    };
    
    // Server-side validation to ensure 'allergen' is present
    if (!allergyData.allergen) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: "The 'allergen' or 'substance' field is required." 
      });
    }

    const patient = await Patient.findById(id);

    if (!patient) {
      logger.warn(`Attempt to add allergy to non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({
        error: 'Patient not found'
      });
    }

    // Fix E9: Check for duplicate allergy before adding.
    // We check based on the 'allergen' field, case-insensitive.
    const alreadyExists = patient.allergies.some(
      allergy => allergy.allergen.toLowerCase() === allergyData.allergen.toLowerCase()
    );

    if (alreadyExists) {
      return res.status(409).json({ 
        error: "Duplicate Entry", 
        details: "This allergy has already been recorded for this patient." 
      });
    }

    // Add the new allergy
    patient.allergies.push(allergyData);

    // Save the parent document
    await patient.save();
    
    // Return only the newly added allergy for clarity
    const newAllergy = patient.allergies[patient.allergies.length - 1];

    logger.audit('allergy_added', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      allergy: allergyData
    });

    res.status(201).json({
      success: true,
      message: 'Allergy added successfully',
      data: newAllergy
    });
  } catch (error) {
    logger.error('Add allergy failed:', error);
    res.status(500).json({
      error: 'Failed to add allergy'
    });
  }
});

// @route   GET /api/v1/patients/:id/allergies
// @desc    Get all allergies for a patient
// @access  Private
router.get('/:id/allergies', canAccessPatient('id'), async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!validateObjectId(id)) {
    logger.warn(`Invalid ObjectId format received for allergies retrieval: ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  try {
    // Find patient but only select the 'allergies' field (and _id for context). Highly efficient.
    const patient = await Patient.findById(id).select('allergies');
    
    if (!patient) {
      logger.warn(`Attempt to get allergies for non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Return ONLY the allergies array
    res.status(200).json({ success: true, data: patient.allergies });

  } catch (error) {
    logger.error('Get allergies failed:', error);
    res.status(500).json({ error: 'Failed to get allergies' });
  }
});

// @route   PATCH /api/v1/patients/:id/allergies/:allergyId
// @desc    Update a specific allergy for a patient
// @access  Private
router.patch('/:id/allergies/:allergyId', canAccessPatient('id'), async (req, res) => {
  const { id, allergyId } = req.params;
  const { reaction, severity } = req.body;

  // Validation guard: Check if both IDs are valid MongoDB ObjectId format
  if (!validateObjectId(id)) {
    logger.warn(`Invalid ObjectId format received for allergy update (patient): ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  if (!validateObjectId(allergyId)) {
    logger.warn(`Invalid ObjectId format received for allergy update (allergy): ${allergyId}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid allergy ID format.' });
  }

  try {
    const patient = await Patient.findById(id);
    if (!patient) {
      logger.warn(`Attempt to update allergy for non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Find the sub-document by its _id
    const allergy = patient.allergies.id(allergyId);
    if (!allergy) {
      logger.warn(`Attempt to update non-existent allergy with ID: ${allergyId}`, { userId: req.user._id });
      return res.status(404).json({ error: 'Allergy not found' });
    }

    // Update its properties
    if (reaction) allergy.reaction = reaction;
    if (severity) allergy.severity = severity;
    
    await patient.save();

    logger.audit('allergy_updated', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      allergyId: allergyId,
      updatedFields: Object.keys(req.body)
    });

    res.status(200).json({ 
      success: true,
      message: 'Allergy updated successfully', 
      data: allergy 
    });

  } catch (error) {
    logger.error('Update allergy failed:', error);
    res.status(500).json({ error: 'Failed to update allergy' });
  }
});

// @route   DELETE /api/v1/patients/:id/allergies/:allergyId
// @desc    Delete a specific allergy for a patient
// @access  Private
router.delete('/:id/allergies/:allergyId', canAccessPatient('id'), async (req, res) => {
  const { id, allergyId } = req.params;

  // Validation guard: Check if both IDs are valid MongoDB ObjectId format
  if (!validateObjectId(id)) {
    logger.warn(`Invalid ObjectId format received for allergy deletion (patient): ${id}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  if (!validateObjectId(allergyId)) {
    logger.warn(`Invalid ObjectId format received for allergy deletion (allergy): ${allergyId}`, { userId: req.user._id });
    return res.status(400).json({ error: 'Invalid allergy ID format.' });
  }

  try {
    const patient = await Patient.findById(id);
    if (!patient) {
      logger.warn(`Attempt to delete allergy for non-existent patient with ID: ${id}`, { userId: req.user._id });
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Find the specific allergy to remove
    const allergyExists = patient.allergies.some(allergy => allergy._id.toString() === allergyId);
    if (!allergyExists) {
      logger.warn(`Attempt to delete non-existent allergy with ID: ${allergyId}`, { userId: req.user._id });
      return res.status(404).json({ error: 'Allergy not found' });
    }
    
    // Remove the sub-document using pull
    patient.allergies.pull({ _id: allergyId });

    // Save the parent document to persist the change
    await patient.save();

    logger.audit('allergy_deleted', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      allergyId: allergyId
    });

    res.status(200).json({ 
      success: true, 
      message: 'Allergy deleted successfully' 
    });

  } catch (error) {
    logger.error('Delete allergy failed:', error);
    res.status(500).json({ error: 'Failed to delete allergy' });
  }
});

// @route   GET /api/v1/patients/:id/vital-signs
// @desc    Get patient vital signs
// @access  Private
router.get('/:id/vital-signs', canAccessPatient('id'), async (req, res) => {
  const { id } = req.params;

  // Validation guard: Check if the provided 'id' is a valid MongoDB ObjectId format
  if (!validateObjectId(id)) {
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

// @route   PATCH /api/v1/patients/:id/checkin
// @desc    Update patient check-in status
// @access  Private
router.patch('/:id/checkin', requireRole(['admin', 'doctor', 'nurse']), async (req, res) => {
  const { id } = req.params;
  
  // Accept both 'status' and 'checkInStatus' field names for flexibility
  const checkInStatus = req.body.checkInStatus || req.body.status;

  if (!validateObjectId(id)) {
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  if (!checkInStatus) {
    return res.status(400).json({ 
      error: 'Missing check-in status. Please provide "checkInStatus" or "status" field.',
      validValues: ['not_admitted', 'admitted', 'discharged']
    });
  }

  // Validate against the actual schema enum values
  const validStatuses = ['not_admitted', 'admitted', 'discharged'];
  if (!validStatuses.includes(checkInStatus)) {
    return res.status(400).json({ 
      error: 'Invalid check-in status.',
      details: `Received: "${checkInStatus}". Expected one of: ${validStatuses.join(', ')}.`,
      validValues: validStatuses
    });
  }

  try {
    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Prevent re-admission if already admitted
    if (checkInStatus === 'admitted' && patient.checkInStatus === 'admitted') {
      return res.status(400).json({ 
        error: 'Patient is already admitted. Discharge first before re-admission.' 
      });
    }

    // Prevent discharge if not admitted
    if (checkInStatus === 'discharged' && patient.checkInStatus !== 'admitted') {
      return res.status(400).json({ 
        error: 'Patient must be admitted before being discharged.',
        currentStatus: patient.checkInStatus
      });
    }

    patient.checkInStatus = checkInStatus;
    patient.checkInDate = checkInStatus === 'admitted' ? new Date() : null;
    patient.checkedInBy = checkInStatus === 'admitted' ? req.user._id : null;
    patient.updatedBy = req.user._id;
    patient.updatedAt = new Date();

    await patient.save();

    // Fetch the updated patient with populated fields for response
    const updatedPatient = await Patient.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedDoctor', 'fullName email');

    logger.audit('patient_checkin_updated', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      checkInStatus,
      action: checkInStatus === 'admitted' ? 'admitted' : checkInStatus === 'discharged' ? 'discharged' : 'status_updated'
    });

    res.json({
      success: true,
      message: `Patient ${checkInStatus} successfully`,
      data: {
        patient: updatedPatient.getSummaryForRole(req.user.role)
      }
    });
  } catch (error) {
    logger.error('Patient check-in update failed:', error);
    res.status(500).json({ error: 'Failed to update patient check-in status' });
  }
});

// @route   PATCH /api/v1/patients/:id/assign
// @desc    Assign a doctor to a patient
// @access  Private
router.patch('/:id/assign', requireRole(['admin', 'doctor']), async (req, res) => {
  const { id } = req.params;
  const { assignedDoctor, assignedDepartment } = req.body;

  if (!validateObjectId(id)) {
    return res.status(400).json({ error: 'Invalid patient ID format.' });
  }

  if (!assignedDoctor || !assignedDepartment) {
    return res.status(400).json({ error: 'Both assignedDoctor and assignedDepartment are required.' });
  }

  if (!validateObjectId(assignedDoctor)) {
    return res.status(400).json({ error: 'Invalid doctor ID format.' });
  }

  try {
    // Verify doctor exists and is active
    const User = require('../models/User');
    const doctor = await User.findById(assignedDoctor);
    if (!doctor || !doctor.isActive || !['doctor', 'admin'].includes(doctor.role)) {
      return res.status(400).json({ error: 'Invalid or inactive doctor specified.' });
    }

    const patient = await Patient.findById(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Update assignment
    patient.assignedDoctor = assignedDoctor;
    patient.assignedDepartment = assignedDepartment;
    patient.updatedBy = req.user._id;
    patient.updatedAt = new Date();

    // Add to assignment history
    patient.assignmentHistory.push({
      doctorId: assignedDoctor,
      department: assignedDepartment,
      assignedBy: req.user._id
    });

    await patient.save();

    logger.audit('patient_assigned', req.user._id, `patient:${patient.patientId}`, {
      patientId: patient.patientId,
      assignedDoctor,
      assignedDepartment
    });

    res.json({
      success: true,
      message: 'Patient assigned successfully',
      data: {
        patient: patient.getSummaryForRole(req.user.role)
      }
    });
  } catch (error) {
    logger.error('Patient assignment failed:', error);
    res.status(500).json({ error: 'Failed to assign patient' });
  }
});

module.exports = router; 