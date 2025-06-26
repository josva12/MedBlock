const mongoose = require('mongoose');
const logger = require('../utils/logger');

const encounterSchema = new mongoose.Schema({
  // Basic Information
  encounterId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Patient Reference (One-to-Many relationship)
  patientId: {
    type: String,
    required: true,
    ref: 'Patient'
  },
  
  // Encounter Details
  encounterDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  encounterType: {
    type: String,
    enum: [
      'outpatient',
      'inpatient',
      'emergency',
      'surgery',
      'consultation',
      'follow_up',
      'vaccination',
      'screening',
      'laboratory',
      'imaging',
      'pharmacy'
    ],
    required: true
  },
  
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'scheduled'
  },
  
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent', 'emergency'],
    default: 'normal'
  },
  
  // Healthcare Provider Information
  practitioner: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['doctor', 'nurse', 'specialist', 'pharmacist', 'lab_technician', 'radiologist'],
      required: true
    },
    department: String,
    licenseNumber: String
  },
  
  // Facility Information
  facility: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility'
    },
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['hospital', 'clinic', 'pharmacy', 'laboratory', 'imaging_center']
    },
    address: {
      street: String,
      city: String,
      county: String,
      subCounty: String
    }
  },
  
  // Clinical Information
  chiefComplaint: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  historyOfPresentIllness: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  
  // Embedded Diagnoses (Frequently accessed together)
  diagnoses: [{
    icd10Code: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['primary', 'secondary', 'differential'],
      default: 'primary'
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'critical']
    },
    status: {
      type: String,
      enum: ['suspected', 'confirmed', 'ruled_out'],
      default: 'suspected'
    },
    notes: String,
    diagnosedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    diagnosedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Embedded Prescriptions (Frequently accessed together)
  prescriptions: [{
    medication: {
      name: {
        type: String,
        required: true,
        trim: true
      },
      genericName: String,
      dosageForm: {
        type: String,
        enum: ['tablet', 'capsule', 'liquid', 'injection', 'cream', 'inhaler', 'drops']
      },
      strength: String
    },
    dosage: {
      amount: {
        type: Number,
        required: true
      },
      unit: {
        type: String,
        required: true,
        enum: ['mg', 'g', 'ml', 'mcg', 'units', 'puffs', 'drops']
      },
      frequency: {
        type: String,
        required: true,
        enum: ['once_daily', 'twice_daily', 'thrice_daily', 'four_times_daily', 'as_needed', 'every_4_hours', 'every_6_hours', 'every_8_hours', 'every_12_hours']
      },
      duration: {
        value: Number,
        unit: {
          type: String,
          enum: ['days', 'weeks', 'months']
        }
      }
    },
    instructions: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true
    },
    refills: {
      type: Number,
      default: 0
    },
    isDispensed: {
      type: Boolean,
      default: false
    },
    dispensedAt: Date,
    dispensedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sideEffects: [String],
    contraindications: [String],
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    prescribedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Embedded Lab Results (Frequently accessed together)
  labResults: [{
    testName: {
      type: String,
      required: true,
      trim: true
    },
    testCode: String,
    specimenType: {
      type: String,
      enum: ['blood', 'urine', 'stool', 'sputum', 'tissue', 'swab', 'other']
    },
    collectionDate: Date,
    resultDate: Date,
    status: {
      type: String,
      enum: ['ordered', 'collected', 'processing', 'completed', 'cancelled'],
      default: 'ordered'
    },
    results: [{
      parameter: {
        type: String,
        required: true,
        trim: true
      },
      value: String,
      unit: String,
      referenceRange: String,
      isAbnormal: Boolean,
      interpretation: String
    }],
    interpretation: String,
    recommendations: String,
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Embedded Imaging Results (Frequently accessed together)
  imagingResults: [{
    modality: {
      type: String,
      enum: ['x-ray', 'ct', 'mri', 'ultrasound', 'pet', 'nuclear_medicine', 'fluoroscopy'],
      required: true
    },
    bodyPart: {
      type: String,
      required: true,
      trim: true
    },
    technique: String,
    status: {
      type: String,
      enum: ['ordered', 'in_progress', 'completed', 'cancelled'],
      default: 'ordered'
    },
    findings: String,
    impression: String,
    recommendations: String,
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    orderedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date
  }],
  
  // Vital Signs at Encounter
  vitalSigns: {
    bloodPressure: {
      systolic: Number,
      diastolic: Number
    },
    temperature: Number,
    pulse: Number,
    respiratoryRate: Number,
    oxygenSaturation: Number,
    weight: Number,
    height: Number,
    recordedAt: {
      type: Date,
      default: Date.now
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Physical Examination
  physicalExamination: {
    generalAppearance: String,
    cardiovascular: String,
    respiratory: String,
    gastrointestinal: String,
    musculoskeletal: String,
    neurological: String,
    skin: String,
    notes: String
  },
  
  // Treatment Plan
  treatmentPlan: {
    goals: [String],
    interventions: [{
      type: String,
      description: String,
      frequency: String,
      duration: String
    }],
    followUpSchedule: [{
      type: String,
      date: Date,
      provider: String,
      notes: String
    }]
  },
  
  // Discharge Information (for inpatient encounters)
  discharge: {
    date: Date,
    disposition: {
      type: String,
      enum: ['home', 'rehabilitation', 'nursing_home', 'hospice', 'transfer', 'expired']
    },
    instructions: String,
    medications: [String],
    followUpAppointment: Date,
    dischargedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Billing Information
  billing: {
    totalAmount: {
      type: Number,
      default: 0
    },
    insuranceCoverage: {
      type: Number,
      default: 0
    },
    patientResponsibility: {
      type: Number,
      default: 0
    },
    isPaid: {
      type: Boolean,
      default: false
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'insurance', 'nhif', 'mpesa', 'bank_transfer']
    },
    paidAt: Date
  },
  
  // Notes and Documentation
  notes: [{
    content: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['progress_note', 'nursing_note', 'consultation_note', 'discharge_note'],
      default: 'progress_note'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
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

// Virtual for encounter duration
encounterSchema.virtual('duration').get(function() {
  if (!this.encounterDate) return null;
  const endDate = this.discharge?.date || new Date();
  const duration = endDate - this.encounterDate;
  return Math.ceil(duration / (1000 * 60 * 60 * 24)); // Days
});

// Virtual for encounter summary
encounterSchema.virtual('summary').get(function() {
  return {
    encounterId: this.encounterId,
    patientId: this.patientId,
    encounterType: this.encounterType,
    status: this.status,
    encounterDate: this.encounterDate,
    practitioner: this.practitioner.name,
    facility: this.facility.name,
    diagnoses: this.diagnoses.length,
    prescriptions: this.prescriptions.length,
    labResults: this.labResults.length,
    imagingResults: this.imagingResults.length
  };
});

// Indexes for efficient querying
encounterSchema.index({ patientId: 1, encounterDate: -1 });
encounterSchema.index({ encounterDate: -1 });
encounterSchema.index({ encounterType: 1 });
encounterSchema.index({ status: 1 });
encounterSchema.index({ 'practitioner.id': 1 });
encounterSchema.index({ 'facility.id': 1 });
encounterSchema.index({ createdAt: -1 });

// Pre-save middleware to generate encounter ID
encounterSchema.pre('save', async function(next) {
  try {
    if (!this.encounterId) {
      const count = await this.constructor.countDocuments();
      const timestamp = Date.now().toString().slice(-6);
      this.encounterId = `ENC${timestamp}${String(count + 1).padStart(4, '0')}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to add diagnosis
encounterSchema.methods.addDiagnosis = function(diagnosisData) {
  this.diagnoses.push({
    ...diagnosisData,
    diagnosedAt: new Date()
  });
  return this.save();
};

// Instance method to add prescription
encounterSchema.methods.addPrescription = function(prescriptionData, prescribedBy) {
  this.prescriptions.push({
    ...prescriptionData,
    prescribedBy,
    prescribedAt: new Date()
  });
  return this.save();
};

// Instance method to add lab result
encounterSchema.methods.addLabResult = function(labData) {
  this.labResults.push({
    ...labData,
    resultDate: new Date()
  });
  return this.save();
};

// Instance method to add imaging result
encounterSchema.methods.addImagingResult = function(imagingData) {
  this.imagingResults.push({
    ...imagingData,
    completedAt: new Date()
  });
  return this.save();
};

// Instance method to add note
encounterSchema.methods.addNote = function(content, type, createdBy) {
  this.notes.push({
    content,
    type,
    createdBy,
    createdAt: new Date()
  });
  return this.save();
};

// Static method to find encounters by patient
encounterSchema.statics.findByPatient = function(patientId, options = {}) {
  const query = { patientId };
  
  if (options.encounterType) {
    query.encounterType = options.encounterType;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.dateRange) {
    query.encounterDate = {
      $gte: options.dateRange.start,
      $lte: options.dateRange.end
    };
  }
  
  return this.find(query)
    .sort({ encounterDate: -1 })
    .limit(options.limit || 50)
    .populate('practitioner.id', 'firstName lastName')
    .populate('facility.id', 'name');
};

// Static method to find encounters by practitioner
encounterSchema.statics.findByPractitioner = function(practitionerId, options = {}) {
  const query = { 'practitioner.id': practitionerId };
  
  if (options.encounterType) {
    query.encounterType = options.encounterType;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.dateRange) {
    query.encounterDate = {
      $gte: options.dateRange.start,
      $lte: options.dateRange.end
    };
  }
  
  return this.find(query)
    .sort({ encounterDate: -1 })
    .limit(options.limit || 50)
    .populate('patientId', 'firstName lastName patientId')
    .populate('facility.id', 'name');
};

// Static method to get encounter statistics
encounterSchema.statics.getStatistics = async function(filters = {}) {
  try {
    const matchStage = {};
    
    if (filters.patientId) {
      matchStage.patientId = filters.patientId;
    }
    
    if (filters.encounterType) {
      matchStage.encounterType = filters.encounterType;
    }
    
    if (filters.dateRange) {
      matchStage.encounterDate = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }
    
    const stats = await this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalEncounters: { $sum: 1 },
          completedEncounters: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pendingEncounters: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          avgDuration: { $avg: '$duration' },
          encounterTypeDistribution: {
            $push: {
              type: '$encounterType',
              count: 1
            }
          }
        }
      }
    ]);
    
    return stats[0] || { 
      totalEncounters: 0, 
      completedEncounters: 0, 
      pendingEncounters: 0, 
      avgDuration: 0,
      encounterTypeDistribution: []
    };
  } catch (error) {
    logger.error('Failed to get encounter statistics:', error);
    throw error;
  }
};

// Static method to find encounters by criteria
encounterSchema.statics.findByCriteria = function(criteria) {
  const query = {};
  
  if (criteria.patientId) {
    query.patientId = criteria.patientId;
  }
  
  if (criteria.encounterType) {
    query.encounterType = criteria.encounterType;
  }
  
  if (criteria.status) {
    query.status = criteria.status;
  }
  
  if (criteria.practitionerId) {
    query['practitioner.id'] = criteria.practitionerId;
  }
  
  if (criteria.facilityId) {
    query['facility.id'] = criteria.facilityId;
  }
  
  if (criteria.dateRange) {
    query.encounterDate = {
      $gte: criteria.dateRange.start,
      $lte: criteria.dateRange.end
    };
  }
  
  if (criteria.hasDiagnoses) {
    query['diagnoses.0'] = { $exists: true };
  }
  
  if (criteria.hasPrescriptions) {
    query['prescriptions.0'] = { $exists: true };
  }
  
  return this.find(query)
    .sort({ encounterDate: -1 })
    .populate('patientId', 'firstName lastName patientId')
    .populate('practitioner.id', 'firstName lastName')
    .populate('facility.id', 'name');
};

module.exports = mongoose.model('Encounter', encounterSchema); 