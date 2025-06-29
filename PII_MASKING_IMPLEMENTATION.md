# PII Masking Implementation for MedBlock

## Problem Statement

The MedBlock system was exposing sensitive Personally Identifiable Information (PII) such as phone numbers, email addresses, national IDs, and addresses to all users regardless of their role. This posed a significant security and privacy risk, especially for non-admin users who should only have limited access to sensitive patient data.

## Solution Implemented

### 1. Created PII Masking Utilities (`src/utils/masking.js`)

A comprehensive utility module was created with the following masking functions:

- **`maskEmail(email)`**: Masks email addresses (e.g., `john.doe@example.com` → `j***@example.com`)
- **`maskPhoneNumber(phone)`**: Masks Kenyan phone numbers (e.g., `+254712345678` → `+254***678`)
- **`maskNationalId(nationalId)`**: Masks national IDs (e.g., `12345678` → `123***78`)
- **`maskAddress(address)`**: Masks sensitive address fields (street, ward → `[REDACTED]`)
- **`maskEmergencyContact(emergencyContact)`**: Masks emergency contact PII
- **`maskInsuranceDetails(insuranceDetails)`**: Masks insurance policy numbers and IDs

### 2. Enhanced Patient Model (`src/models/Patient.js`)

Added a new method `getSummaryForRole(userRole)` that provides role-based data access:

```javascript
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
    // ... other non-sensitive fields
  };

  // Conditional PII handling based on role
  if (userRole === 'admin') {
    // Admin gets full access to all PII
    summary.phoneNumber = patientObject.phoneNumber;
    summary.email = patientObject.email;
    summary.nationalId = patientObject.nationalId;
    summary.address = patientObject.address;
    summary.emergencyContact = patientObject.emergencyContact;
    summary.insuranceDetails = patientObject.insuranceDetails;
  } else {
    // Non-admin roles get masked PII
    summary.phoneNumber = maskPhoneNumber(patientObject.phoneNumber);
    summary.email = maskEmail(patientObject.email);
    summary.nationalId = maskNationalId(patientObject.nationalId);
    summary.address = maskAddress(patientObject.address);
    summary.emergencyContact = maskEmergencyContact(patientObject.emergencyContact);
    summary.insuranceDetails = maskInsuranceDetails(patientObject.insuranceDetails);
  }

  return summary;
};
```

### 3. Updated Patient Routes (`src/routes/patients.js`)

Modified all patient-related routes to use the new `getSummaryForRole()` method:

- **GET `/api/v1/patients`**: List all patients with role-based masking
- **GET `/api/v1/patients/:id`**: Get single patient with role-based masking
- **POST `/api/v1/patients`**: Create patient with role-based response
- **PUT `/api/v1/patients/:id`**: Update patient with role-based response
- **PATCH `/api/v1/patients/:id`**: Partial update with role-based response
- **PATCH `/api/v1/patients/:id/checkin`**: Check-in status update with role-based response
- **PATCH `/api/v1/patients/:id/assign`**: Doctor assignment with role-based response

## How It Works

### Role-Based Access Control

1. **Admin Users**: Have full access to all patient PII including:
   - Complete phone numbers
   - Full email addresses
   - Unmasked national IDs
   - Complete address information
   - Emergency contact details
   - Insurance information

2. **Non-Admin Users** (doctors, nurses, etc.): Get masked PII:
   - Phone numbers: `+254***678` (shows country code and last 3 digits)
   - Email addresses: `j***@example.com` (shows first letter and domain)
   - National IDs: `123***78` (shows first 3 and last 2 digits)
   - Addresses: Street and ward are `[REDACTED]`, county/city remain visible
   - Emergency contacts: Masked phone and email
   - Insurance: Masked policy numbers and IDs

### Implementation Details

#### Phone Number Masking
- **Kenyan format (+254)**: `+254712345678` → `+254***678`
- **Local format (0)**: `0712345678` → `07***678`
- **Fallback**: Shows first 3 and last 3 digits

#### Email Masking
- **Format**: `john.doe@example.com` → `j***@example.com`
- **Handles edge cases**: Invalid emails return unchanged

#### National ID Masking
- **Format**: `12345678` → `123***78`
- **Shows**: First 3 digits and last 2 digits

#### Address Masking
- **Redacted**: Street and ward information
- **Preserved**: County, sub-county, city, postal code, country
- **Reasoning**: Geographic information is less sensitive than specific addresses

## Security Benefits

1. **Data Privacy**: Sensitive PII is protected from unauthorized access
2. **Role-Based Security**: Different access levels based on user roles
3. **Audit Trail**: All access is logged for security monitoring
4. **Compliance**: Meets healthcare data protection requirements
5. **Minimal Disruption**: Non-sensitive data remains fully accessible

## Testing Results

The implementation was tested with sample data:

```
Phone Number: +254712345678 → +254***678
Email: john.doe@example.com → j***@example.com
National ID: 12345678 → 123***78
Address: Street "123 Main Street" → "[REDACTED]"
```

## Usage

The masking is automatically applied when:

1. Any patient data is retrieved via API endpoints
2. The user's role is passed to the `getSummaryForRole()` method
3. The system determines appropriate masking based on role

## Future Enhancements

1. **Configurable Masking**: Allow admins to configure masking levels
2. **Temporary Access**: Grant temporary full access for specific use cases
3. **Audit Logging**: Enhanced logging of PII access attempts
4. **Data Anonymization**: For research and analytics purposes

## Files Modified

1. `src/utils/masking.js` - New utility functions
2. `src/models/Patient.js` - Added `getSummaryForRole()` method
3. `src/routes/patients.js` - Updated all routes to use role-based masking

## Conclusion

The PII masking implementation successfully addresses the security concern while maintaining system functionality. Phone numbers and other sensitive data are now properly masked for non-admin users, ensuring compliance with healthcare data protection standards and protecting patient privacy. 