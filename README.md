# MedBlock Healthcare Management System

A comprehensive, production-ready healthcare management system built with Node.js, Express, and MongoDB, specifically designed for the Kenyan healthcare sector.

## 🏥 Features

### Core Functionality
- **Patient Management**: Complete patient lifecycle management with Kenyan-specific fields
- **Medical Records**: Secure, encrypted medical records with blockchain integration
- **User Management**: Role-based access control for healthcare professionals
- **Encounter Tracking**: Comprehensive hospital visit and treatment tracking
- **Authentication & Security**: JWT-based authentication with advanced security features

### Technical Features
- **Data Encryption**: AES-256 encryption for sensitive medical data
- **Blockchain Integration**: Secure data integrity verification
- **Audit Logging**: Comprehensive audit trails for compliance
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **Input Validation**: Robust validation and sanitization
- **Error Handling**: Comprehensive error handling and logging

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
│   └── Encounter.js
├── routes/          # API routes
│   ├── auth.js
│   ├── patients.js
│   ├── medicalRecords.js
│   ├── users.js
│   └── index.js
├── services/        # Business logic
├── uploads/         # File uploads
│   ├── documents/
│   ├── images/
│   └── reports/
├── utils/           # Utility functions
│   ├── encryption.js
│   └── logger.js
└── server.js        # Main application file
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

- `GET /api/v1/patients` - Get all patients
- `GET /api/v1/patients/:id` - Get patient by ID
- `POST /api/v1/patients` - Create new patient
- `PUT /api/v1/patients/:id` - Update patient
- `DELETE /api/v1/patients/:id` - Delete patient
- `POST /api/v1/patients/:id/vital-signs` - Add vital signs
- `POST /api/v1/patients/:id/allergies` - Add allergy
- `GET /api/v1/patients/:id/vital-signs` - Get patient vital signs

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

## 🔐 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Session management
- Token refresh mechanism

### Data Protection
- AES-256 encryption for sensitive data
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

### API Security
- Rate limiting
- Request validation
- Error handling without information leakage
- Secure headers with Helmet
- CORS configuration

## 🏗️ Database Schema

### Patient Schema
- Personal information (name, DOB, gender, contact)
- Kenyan-specific fields (national ID, county, sub-county)
- Medical history and allergies
- Emergency contacts
- Insurance information

### User Schema
- Professional information (role, specialization, license)
- Authentication details
- Permissions and access control
- Work schedule and facility assignments

### Medical Record Schema
- Record classification and metadata
- Encrypted clinical data
- Blockchain integration
- File attachments
- Audit trail

### Encounter Schema
- Visit details and status
- Diagnoses and prescriptions
- Lab results and imaging
- Treatment plans
- Billing information

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testNamePattern="Patient"
```

## 📊 Monitoring & Logging

### Logging
- Structured logging with Winston
- Different log levels (error, warn, info, debug)
- File and console output
- Audit logging for security events

### Health Checks
- Database connectivity
- External service status
- Application metrics
- Performance monitoring

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure secure JWT secrets
- [ ] Set up MongoDB with authentication
- [ ] Configure SSL/TLS certificates
- [ ] Set up reverse proxy (Nginx)
- [ ] Configure monitoring and alerting
- [ ] Set up backup strategy
- [ ] Configure rate limiting
- [ ] Set up logging aggregation

### Docker Deployment
```bash
# Build image
docker build -t medblock-backend .

# Run container
docker run -p 5000:5000 --env-file .env medblock-backend
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- **v1.1.0** - Added blockchain integration
- **v1.2.0** - Enhanced security features
- **v1.3.0** - Added comprehensive audit logging

---

**MedBlock Team** - Building the future of healthcare in Kenya 🇰🇪 