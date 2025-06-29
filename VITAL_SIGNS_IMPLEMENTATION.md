# Vital Signs Implementation Guide

## Overview

The Vital Signs feature has been successfully implemented in MedBlock, providing comprehensive medical checklist functionality with draft saving capabilities. This implementation allows healthcare professionals to record, save as drafts, and finalize patient vital signs with full audit trails.

## Data Model

### VitalSign Schema (`src/models/VitalSign.js`)

The VitalSign model includes comprehensive vital sign measurements with validation:

```javascript
{
  // Core References
  patient: ObjectId (ref: 'Patient') - Required
  recordedBy: ObjectId (ref: 'User') - Required
  recordedAt: Date - Default: Date.now
  
  // Vital Measurements
  temperature: {
    value: Number (30-45°C),
    unit: String ('C'|'F') - Default: 'C'
  },
  bloodPressure: {
    systolic: Number (60-250 mmHg),
    diastolic: Number (30-150 mmHg)
  },
  heartRate: Number (20-250 BPM),
  respiratoryRate: Number (5-60 RPM),
  oxygenSaturation: Number (0-100%),
  weight: {
    value: Number (0-500),
    unit: String ('kg'|'lbs') - Default: 'kg'
  },
  height: {
    value: Number (0-300),
    unit: String ('cm'|'in') - Default: 'cm'
  },
  bmi: Number (calculated automatically),
  painLevel: Number (0-10),
  bloodGlucose: {
    value: Number (0-1000),
    unit: String ('mg/dL'|'mmol/L') - Default: 'mg/dL'
  },
  
  // Status Management
  status: String ('draft'|'final'|'amended') - Default: 'draft'
  notes: String (max 1000 chars)
  
  // Audit Fields
  amendedBy: ObjectId (ref: 'User'),
  amendedAt: Date,
  amendmentReason: String (max 500 chars)
}
```

### Key Features

1. **Automatic BMI Calculation**: Pre-save middleware calculates BMI from weight and height
2. **Virtual Fields**: BMI category and blood pressure category calculations
3. **Status Tracking**: Draft, final, and amended statuses with audit trails
4. **Comprehensive Validation**: Range validation for all vital measurements
5. **Unit Conversion**: Automatic unit handling for calculations

## API Endpoints

### 1. Create Vital Sign
```
POST /api/v1/vital-signs
```

**Request Body:**
```json
{
  "patientId": "507f1f77bcf86cd799439011",
  "status": "draft", // or "final"
  "temperature": {
    "value": 37.2,
    "unit": "C"
  },
  "bloodPressure": {
    "systolic": 120,
    "diastolic": 80
  },
  "heartRate": 72,
  "respiratoryRate": 16,
  "oxygenSaturation": 98,
  "weight": {
    "value": 70,
    "unit": "kg"
  },
  "height": {
    "value": 175,
    "unit": "cm"
  },
  "painLevel": 2,
  "bloodGlucose": {
    "value": 95,
    "unit": "mg/dL"
  },
  "notes": "Patient appears healthy"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vital sign draft saved",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "patient": { /* patient summary */ },
    "recordedBy": { /* user summary */ },
    "status": "draft",
    "bmi": 22.9,
    "bmiCategory": "normal",
    "bloodPressureCategory": "normal",
    // ... other vital signs
  }
}
```

### 2. Get Vital Signs (with filtering and pagination)
```
GET /api/v1/vital-signs?patientId=xxx&status=draft&page=1&limit=20&sortBy=recordedAt&sortOrder=desc
```

**Query Parameters:**
- `patientId`: Filter by specific patient
- `status`: Filter by status (draft/final/amended)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sortBy`: Sort field (recordedAt, status, etc.)
- `sortOrder`: asc/desc (default: desc)
- `startDate`: Filter by start date
- `endDate`: Filter by end date

### 3. Get Specific Vital Sign
```
GET /api/v1/vital-signs/:id
```

### 4. Update Draft Vital Sign
```
PUT /api/v1/vital-signs/:id
```

**Note:** Only draft vital signs can be updated. Status, patient, and recordedBy fields cannot be modified.

### 5. Finalize Draft
```
PATCH /api/v1/vital-signs/:id/finalize
```

Changes status from 'draft' to 'final'.

### 6. Amend Vital Sign
```
PATCH /api/v1/vital-signs/:id/amend
```

**Request Body:**
```json
{
  "reason": "Corrected measurement error"
}
```

### 7. Delete Draft
```
DELETE /api/v1/vital-signs/:id
```

**Note:** Only draft vital signs can be deleted.

### 8. Get Patient Vital Signs
```
GET /api/v1/vital-signs/patient/:patientId?status=draft&limit=50&sortOrder=desc
```

## Patient Model Integration

The Patient model has been updated to reference VitalSign documents:

```javascript
// Old embedded approach (removed)
vitalSigns: [{
  timestamp: Date,
  bloodPressure: { /* ... */ },
  // ... other embedded fields
}]

// New reference approach
vitalSigns: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'VitalSign'
}]
```

### New Patient Methods

1. **addVitalSignReference(vitalSignId)**: Add vital sign reference to patient
2. **removeVitalSignReference(vitalSignId)**: Remove vital sign reference from patient
3. **Virtual Fields**:
   - `latestVitalSigns`: Get all vital signs
   - `latestFinalVitalSigns`: Get most recent final vital signs
   - `draftVitalSigns`: Get all draft vital signs

## Validation and Error Handling

### Input Validation

1. **ObjectId Validation**: All ID parameters are validated
2. **Range Validation**: Vital measurements have medical range limits
3. **Status Validation**: Only valid status transitions allowed
4. **Pagination Validation**: Page and limit parameters validated
5. **Sorting Validation**: Sort fields and orders validated

### Error Responses

```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Temperature must be between 30°C and 45°C"],
  "debug": {
    "error": "ValidationError details"
  }
}
```

## Security Features

1. **Authentication Required**: All endpoints require valid JWT token
2. **Role-Based Access**: Access controlled by user roles
3. **Audit Logging**: All operations logged with user context
4. **Status Protection**: Only authorized status changes allowed
5. **Reference Integrity**: Patient references maintained

## Usage Examples

### Creating a Draft Vital Sign

```javascript
// Save incomplete vital signs as draft
const draftVitalSign = await axios.post('/api/v1/vital-signs', {
  patientId: 'patient123',
  status: 'draft',
  temperature: { value: 37.2, unit: 'C' },
  heartRate: 72,
  notes: 'Partial measurements - to be completed'
});
```

### Finalizing a Draft

```javascript
// Complete the vital sign recording
await axios.patch(`/api/v1/vital-signs/${draftId}/finalize`);
```

### Updating a Draft

```javascript
// Modify draft before finalizing
await axios.put(`/api/v1/vital-signs/${draftId}`, {
  temperature: { value: 37.5, unit: 'C' },
  notes: 'Updated temperature reading'
});
```

### Getting Patient Vital Signs

```javascript
// Get all vital signs for a patient
const patientVitals = await axios.get(`/api/v1/vital-signs/patient/${patientId}`);

// Get only draft vital signs
const draftVitals = await axios.get(`/api/v1/vital-signs/patient/${patientId}?status=draft`);
```

## Testing

A comprehensive test script (`test_vital_signs.js`) is provided to verify:

1. ✅ Authentication and authorization
2. ✅ Vital sign creation (draft and final)
3. ✅ Draft updates and finalization
4. ✅ Vital sign amendment
5. ✅ Patient-specific vital signs retrieval
6. ✅ Filtering and pagination
7. ✅ Draft deletion
8. ✅ Error handling and validation

## Database Indexes

The following indexes are created for optimal performance:

```javascript
// VitalSign indexes
{ patient: 1, recordedAt: -1 }
{ recordedBy: 1, recordedAt: -1 }
{ status: 1, recordedAt: -1 }
{ 'bloodPressure.systolic': 1 }
{ 'bloodPressure.diastolic': 1 }
{ heartRate: 1 }
```

## Migration Notes

### From Embedded to Referenced Vital Signs

The Patient model has been updated from embedded vital signs to referenced VitalSign documents. This change provides:

1. **Better Scalability**: Vital signs stored as separate documents
2. **Draft Functionality**: Status tracking for incomplete records
3. **Audit Trails**: Amendment tracking and history
4. **Performance**: Efficient querying and indexing
5. **Data Integrity**: Proper validation and constraints

### Backward Compatibility

The system maintains backward compatibility by:
- Handling legacy embedded vital signs in virtual fields
- Providing migration utilities if needed
- Supporting both old and new data structures

## Future Enhancements

1. **Trend Analysis**: Historical vital sign trends and alerts
2. **Integration**: Connect with medical devices for automatic data capture
3. **Notifications**: Alert system for abnormal vital signs
4. **Reporting**: Advanced analytics and reporting features
5. **Mobile Support**: Mobile-optimized vital sign entry

## Conclusion

The Vital Signs implementation provides a robust, scalable foundation for medical checklist management in MedBlock. The draft functionality allows healthcare professionals to save incomplete measurements and finalize them later, while comprehensive validation and audit trails ensure data integrity and compliance. 