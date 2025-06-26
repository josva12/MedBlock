const mongoose = require('mongoose');
const logger = require('../utils/logger');

const medicalRecordSchema = new mongoose.Schema({
  // Basic Information
  recordId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Patient Reference
  patientId: {
    type: String,
    required: true,
    ref: 'Patient'
  },
  
  // Record Details
  recordType: {
    type: String,
    enum: [
      'lab_report',
      'prescription',
      'diagnosis',
      'treatment_plan',
      'surgery_report',
      'imaging_report',
      'vaccination_record',
      'allergy_test',
      'vital_signs',
      'consultation_note',
      'discharge_summary',
      'emergency_report',
      'pharmacy_dispense',
      'pathology_report',
      'radiology_report'
    ],
    required: true
  },
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  recordDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  status: {
    type: String,
    enum: ['draft', 'pending', 'completed', 'reviewed', 'archived'],
    default: 'draft'
  },
  
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent', 'emergency'],
    default: 'normal'
  },
  
  accessLevel: {
    type: String,
    enum: ['public', 'restricted', 'confidential', 'highly_confidential'],
    default: 'restricted'
  },
  
  // Healthcare Provider Information
  provider: {
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
  
  // Encrypted Data (Sensitive clinical information)
  encryptedData: {
    type: String,
    required: true
  },
  
  // Data Integrity
  dataHash: {
    type: String,
    required: true
  },
  
  // Blockchain Integration
  blockchain: {
    transactionHash: String,
    blockNumber: Number,
    timestamp: Date,
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationAttempts: {
      type: Number,
      default: 0
    }
  },
  
  // File Attachments
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Tags for categorization
  tags: [{
    type: String,
    trim: true
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

// Virtual for record age
medicalRecordSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.recordDate) / (1000 * 60 * 60 * 24)); // Days
});

// Virtual for record summary
medicalRecordSchema.virtual('summary').get(function() {
  return {
    recordId: this.recordId,
    patientId: this.patientId,
    recordType: this.recordType,
    title: this.title,
    status: this.status,
    priority: this.priority,
    recordDate: this.recordDate,
    provider: this.provider.name,
    facility: this.facility.name,
    hasAttachments: this.attachments.length > 0,
    isBlockchainVerified: this.blockchain.isVerified
  };
});

// Indexes for efficient querying
medicalRecordSchema.index({ patientId: 1, recordDate: -1 });
medicalRecordSchema.index({ recordType: 1 });
medicalRecordSchema.index({ status: 1 });
medicalRecordSchema.index({ priority: 1 });
medicalRecordSchema.index({ 'provider.id': 1 });
medicalRecordSchema.index({ 'facility.id': 1 });
medicalRecordSchema.index({ createdAt: -1 });
medicalRecordSchema.index({ tags: 1 });

// Pre-save middleware to generate record ID
medicalRecordSchema.pre('save', async function(next) {
  try {
    if (!this.recordId) {
      const count = await this.constructor.countDocuments();
      const timestamp = Date.now().toString().slice(-6);
      const typePrefix = this.recordType.substring(0, 3).toUpperCase();
      this.recordId = `${typePrefix}${timestamp}${String(count + 1).padStart(4, '0')}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to add attachment
medicalRecordSchema.methods.addAttachment = function(attachmentData, uploadedBy) {
  this.attachments.push({
    ...attachmentData,
    uploadedBy,
    uploadedAt: new Date()
  });
  return this.save();
};

// Instance method to remove attachment
medicalRecordSchema.methods.removeAttachment = function(filename) {
  this.attachments = this.attachments.filter(att => att.filename !== filename);
  return this.save();
};

// Instance method to update blockchain status
medicalRecordSchema.methods.updateBlockchainStatus = function(transactionHash, blockNumber, isVerified = false) {
  this.blockchain = {
    transactionHash,
    blockNumber,
    timestamp: new Date(),
    isVerified,
    verificationAttempts: this.blockchain.verificationAttempts + 1
  };
  return this.save();
};

// Instance method to add tag
medicalRecordSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this.save();
};

// Instance method to remove tag
medicalRecordSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

// Instance method to get record summary
medicalRecordSchema.methods.getSummary = function() {
  return {
    _id: this._id,
    recordId: this.recordId,
    patientId: this.patientId,
    recordType: this.recordType,
    title: this.title,
    status: this.status,
    priority: this.priority,
    recordDate: this.recordDate,
    provider: this.provider.name,
    facility: this.facility.name,
    hasAttachments: this.attachments.length > 0,
    isBlockchainVerified: this.blockchain.isVerified
  };
};

// Static method to find records by patient
medicalRecordSchema.statics.findByPatient = function(patientId, options = {}) {
  const query = { patientId };
  
  if (options.recordType) {
    query.recordType = options.recordType;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.priority) {
    query.priority = options.priority;
  }
  
  if (options.dateRange) {
    query.recordDate = {
      $gte: options.dateRange.start,
      $lte: options.dateRange.end
    };
  }
  
  if (options.providerId) {
    query['provider.id'] = options.providerId;
  }
  
  if (options.facilityId) {
    query['facility.id'] = options.facilityId;
  }
  
  return this.find(query)
    .sort({ recordDate: -1 })
    .limit(options.limit || 50)
    .populate('provider.id', 'firstName lastName')
    .populate('facility.id', 'name');
};

// Static method to find records by provider
medicalRecordSchema.statics.findByProvider = function(providerId, options = {}) {
  const query = { 'provider.id': providerId };
  
  if (options.recordType) {
    query.recordType = options.recordType;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.dateRange) {
    query.recordDate = {
      $gte: options.dateRange.start,
      $lte: options.dateRange.end
    };
  }
  
  return this.find(query)
    .sort({ recordDate: -1 })
    .limit(options.limit || 50)
    .populate('patientId', 'firstName lastName patientId')
    .populate('facility.id', 'name');
};

// Static method to find records by facility
medicalRecordSchema.statics.findByFacility = function(facilityId, options = {}) {
  const query = { 'facility.id': facilityId };
  
  if (options.recordType) {
    query.recordType = options.recordType;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.dateRange) {
    query.recordDate = {
      $gte: options.dateRange.start,
      $lte: options.dateRange.end
    };
  }
  
  return this.find(query)
    .sort({ recordDate: -1 })
    .limit(options.limit || 50)
    .populate('patientId', 'firstName lastName patientId')
    .populate('provider.id', 'firstName lastName');
};

// Static method to get record statistics
medicalRecordSchema.statics.getStatistics = function(filters = {}) {
  try {
    const matchStage = {};
    
    if (filters.patientId) {
      matchStage.patientId = filters.patientId;
    }
    
    if (filters.recordType) {
      matchStage.recordType = filters.recordType;
    }
    
    if (filters.dateRange) {
      matchStage.recordDate = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }
    
    return this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          completedRecords: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pendingRecords: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          blockchainVerified: { $sum: { $cond: ['$blockchain.isVerified', 1, 0] } },
          recordTypeDistribution: {
            $push: {
              type: '$recordType',
              count: 1
            }
          },
          priorityDistribution: {
            $push: {
              priority: '$priority',
              count: 1
            }
          }
        }
      }
    ]).then(function(stats) {
      return stats[0] || { 
        totalRecords: 0, 
        completedRecords: 0, 
        pendingRecords: 0, 
        blockchainVerified: 0,
        recordTypeDistribution: [],
        priorityDistribution: []
      };
    }).catch(function(error) {
      logger.error('Failed to get medical record statistics:', error);
      throw error;
    });
  } catch (error) {
    logger.error('Failed to get medical record statistics:', error);
    throw error;
  }
};

// Static method to find records by criteria
medicalRecordSchema.statics.findByCriteria = function(criteria) {
  const query = {};
  
  if (criteria.patientId) {
    query.patientId = criteria.patientId;
  }
  
  if (criteria.recordType) {
    query.recordType = criteria.recordType;
  }
  
  if (criteria.status) {
    query.status = criteria.status;
  }
  
  if (criteria.priority) {
    query.priority = criteria.priority;
  }
  
  if (criteria.providerId) {
    query['provider.id'] = criteria.providerId;
  }
  
  if (criteria.facilityId) {
    query['facility.id'] = criteria.facilityId;
  }
  
  if (criteria.dateRange) {
    query.recordDate = {
      $gte: criteria.dateRange.start,
      $lte: criteria.dateRange.end
    };
  }
  
  if (criteria.tags && criteria.tags.length > 0) {
    query.tags = { $in: criteria.tags };
  }
  
  if (criteria.hasAttachments) {
    query['attachments.0'] = { $exists: true };
  }
  
  if (criteria.isBlockchainVerified !== undefined) {
    query['blockchain.isVerified'] = criteria.isBlockchainVerified;
  }
  
  return this.find(query)
    .sort({ recordDate: -1 })
    .populate('patientId', 'firstName lastName patientId')
    .populate('provider.id', 'firstName lastName')
    .populate('facility.id', 'name');
};

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema); 