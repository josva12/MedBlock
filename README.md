# MedBlock Healthcare Management System

A comprehensive, production-ready healthcare management system built with Node.js, Express, and MongoDB, specifically designed for the Kenyan healthcare sector with advanced security, privacy, and data management features.

## 🏥 Features

### Core Functionality
- **Patient Management**: Complete patient lifecycle management with Kenyan-specific fields
- **Medical Records**: Secure, encrypted medical records with blockchain integration
- **Vital Signs Management**: Comprehensive medical checklist with draft saving capabilities
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
src/
├── config/           # Configuration files
│   └── database.js   # MongoDB connection
├── controllers/      # Route controllers
├── database/         # Database migrations and seeders
│   ├── migrations/
│   └── seeders/
├── logs/            # Application logs
├── middleware/      # Express middleware
│   ├── auth.js      # Authentication middleware
│   └── errorHandler.js
├── models/          # Mongoose schemas
│   ├── Patient.js
│   ├── User.js
│   ├── MedicalRecord.js
│   ├── VitalSign.js
│   └── Encounter.js
├── routes/          # API routes
│   ├── auth.js
│   ├── patients.js
│   ├── medicalRecords.js
│   ├── vitalSigns.js
│   ├── users.js
│   └── index.js
├── services/        # Business logic
├── uploads/         # File uploads
│   ├── documents/
│   ├── images/
│   └── reports/
├── utils/           # Utility functions
│   ├── encryption.js
│   ├── logger.js
│   ├── masking.js   # PII masking utilities
│   └── validation.js # Input validation utilities
├── server.js        # Main application file
└── documentation/   # System documentation
    ├── PII_MASKING_IMPLEMENTATION.md
    ├── PATIENT_SORTING_GUIDE.md
    └── VITAL_SIGNS_IMPLEMENTATION.md
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `env.example`:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
API_VERSION=v1

# Database
MONGODB_URI=mongodb://localhost:27017/medblock
MONGODB_OPTIONS={}

# Security
JWT_SECRET=your-super-secret-jwt-key-32-chars
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key
ENCRYPTION_ALGORITHM=aes-256-gcm

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS (Optional)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+254700000000

# Blockchain (Optional)
ETHEREUM_NETWORK=testnet
ETHEREUM_PRIVATE_KEY=your-private-key
SMART_CONTRACT_ADDRESS=your-contract-address
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `GET /api/v1/auth/me` - Get current user profile
- `PUT /api/v1/auth/me` - Update current user profile

### Patient Endpoints

#### Core Patient Operations
- `GET /api/v1/patients` - Get all patients (with sorting, filtering, pagination)
- `GET /api/v1/patients/:id` - Get patient by ID
- `POST /api/v1/patients` - Create new patient
- `PUT /api/v1/patients/:id` - Update patient
- `DELETE /api/v1/patients/:id` - Delete patient

#### Advanced Patient Operations
- `POST /api/v1/patients/:id/vital-signs` - Add vital signs
- `POST /api/v1/patients/:id/allergies` - Add allergy
- `GET /api/v1/patients/:id/vital-signs` - Get patient vital signs
- `PATCH /api/v1/patients/:id/checkin` - Update check-in status
- `PATCH /api/v1/patients/:id/assign` - Assign doctor to patient
- `GET /api/v1/patients/statistics/county` - Get county statistics
- `GET /api/v1/patients/export` - Export patient data

#### Patient Query Parameters

**Sorting (New Format):**
```
GET /api/v1/patients?sortBy=fullName&sortOrder=asc
GET /api/v1/patients?sortBy=createdAt&sortOrder=desc
GET /api/v1/patients?sortBy=age&sortOrder=desc
```

**Sorting (Legacy Format):**
```
GET /api/v1/patients?sort=fullName
GET /api/v1/patients?sort=-createdAt
```

**Filtering:**
```
GET /api/v1/patients?filterBy=gender&filterValue=male
GET /api/v1/patients?filterBy=county&filterValue=Nairobi
GET /api/v1/patients?filterBy=isActive&filterValue=true
```

**Combined Operations:**
```
GET /api/v1/patients?sortBy=fullName&sortOrder=asc&filterBy=county&filterValue=Nairobi&page=1&limit=20
```

### Medical Records Endpoints

- `GET /api/v1/medical-records` - Get all medical records
- `GET /api/v1/medical-records/:id` - Get medical record by ID
- `POST /api/v1/medical-records` - Create new medical record
- `PUT /api/v1/medical-records/:id` - Update medical record
- `DELETE /api/v1/medical-records/:id` - Delete medical record
- `GET /api/v1/medical-records/patient/:patientId` - Get patient records

### Vital Signs Endpoints

#### Core Vital Signs Operations
- `POST /api/v1/vital-signs` - Create vital sign record (draft or final)
- `GET /api/v1/vital-signs` - Get all vital signs (with filtering, pagination)
- `GET /api/v1/vital-signs/:id` - Get specific vital sign record
- `PUT /api/v1/vital-signs/:id` - Update draft vital sign record
- `DELETE /api/v1/vital-signs/:id` - Delete draft vital sign record

#### Vital Signs Status Management
- `PATCH /api/v1/vital-signs/:id/finalize` - Mark draft as final
- `PATCH /api/v1/vital-signs/:id/amend` - Mark vital sign as amended with reason

#### Patient-Specific Vital Signs
- `GET /api/v1/vital-signs/patient/:patientId` - Get all vital signs for a patient
- `GET /api/v1/vital-signs/patient/:patientId?status=draft` - Get draft vital signs for a patient

#### Vital Signs Query Parameters
```
GET /api/v1/vital-signs?patientId=xxx&status=draft&page=1&limit=20
GET /api/v1/vital-signs?sortBy=recordedAt&sortOrder=desc&startDate=2024-01-01
GET /api/v1/vital-signs?status=final&sortBy=heartRate&sortOrder=asc
```

#### Vital Signs Data Structure
```json
{
  "patientId": "507f1f77bcf86cd799439011",
  "status": "draft",
  "temperature": { "value": 37.2, "unit": "C" },
  "bloodPressure": { "systolic": 120, "diastolic": 80 },
  "heartRate": 72,
  "respiratoryRate": 16,
  "oxygenSaturation": 98,
  "weight": { "value": 70, "unit": "kg" },
  "height": { "value": 175, "unit": "cm" },
  "bmi": 22.9,
  "painLevel": 2,
  "bloodGlucose": { "value": 95, "unit": "mg/dL" },
  "notes": "Patient appears healthy"
}
```

### User Management Endpoints

- `GET /api/v1/users` - Get all users (Admin only)
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create new user (Admin only)
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user (Admin only)
- `GET /api/v1/users/role/:role` - Get users by role
- `GET /api/v1/users/facility/:facilityId` - Get users by facility

## 🔐 Security Features

### Authentication & Authorization
- **JWT-based authentication**: All endpoints require a valid JWT for access
- **Role-Based Access Control (RBAC)**: Fine-grained permissions enforced via middleware
- **Password Hashing**: All user passwords are hashed with bcrypt before storage
- **Centralized Authentication & Authorization Middleware**: Robust JWT verification and RBAC enforcement
- **Audit Logging**: All sensitive actions are logged with user ID, action, and resource

### Data Privacy & Protection
- **PII Masking**: Role-based masking of sensitive data (phone numbers, emails, national IDs)
- **Admin vs Non-Admin Access**: Different data visibility levels based on user roles
- **Encrypted Storage**: AES-256 encryption for sensitive medical data
- **Input Validation**: Comprehensive validation to prevent injection attacks
- **Rate Limiting**: Protection against abuse and DDoS attacks

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