const mongoose = require('mongoose');
const logger = require('../utils/logger');

const vitalSignSchema = new mongoose.Schema({
  // Patient reference
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  
  // Healthcare professional who recorded the vitals
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Timestamp of recording
  recordedAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  
  // Vital Sign Measurements with comprehensive validation
  
  // Temperature
  temperature: {
    value: {
      type: Number,
      min: 30,
      max: 45,
      validate: {
        validator: function(v) {
          return v === null || (v >= 30 && v <= 45);
        },
        message: 'Temperature must be between 30°C and 45°C'
      }
    },
    unit: {
      type: String,
      enum: ['C', 'F'],
      default: 'C'
    }
  },
  
  // Blood Pressure (Systolic/Diastolic)
  bloodPressure: {
    systolic: {
      type: Number,
      min: 60,
      max: 250,
      validate: {
        validator: function(v) {
          return v === null || (v >= 60 && v <= 250);
        },
        message: 'Systolic blood pressure must be between 60 and 250 mmHg'
      }
    },
    diastolic: {
      type: Number,
      min: 30,
      max: 150,
      validate: {
        validator: function(v) {
          return v === null || (v >= 30 && v <= 150);
        },
        message: 'Diastolic blood pressure must be between 30 and 150 mmHg'
      }
    }
  },
  
  // Heart Rate (beats per minute)
  heartRate: {
    type: Number,
    min: 20,
    max: 250,
    validate: {
      validator: function(v) {
        return v === null || (v >= 20 && v <= 250);
      },
      message: 'Heart rate must be between 20 and 250 BPM'
    }
  },
  
  // Respiratory Rate (breaths per minute)
  respiratoryRate: {
    type: Number,
    min: 5,
    max: 60,
    validate: {
      validator: function(v) {
        return v === null || (v >= 5 && v <= 60);
      },
      message: 'Respiratory rate must be between 5 and 60 RPM'
    }
  },
  
  // Oxygen Saturation (SpO2 percentage)
  oxygenSaturation: {
    type: Number,
    min: 0,
    max: 100,
    validate: {
      validator: function(v) {
        return v === null || (v >= 0 && v <= 100);
      },
      message: 'Oxygen saturation must be between 0% and 100%'
    }
  },
  
  // Weight
  weight: {
    value: {
      type: Number,
      min: 0,
      max: 500,
      validate: {
        validator: function(v) {
          return v === null || (v >= 0 && v <= 500);
        },
        message: 'Weight must be between 0 and 500 kg'
      }
    },
    unit: {
      type: String,
      enum: ['kg', 'lbs'],
      default: 'kg'
    }
  },
  
  // Height
  height: {
    value: {
      type: Number,
      min: 0,
      max: 300,
      validate: {
        validator: function(v) {
          return v === null || (v >= 0 && v <= 300);
        },
        message: 'Height must be between 0 and 300 cm'
      }
    },
    unit: {
      type: String,
      enum: ['cm', 'in'],
      default: 'cm'
    }
  },
  
  // BMI (calculated automatically)
  bmi: {
    type: Number,
    min: 0,
    max: 100
  },
  
  // Additional vital signs for comprehensive monitoring
  painLevel: {
    type: Number,
    min: 0,
    max: 10,
    validate: {
      validator: function(v) {
        return v === null || (v >= 0 && v <= 10);
      },
      message: 'Pain level must be between 0 and 10'
    }
  },
  
  // Blood Glucose (for diabetic patients)
  bloodGlucose: {
    value: {
      type: Number,
      min: 0,
      max: 1000,
      validate: {
        validator: function(v) {
          return v === null || (v >= 0 && v <= 1000);
        },
        message: 'Blood glucose must be between 0 and 1000 mg/dL'
      }
    },
    unit: {
      type: String,
      enum: ['mg/dL', 'mmol/L'],
      default: 'mg/dL'
    }
  },
  
  // Status for Draft/Final tracking
  status: {
    type: String,
    enum: ['draft', 'final', 'amended'],
    default: 'draft',
    required: true,
    index: true
  },
  
  // Clinical notes
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Audit fields
  amendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  amendedAt: {
    type: Date,
    default: null
  },
  
  amendmentReason: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
vitalSignSchema.index({ patient: 1, recordedAt: -1 });
vitalSignSchema.index({ recordedBy: 1, recordedAt: -1 });
vitalSignSchema.index({ status: 1, recordedAt: -1 });
vitalSignSchema.index({ 'bloodPressure.systolic': 1 });
vitalSignSchema.index({ 'bloodPressure.diastolic': 1 });
vitalSignSchema.index({ heartRate: 1 });

// Pre-save middleware to calculate BMI
vitalSignSchema.pre('save', function(next) {
  try {
    if (this.weight && this.height && this.weight.value > 0 && this.height.value > 0) {
      // Convert to consistent units for calculation
      let weightKg = this.weight.value;
      let heightMeters = this.height.value;

      // Convert weight to kg if needed
      if (this.weight.unit === 'lbs') {
        weightKg = this.weight.value * 0.453592; // lbs to kg
      }
      
      // Convert height to meters if needed
      if (this.height.unit === 'in') {
        heightMeters = this.height.value * 0.0254; // inches to meters
      } else if (this.height.unit === 'cm') {
        heightMeters = this.height.value / 100; // cm to meters
      }

      // Calculate BMI
      if (heightMeters > 0) {
        this.bmi = Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10; // Round to 1 decimal place
      }
    }
    
    // Handle amendment tracking
    if (this.isModified('status') && this.status === 'amended' && !this.amendedAt) {
      this.amendedAt = new Date();
    }
    
    next();
  } catch (error) {
    logger.error('Error in vital sign pre-save middleware:', error);
    next(error);
  }
});

// Virtual for BMI category
vitalSignSchema.virtual('bmiCategory').get(function() {
  if (!this.bmi) return null;
  
  if (this.bmi < 18.5) return 'underweight';
  if (this.bmi < 25) return 'normal';
  if (this.bmi < 30) return 'overweight';
  if (this.bmi < 35) return 'obese_class_1';
  if (this.bmi < 40) return 'obese_class_2';
  return 'obese_class_3';
});

// Virtual for blood pressure category
vitalSignSchema.virtual('bloodPressureCategory').get(function() {
  if (!this.bloodPressure || !this.bloodPressure.systolic || !this.bloodPressure.diastolic) {
    return null;
  }
  
  const systolic = this.bloodPressure.systolic;
  const diastolic = this.bloodPressure.diastolic;
  
  if (systolic < 120 && diastolic < 80) return 'normal';
  if (systolic < 130 && diastolic < 80) return 'elevated';
  if (systolic < 140 && diastolic < 90) return 'stage_1_hypertension';
  if (systolic >= 140 || diastolic >= 90) return 'stage_2_hypertension';
  if (systolic > 180 || diastolic > 120) return 'hypertensive_crisis';
  
  return 'unknown';
});

// Method to get vital sign summary
vitalSignSchema.methods.getSummary = function() {
  return {
    _id: this._id,
    patient: this.patient,
    recordedBy: this.recordedBy,
    recordedAt: this.recordedAt,
    temperature: this.temperature,
    bloodPressure: this.bloodPressure,
    heartRate: this.heartRate,
    respiratoryRate: this.respiratoryRate,
    oxygenSaturation: this.oxygenSaturation,
    weight: this.weight,
    height: this.height,
    bmi: this.bmi,
    bmiCategory: this.bmiCategory,
    bloodPressureCategory: this.bloodPressureCategory,
    painLevel: this.painLevel,
    bloodGlucose: this.bloodGlucose,
    status: this.status,
    notes: this.notes,
    amendedBy: this.amendedBy,
    amendedAt: this.amendedAt,
    amendmentReason: this.amendmentReason,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Method to mark as final
vitalSignSchema.methods.markAsFinal = function() {
  this.status = 'final';
  return this.save();
};

// Method to mark as amended
vitalSignSchema.methods.markAsAmended = function(amendedBy, reason) {
  this.status = 'amended';
  this.amendedBy = amendedBy;
  this.amendmentReason = reason;
  this.amendedAt = new Date();
  return this.save();
};

// Static method to get latest vital signs for a patient
vitalSignSchema.statics.getLatestVitalSigns = function(patientId, limit = 10) {
  return this.find({ patient: patientId })
    .sort({ recordedAt: -1 })
    .limit(limit)
    .populate('recordedBy', 'fullName email')
    .populate('amendedBy', 'fullName email');
};

// Static method to get vital signs by status
vitalSignSchema.statics.getByStatus = function(patientId, status) {
  return this.find({ patient: patientId, status })
    .sort({ recordedAt: -1 })
    .populate('recordedBy', 'fullName email');
};

// Static method to get vital signs within date range
vitalSignSchema.statics.getByDateRange = function(patientId, startDate, endDate) {
  return this.find({
    patient: patientId,
    recordedAt: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .sort({ recordedAt: -1 })
  .populate('recordedBy', 'fullName email');
};

module.exports = mongoose.model('VitalSign', vitalSignSchema); 