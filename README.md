# MedBlock Healthcare Management System

A comprehensive, production-ready healthcare management system built with Node.js, Express, and MongoDB, specifically designed for the Kenyan healthcare sector with advanced security, privacy, and data management features.

## 🏥 Features

### Core Functionality
- **Patient Management**: Complete patient lifecycle management with Kenyan-specific fields
- **Medical Records**: Secure, encrypted medical records with blockchain integration
- **Vital Signs Management**: Comprehensive medical checklist with draft saving capabilities
- **File Upload System**: Secure file uploads for medical reports, prescriptions, lab results, and X-rays
- **User Management**: Role-based access control for healthcare professionals
- **Encounter Tracking**: Comprehensive hospital visit and treatment tracking
- **Authentication & Security**: JWT-based authentication with advanced security features

### Advanced Data Management
- **PII Masking**: Role-based Personally Identifiable Information masking for privacy compliance
- **Flexible Sorting**: Multi-field sorting with virtual field support and dual parameter formats
- **Robust Filtering**: Comprehensive filtering with validation and type-specific handling
- **Search Functionality**: Multi-field search with case-insensitive matching

### Technical Features
- **Data Encryption**: AES-256 encryption for sensitive medical data
- **Blockchain Integration**: Secure data integrity verification
- **Audit Logging**: Comprehensive audit trails for compliance
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **Input Validation**: Robust validation and sanitization
- **Error Handling**: Comprehensive error handling and logging
- **Debug Information**: Built-in debugging support for troubleshooting

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB 5+
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/medblock/backend.git
   cd medblock-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📁 Project Structure

```
MedBlock/
├── src/
│   ├── config/
│   │   ├── database.js          # Database configuration
│   │   └── multerConfig.js      # File upload configuration
│   ├── controllers/             # Route controllers
│   ├── database/
│   │   ├── migrations/          # Database migrations
│   │   └── seeders/            # Database seeders
│   ├── logs/                   # Application logs
│   ├── middleware/
│   │   ├── auth.js             # Authentication middleware
│   │   ├── authMiddleware.js   # JWT authentication
│   │   └── errorHandler.js     # Error handling middleware
│   ├── models/
│   │   ├── Encounter.js        # Hospital encounter model
│   │   ├── MedicalRecord.js    # Medical record model
│   │   ├── Patient.js          # Patient model
│   │   ├── User.js             # User model
│   │   └── VitalSign.js        # Vital signs model
│   ├── routes/
│   │   ├── adminRoutes.js      # Admin routes
│   │   ├── auth.js             # Authentication routes
│   │   ├── index.js            # Main router
│   │   ├── medicalRecords.js   # Medical record routes
│   │   ├── patients.js         # Patient routes
│   │   └── vitalSigns.js       # Vital signs routes
│   ├── services/               # Business logic services
│   ├── uploads/                # File upload storage
│   │   ├── documents/          # Medical reports, prescriptions, lab results
│   │   ├── images/             # X-rays and medical images
│   │   ├── others/             # Miscellaneous files
│   │   └── reports/            # Generated reports
│   ├── utils/
│   │   ├── encryption.js       # Data encryption utilities
│   │   ├── logger.js           # Logging utilities
│   │   └── masking.js          # PII masking utilities
│   └── server.js               # Main server file
├── logs/                       # Application logs
├── .env                        # Environment variables
├── .gitignore                  # Git ignore file
├── package.json                # Dependencies and scripts
└── README.md                   # Project documentation
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/medblock

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Encryption Configuration
AES_KEY=your-32-character-aes-encryption-key

# File Upload Configuration
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

### Authentication & Authorization Middleware

The system uses a comprehensive middleware stack for authentication and authorization:

#### Middleware Order
For protected routes, the middleware should be applied in this specific order:
1. `authenticate` - JWT token verification
2. `requireRole` - Role-based authorization
3. `isGovernmentVerifiedProfessional` - Professional verification check (for sensitive operations)
4. `canAccessPatient` - Patient-specific access control (if applicable)
5. Route validation and handler

#### Middleware Functions

**`authenticate`** - JWT token verification
- Verifies Bearer token in Authorization header
- Populates `req.user` with user data
- Handles token expiration and validation errors

**`requireRole(allowedRoles)`** - Role-based authorization
- Takes an array of allowed roles: `['admin', 'doctor', 'nurse']`
- Includes comprehensive debug logging for troubleshooting
- Validates that `req.user` is populated before checking roles
- Returns 403 Forbidden for unauthorized roles

**`isGovernmentVerifiedProfessional`** - Professional verification
- Ensures doctors and nurses are government-verified
- Checks `req.user.isGovernmentVerified` status
- Includes debug logging for verification status
- Bypasses check for admin and other roles

**`canAccessPatient(patientIdParam)`** - Patient access control
- Validates patient ID format and existence
- Role-based access: admins/doctors (all), nurses (department), front-desk (created)
- Returns appropriate error codes for different failure scenarios

#### Debug Logging
All middleware includes comprehensive debug logging to help troubleshoot authorization issues:
- User role and verification status
- Required roles and permission checks
- Request paths and authorization results
- Detailed error messages for failed checks

### File Upload Configuration
The system supports secure file uploads with the following configuration:

- **Storage Process**: Files are first uploaded to a temporary directory (`src/uploads/temp/`) and then moved to their final categorized location based on file type
- **Storage Paths**: Files are organized by type in `src/uploads/`
  - `documents/` - Medical reports, prescriptions, lab results
  - `images/` - X-rays and medical images
  - `others/` - Miscellaneous files
  - `reports/` - Generated reports
  - `temp/` - Temporary upload directory (automatically cleaned up)

- **File Types Supported**:
  - Images: JPEG, PNG, GIF
  - Documents: PDF, DOC, DOCX
  - Maximum file size: 5MB

- **Upload Endpoint**: `POST /api/v1/patients/:id/files`
  - Requires authentication
  - Accepts multipart/form-data
  - Parameters: `file` (file), `fileType` (string), `description` (optional)

## 🚀 Usage Examples

### File Upload Example
```bash
# Upload a medical report for a patient
curl -X POST http://localhost:3000/api/v1/patients/507f1f77bcf86cd799439011/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@medical_report.pdf" \
  -F "fileType=medical_report" \
  -F "description=Patient's latest blood test results"

# Upload an X-ray image
curl -X POST http://localhost:3000/api/v1/patients/507f1f77bcf86cd799439011/files \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@chest_xray.jpg" \
  -F "fileType=xray" \
  -F "description=Chest X-ray showing normal findings"
```

### Patient Management Example
```bash
# Create a new patient
curl -X POST http://localhost:3000/api/v1/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-05-15",
    "gender": "male",
    "nationalId": "12345678",
    "phoneNumber": "+254700000000",
    "email": "john.doe@email.com",
    "address": {
      "street": "123 Main St",
      "city": "Nairobi",
      "county": "Nairobi",
      "postalCode": "00100"
    }
  }'
```

## 📚 API Documentation

### API Endpoints

#### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/logout` - User logout

#### Patients
- `GET /api/v1/patients` - Get all patients (with filtering, sorting, pagination)
- `POST /api/v1/patients` - Create new patient
- `GET /api/v1/patients/:id` - Get patient by ID
- `PUT /api/v1/patients/:id` - Update patient
- `DELETE /api/v1/patients/:id` - Delete patient
- `POST /api/v1/patients/:id/files` - Upload files for patient

#### Vital Signs
- `GET /api/v1/vital-signs` - Get all vital signs
- `POST /api/v1/vital-signs` - Create new vital signs
- `GET /api/v1/vital-signs/:id` - Get vital signs by ID
- `PUT /api/v1/vital-signs/:id` - Update vital signs
- `DELETE /api/v1/vital-signs/:id` - Delete vital signs
- `GET /api/v1/patients/:id/vital-signs` - Get vital signs for specific patient
- `POST /api/v1/vital-signs/:id/finalize` - Finalize draft vital signs
- `POST /api/v1/vital-signs/:id/amend` - Amend finalized vital signs

### Medical Records Endpoints

- `GET /api/v1/medical-records` - Get all medical records
- `GET /api/v1/medical-records/:id` - Get medical record by ID
- `POST /api/v1/medical-records` - Create new medical record
- `PUT /api/v1/medical-records/:id` - Update medical record
- `DELETE /api/v1/medical-records/:id` - Delete medical record
- `GET /api/v1/medical-records/patient/:patientId` - Get patient records

### User Management Endpoints

- `GET /api/v1/users` - Get all users (Admin only)
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create new user (Admin only)
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user (Admin only)
- `GET /api/v1/users/role/:role` - Get users by role
- `GET /api/v1/users/facility/:facilityId` - Get users by facility

### Professional Verification Endpoints

- `PATCH /api/v1/admin/users/:id/verify-professional` - Update user's professional verification status (Admin only)
- `GET /api/v1/auth/me` - Get current user profile with verification status
- `PUT /api/v1/auth/me` - Update user profile including professional verification details

### Professional Verification Workflow

The system implements a comprehensive professional verification system for healthcare professionals:

#### Registration Process
- **Doctors/Nurses with License**: Status automatically set to `'pending'` for admin review
- **Doctors/Nurses without License**: Status set to `'unsubmitted'`
- **Other Roles**: Default to `'unsubmitted'`

#### Verification Statuses
- **`unsubmitted`**: User has not submitted license information
- **`pending`**: License submitted, awaiting admin verification
- **`verified`**: Admin has verified the professional credentials
- **`rejected`**: Admin has rejected the verification with reason

#### Admin Verification Process
- Admins can verify, reject, or update professional verification status
- Required rejection reason when status is set to `'rejected'`
- Automatic audit logging of all verification actions
- Prevention of duplicate license numbers across users

#### Security Enforcement
- **`isGovernmentVerifiedProfessional` Middleware**: Enforces verification requirements for sensitive operations
- **JWT Integration**: Includes verification status in authentication tokens
- **Role-Based Access**: Different verification requirements based on user roles

## 🔐 Security Features

### Authentication & Authorization
- **JWT-based authentication**: All endpoints require a valid JWT for access
- **Role-Based Access Control (RBAC)**: Fine-grained permissions enforced via middleware
- **Password Hashing**: All user passwords are hashed with bcrypt before storage
- **Centralized Authentication & Authorization Middleware**: Robust JWT verification and RBAC enforcement
- **Audit Logging**: All sensitive actions are logged with user ID, action, and resource
- **Professional Verification Enforcement**: Government-verified professional middleware for sensitive operations

### Data Privacy & Protection
- **PII Masking**: Role-based masking of sensitive data (phone numbers, emails, national IDs)
- **Admin vs Non-Admin Access**: Different data visibility levels based on user roles
- **Encrypted Storage**: AES-256 encryption for sensitive medical data
- **Input Validation**: Comprehensive validation to prevent injection attacks
- **Rate Limiting**: Protection against abuse and DDoS attacks

### Rate Limiting & Cross-Cutting Concerns
- **Mutation Rate Limiting**: 50 requests per 15-minute window for all mutation endpoints (POST, PUT, PATCH, DELETE)
- **Mass Operation Prevention**: No general bulk update/delete endpoints without explicit IDs
- **Safe Bulk Operations**: Bulk delete operations perform soft deletes (isActive: false) rather than hard deletes
- **Testing Configuration**: Rate limits can be temporarily reduced for testing purposes
- **Standard Headers**: Rate limit information included in response headers

## 📊 Data Management Features

### Sorting Capabilities
- **13 Sortable Fields**: Including virtual fields like `fullName` and `age`
- **Dual Parameter Support**: Both new (`sortBy`/`sortOrder`) and legacy (`sort`) formats
- **Virtual Field Handling**: Special logic for computed fields
- **Performance Optimized**: Uses indexed fields where possible

### Filtering Capabilities
- **16 Filterable Fields**: Comprehensive filtering options
- **Type-Specific Handling**: Different logic for strings, booleans, dates, and numbers
- **Validation**: Whitelist validation to prevent injection attacks
- **Case-Insensitive**: String matching with regex support

### PII Masking Examples
- **Phone Numbers**: `+254712345678` → `+254***678`
- **Email Addresses**: `john.doe@example.com` → `j***@example.com`
- **National IDs**: `12345678` → `123***78`
- **Addresses**: Street and ward information redacted for non-admin users

### Phone Number Validation
The system supports robust Kenyan phone number validation:
- **Format Support**: Both `+254` and `0` prefixes
- **Network Codes**: Supports Safaricom (7) and Airtel (1) numbers
- **Regex Pattern**: `/^\+?254[17]\d{8}$|^0[17]\d{8}$/`
- **Valid Examples**: 
  - `+254712345678` (Safaricom with +254)
  - `254712345678` (Safaricom without +)
  - `0712345678` (Safaricom with 0)
  - `+254123456789` (Airtel with +254)
  - `0123456789` (Airtel with 0)

## 🛡️ Error Handling

### Comprehensive Error Responses
- **400 Bad Request**: Invalid parameters, validation errors
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side errors

### Debug Information
API responses include debugging data for troubleshooting:
```json
{
  "debug": {
    "sortApplied": { "firstName": 1, "lastName": 1 },
    "sortBy": "fullName",
    "sortOrder": "asc",
    "filterBy": "county",
    "filterValue": "Nairobi",
    "allowedFilterFields": [...]
  }
}
```

## 📖 Documentation

### System Documentation
- **`PII_MASKING_IMPLEMENTATION.md`**: Complete guide to PII masking implementation
- **`PATIENT_SORTING_GUIDE.md`**: Comprehensive sorting functionality documentation
- **`VITAL_SIGNS_IMPLEMENTATION.md`**: Complete guide to vital signs implementation
- **API Examples**: Ready-to-use query examples for all features

### Best Practices
- Use the new sorting format (`sortBy`/`sortOrder`) for better clarity
- Combine sorting and filtering with pagination for large datasets
- Monitor audit logs for security and compliance
- Use indexed fields for optimal performance
- Test PII masking with different user roles

## 🔄 Recent Updates

### Version 2.0 Features
- ✅ **Vital Signs Management**: Comprehensive medical checklist with draft saving capabilities
- ✅ **PII Masking**: Role-based data privacy protection
- ✅ **Advanced Sorting**: Multi-field sorting with virtual field support
- ✅ **Robust Filtering**: Comprehensive filtering with validation
- ✅ **Debug Information**: Built-in troubleshooting support
- ✅ **Enhanced Security**: Improved input validation and error handling
- ✅ **Comprehensive Documentation**: Complete guides and examples

### Latest Improvements
- ✅ **Virtual Field Resilience**: Fixed virtual fields to handle unpopulated vital signs references
- ✅ **Draft Functionality**: Save incomplete vital signs as drafts and finalize later
- ✅ **Status Tracking**: Draft, final, and amended status with audit trails
- ✅ **Automatic Calculations**: BMI calculation from weight and height
- ✅ **Comprehensive Validation**: Medical range validation for all vital measurements
- ✅ **Rate Limiting**: Production-ready rate limiting with 50 requests per 15-minute window
- ✅ **Cross-Cutting Concerns**: Comprehensive testing of rate limiting and mass operation prevention
- ✅ **File Upload Security**: Enhanced file upload system with proper validation and storage
- ✅ **Professional Verification System**: Comprehensive verification workflow for healthcare professionals
- ✅ **Government Verification Middleware**: Enforces verification requirements for sensitive operations
- ✅ **Admin Verification Endpoints**: Complete admin interface for managing professional verification
- ✅ **Enhanced User Model**: Detailed professional verification sub-document with audit trails

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation files in the `documentation/` directory
- Review the debug information in API responses for troubleshooting

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- **v1.1.0** - Added blockchain integration
- **v1.2.0** - Enhanced security features
- **v1.3.0** - Added comprehensive audit logging

---

**MedBlock Team** - Building the future of healthcare in Kenya 🇰🇪 