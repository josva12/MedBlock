const mongoose = require('mongoose');
const logger = require('../utils/logger');

const patientSchema = new mongoose.Schema({
  // Basic Information
  patientId: {
    type: String,
    required: true,
    unique: true
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
    validate: {
      validator: function(v) {
        return /^\d{8}$/.test(v);
      },
      message: 'National ID must be exactly 8 digits'
    }
  },
  
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
  
  vitalSigns: [{
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    bloodPressure: {
      systolic: {
        type: Number,
        min: 70,
        max: 200
      },
      diastolic: {
        type: Number,
        min: 40,
        max: 130
      }
    },
    temperature: {
      type: Number,
      min: 35,
      max: 42
    },
    pulse: {
      type: Number,
      min: 40,
      max: 200
    },
    respiratoryRate: {
      type: Number,
      min: 8,
      max: 40
    },
    oxygenSaturation: {
      type: Number,
      min: 70,
      max: 100
    },
    weight: {
      type: Number,
      min: 1,
      max: 300
    },
    height: {
      type: Number,
      min: 50,
      max: 250
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
  const latestVitals = this.vitalSigns[this.vitalSigns.length - 1];
  if (!latestVitals || !latestVitals.height || !latestVitals.weight) return null;
  const heightInMeters = latestVitals.height / 100;
  return (latestVitals.weight / (heightInMeters * heightInMeters)).toFixed(1);
});

// Virtual for latest vital signs
patientSchema.virtual('latestVitalSigns').get(function() {
  return this.vitalSigns.length > 0 ? this.vitalSigns[this.vitalSigns.length - 1] : null;
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
    county: this.address.county,
    isActive: this.isActive,
    isVerified: this.isVerified,
    allergies: this.allergies.length,
    medicalHistory: this.medicalHistory.length,
    vitalSigns: this.vitalSigns.length
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
    county: this.address.county,
    isActive: this.isActive,
    isVerified: this.isVerified,
    allergies: this.allergies.length,
    medicalHistory: this.medicalHistory.length,
    vitalSigns: this.vitalSigns.length
  };
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

module.exports = mongoose.model('Patient', patientSchema); 