const mongoose = require('mongoose');
const logger = require('../utils/logger');
const shortid = require('shortid');
const { 
  maskEmail, 
  maskPhoneNumber, 
  maskNationalId, 
  maskAddress, 
  maskEmergencyContact, 
  maskInsuranceDetails 
} = require('../utils/masking');

const patientSchema = new mongoose.Schema({
  // Basic Information
  patientId: {
    type: String,
    default: shortid.generate,
    unique: true,
    required: true
  },
  
  // Demographics
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  middleName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  dateOfBirth: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v <= new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    required: true
  },
  
  // Kenyan-Specific Fields
  nationalId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/^\d{7,8}$/, 'Please provide a valid 7 or 8 digit National ID'],
    required: true
  },
  
  // Audit and Tracking Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Check-in/Admission Fields
  checkInStatus: {
    type: String,
    enum: ['not_admitted', 'admitted', 'discharged'],
    default: 'not_admitted'
  },
  
  checkInDate: {
    type: Date,
    default: null
  },
  
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Assignment Fields
  assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  assignedDepartment: {
    type: String,
    trim: true,
    default: null
  },
  
  assignmentHistory: [{
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  
  // File/Document Uploads
  files: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      enum: ['medical_report', 'prescription', 'lab_result', 'xray', 'other'],
      default: 'other'
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    description: {
      type: String,
      trim: true
    }
  }],
  
  // Detailed Address (Kenya-specific)
  address: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    county: {
      type: String,
      required: true,
      trim: true,
      enum: [
        'Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita Taveta', 'Garissa', 'Wajir', 'Mandera',
        'Marsabit', 'Isiolo', 'Meru', 'Tharaka Nithi', 'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua',
        'Nyeri', 'Kirinyaga', 'Murang\'a', 'Kiambu', 'Turkana', 'West Pokot', 'Samburu', 'Trans Nzoia',
        'Uasin Gishu', 'Elgeyo Marakwet', 'Nandi', 'Baringo', 'Laikipia', 'Nakuru', 'Narok', 'Kajiado',
        'Kericho', 'Bomet', 'Kakamega', 'Vihiga', 'Bungoma', 'Busia', 'Siaya', 'Kisumu', 'Homa Bay',
        'Migori', 'Kisii', 'Nyamira', 'Nairobi'
      ]
    },
    subCounty: {
      type: String,
      required: true,
      trim: true
    },
    ward: {
      type: String,
      required: true,
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      default: 'Kenya'
    }
  },
  
  // Contact Information
  phoneNumber: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^(\+254|0)[17]\d{8}$/.test(v);
      },
      message: 'Please provide a valid Kenyan phone number'
    }
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    }
  },
  
  // Embedded Clinical Data (Frequently accessed together)
  allergies: [{
    allergen: {
      type: String,
      required: true,
      trim: true
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      required: true
    },
    reaction: String,
    notes: String,
    diagnosedDate: Date
  }],
  
  medicalHistory: [{
    condition: {
      type: String,
      required: true,
      trim: true
    },
    icd10Code: String,
    diagnosedDate: Date,
    status: {
      type: String,
      enum: ['active', 'inactive', 'resolved'],
      default: 'active'
    },
    notes: String,
    diagnosedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Reference to VitalSign documents (replacing embedded vitalSigns)
  // This allows for better scalability and draft functionality
  vitalSigns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VitalSign'
  }],
  
  // Embedded Administrative Data
  emergencyContact: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    relationship: {
      type: String,
      required: true,
      enum: ['spouse', 'parent', 'child', 'sibling', 'friend', 'other']
    },
    phoneNumber: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^(\+254|0)[17]\d{8}$/.test(v);
        },
        message: 'Please provide a valid Kenyan phone number'
      }
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    address: {
      street: String,
      city: String,
      county: String
    }
  },
  
  insuranceDetails: [{
    provider: {
      type: String,
      required: true,
      trim: true
    },
    policyNumber: {
      type: String,
      required: true,
      trim: true
    },
    nhifNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^\d{10}$/.test(v);
        },
        message: 'NHIF number must be exactly 10 digits'
      }
    },
    groupNumber: String,
    expiryDate: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    coverageType: {
      type: String,
      enum: ['comprehensive', 'basic', 'emergency_only', 'dental', 'optical']
    }
  }],
  
  // Medical Information
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'],
    default: 'unknown'
  },
  
  // Security and Access
  password: {
    type: String,
    required: false,
    select: false,
    minlength: 8,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty passwords for patients
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(v);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  
  // Audit Fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Virtual for BMI
patientSchema.virtual('bmi').get(function() {
  // Ensure vitalSigns is an array and check if it's populated
  if (!Array.isArray(this.vitalSigns) || this.vitalSigns.length === 0 ||
      (typeof this.vitalSigns[0] === 'string' || this.vitalSigns[0] instanceof mongoose.Types.ObjectId)) {
    // If not an array, empty, or unpopulated, return null
    logger.warn('BMI virtual accessed with unpopulated or invalid vitalSigns array. Returning null.');
    return null;
  }

  // At this point, this.vitalSigns should be an array of populated documents
  const latestVitals = this.vitalSigns[this.vitalSigns.length - 1]; // Assuming the last one is the latest if unsorted
  
  if (!latestVitals || !latestVitals.height || !latestVitals.weight ||
      !latestVitals.height.value || !latestVitals.weight.value) { // Check nested values too
    return null;
  }

  // Ensure units are consistent for calculation, or convert as needed
  let weightKg = latestVitals.weight.value;
  let heightMeters = latestVitals.height.value;

  if (latestVitals.weight.unit === 'lbs') {
    weightKg = latestVitals.weight.value * 0.453592; // lbs to kg
  }
  if (latestVitals.height.unit === 'in') {
    heightMeters = latestVitals.height.value * 0.0254; // inches to meters
  } else if (latestVitals.height.unit === 'cm') {
    heightMeters = latestVitals.height.value / 100; // cm to meters
  }

  if (heightMeters > 0) {
    return (weightKg / (heightMeters * heightMeters)).toFixed(1);
  }
  return null;
});

// Virtual for latest vital signs
patientSchema.virtual('latestVitalSigns').get(function() {
  return this.vitalSigns;
});

// Virtual for latest final vital signs
patientSchema.virtual('latestFinalVitalSigns').get(function() {
  if (!this.vitalSigns || this.vitalSigns.length === 0) return null;
  
  // Check if vitalSigns are populated (i.e., if the first element is an object, not just an ObjectId string)
  if (typeof this.vitalSigns[0] === 'string' || this.vitalSigns[0] instanceof mongoose.Types.ObjectId) {
    logger.warn('latestFinalVitalSigns virtual accessed with unpopulated vitalSigns. Returning null.');
    return null; // Or handle as appropriate if not populated
  }
  
  // Find the most recent final vital signs
  const finalVitalSigns = this.vitalSigns.filter(vital => 
    vital && (vital.status === 'final' || !vital.status) // Handle legacy data
  );
  
  if (finalVitalSigns.length === 0) return null;
  
  // Sort by recordedAt and return the most recent
  return finalVitalSigns.sort((a, b) => 
    new Date(b.recordedAt || b.timestamp) - new Date(a.recordedAt || a.timestamp)
  )[0];
});

// Virtual field to get draft vital signs
patientSchema.virtual('draftVitalSigns').get(function() {
  if (!this.vitalSigns || this.vitalSigns.length === 0) return [];
  
  // Check if vitalSigns are populated
  if (typeof this.vitalSigns[0] === 'string' || this.vitalSigns[0] instanceof mongoose.Types.ObjectId) {
    logger.warn('draftVitalSigns virtual accessed with unpopulated vitalSigns. Returning empty array.');
    return []; // Or handle as appropriate if not populated
  }
  
  return this.vitalSigns.filter(vital => vital && vital.status === 'draft');
});

// Virtual for active allergies
patientSchema.virtual('activeAllergies').get(function() {
  if (!this.allergies) return [];
  return this.allergies.filter(allergy => allergy.severity !== 'mild');
});

// Virtual for patient summary
patientSchema.virtual('summary').get(function() {
  return {
    _id: this._id,
    patientId: this.patientId,
    fullName: this.fullName,
    age: this.age,
    gender: this.gender,
    bloodType: this.bloodType,
    phoneNumber: this.phoneNumber,
    email: this.email,
    county: this.address ? this.address.county : undefined,
    isActive: this.isActive,
    isVerified: this.isVerified,
    allergies: Array.isArray(this.allergies) ? this.allergies.length : 0,
    medicalHistory: Array.isArray(this.medicalHistory) ? this.medicalHistory.length : 0,
    vitalSigns: Array.isArray(this.vitalSigns) ? this.vitalSigns.length : 0
  };
});

// Indexes for efficient querying
patientSchema.index({ 'address.county': 1 });
patientSchema.index({ 'address.subCounty': 1 });
patientSchema.index({ gender: 1 });
patientSchema.index({ bloodType: 1 });
patientSchema.index({ isActive: 1 });
patientSchema.index({ dateOfBirth: 1 });
patientSchema.index({ createdAt: -1 });

// Pre-save middleware to generate patient ID if not provided
patientSchema.pre('save', async function(next) {
  try {
    if (!this.patientId) {
      const count = await this.constructor.countDocuments();
      this.patientId = `P${String(count + 1).padStart(7, '0')}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to add vital signs
patientSchema.methods.addVitalSigns = function(vitalData, recordedBy) {
  this.vitalSigns.push({
    ...vitalData,
    timestamp: new Date(),
    recordedBy
  });
  return this.save();
};

// Instance method to add allergy
patientSchema.methods.addAllergy = function(allergyData) {
  this.allergies.push({
    ...allergyData,
    diagnosedDate: new Date()
  });
  return this.save();
};

// Instance method to get patient summary
patientSchema.methods.getSummary = function() {
  return {
    _id: this._id,
    patientId: this.patientId,
    fullName: this.fullName,
    age: this.age,
    gender: this.gender,
    bloodType: this.bloodType,
    phoneNumber: this.phoneNumber,
    email: this.email,
    county: this.address ? this.address.county : undefined,
    isActive: this.isActive,
    isVerified: this.isVerified,
    allergies: Array.isArray(this.allergies) ? this.allergies.length : 0,
    medicalHistory: Array.isArray(this.medicalHistory) ? this.medicalHistory.length : 0,
    vitalSigns: Array.isArray(this.vitalSigns) ? this.vitalSigns.length : 0,
    createdBy: this.createdBy,
    updatedBy: this.updatedBy,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    checkInStatus: this.checkInStatus,
    checkInDate: this.checkInDate,
    checkedInBy: this.checkedInBy,
    assignedDoctor: this.assignedDoctor,
    assignedDepartment: this.assignedDepartment
  };
};

// Instance method to get patient summary with role-based PII masking
patientSchema.methods.getSummaryForRole = function(userRole) {
  const patientObject = this.toObject({ virtuals: true });
  
  // Base summary with always-visible fields
  const summary = {
    _id: patientObject._id,
    patientId: patientObject.patientId,
    fullName: patientObject.fullName,
    age: patientObject.age,
    gender: patientObject.gender,
    bloodType: patientObject.bloodType,
    county: patientObject.address ? patientObject.address.county : undefined,
    isActive: patientObject.isActive,
    isVerified: patientObject.isVerified,
    allergies: Array.isArray(patientObject.allergies) ? patientObject.allergies.length : 0,
    medicalHistory: Array.isArray(patientObject.medicalHistory) ? patientObject.medicalHistory.length : 0,
    vitalSigns: Array.isArray(patientObject.vitalSigns) ? patientObject.vitalSigns.length : 0,
    createdBy: patientObject.createdBy,
    updatedBy: patientObject.updatedBy,
    createdAt: patientObject.createdAt,
    updatedAt: patientObject.updatedAt,
    checkInStatus: patientObject.checkInStatus,
    checkInDate: patientObject.checkInDate,
    checkedInBy: patientObject.checkedInBy,
    assignedDoctor: patientObject.assignedDoctor,
    assignedDepartment: patientObject.assignedDepartment
  };

  // Conditional PII handling based on role
  if (userRole === 'admin' || userRole === 'doctor') {
    // Admin and Doctor get full access to all PII and sensitive arrays
    summary.phoneNumber = patientObject.phoneNumber;
    summary.email = patientObject.email;
    summary.nationalId = patientObject.nationalId;
    summary.address = patientObject.address;
    summary.emergencyContact = patientObject.emergencyContact;
    summary.insuranceDetails = patientObject.insuranceDetails;

    // Include assignment history and files for admin/doctor roles
    // Ensure these are arrays before spreading/including
    summary.assignmentHistory = Array.isArray(patientObject.assignmentHistory) ? patientObject.assignmentHistory : [];
    summary.files = Array.isArray(patientObject.files) ? patientObject.files : [];

  } else {
    // Non-admin/doctor roles get masked PII
    summary.phoneNumber = maskPhoneNumber(patientObject.phoneNumber);
    summary.email = maskEmail(patientObject.email);
    summary.nationalId = maskNationalId(patientObject.nationalId);
    summary.address = maskAddress(patientObject.address);
    summary.emergencyContact = maskEmergencyContact(patientObject.emergencyContact);
    summary.insuranceDetails = maskInsuranceDetails(patientObject.insuranceDetails);
  }

  return summary;
};

// Static method to find patients by county
patientSchema.statics.findByCounty = function(county, options = {}) {
  const query = { 'address.county': county };
  
  if (options.isActive !== undefined) {
    query.isActive = options.isActive;
  }
  
  if (options.ageRange) {
    const today = new Date();
    const minDate = new Date(today.getFullYear() - options.ageRange.max, today.getMonth(), today.getDate());
    const maxDate = new Date(today.getFullYear() - options.ageRange.min, today.getMonth(), today.getDate());
    query.dateOfBirth = { $gte: maxDate, $lte: minDate };
  }
  
  return this.find(query)
    .sort({ firstName: 1, lastName: 1 });
};

// Static method to get patient statistics by county
patientSchema.statics.getCountyStatistics = async function() {
  try {
    const stats = await this.aggregate([
      {
        $group: {
          _id: '$address.county',
          totalPatients: { $sum: 1 },
          activePatients: { $sum: { $cond: ['$isActive', 1, 0] } },
          avgAge: { $avg: { $dateDiff: { startDate: '$dateOfBirth', endDate: '$$NOW', unit: 'year' } } },
          genderDistribution: {
            $push: {
              gender: '$gender',
              count: 1
            }
          }
        }
      },
      { $sort: { totalPatients: -1 } }
    ]);
    
    return stats;
  } catch (error) {
    logger.error('Failed to get county statistics:', error);
    throw error;
  }
};

// Static method to find patients by criteria
patientSchema.statics.findByCriteria = function(criteria) {
  const query = {};
  
  if (criteria.county) {
    query['address.county'] = criteria.county;
  }
  
  if (criteria.subCounty) {
    query['address.subCounty'] = criteria.subCounty;
  }
  
  if (criteria.gender) {
    query.gender = criteria.gender;
  }
  
  if (criteria.bloodType) {
    query.bloodType = criteria.bloodType;
  }
  
  if (criteria.hasAllergies) {
    query['allergies.0'] = { $exists: true };
  }
  
  if (criteria.isActive !== undefined) {
    query.isActive = criteria.isActive;
  }
  
  return this.find(query)
    .sort({ firstName: 1, lastName: 1 });
};

// Method to add vital sign reference (for new VitalSign model)
patientSchema.methods.addVitalSignReference = function(vitalSignId) {
  this.vitalSigns.push(vitalSignId);
  return this.save();
};

// Method to remove vital sign reference
patientSchema.methods.removeVitalSignReference = function(vitalSignId) {
  this.vitalSigns = this.vitalSigns.filter(id => 
    id.toString() !== vitalSignId.toString()
  );
  return this.save();
};

module.exports = mongoose.model('Patient', patientSchema); 