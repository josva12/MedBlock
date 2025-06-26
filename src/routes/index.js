console.log('✅ Main router (src/routes/index.js) loaded');
const express = require('express');
const authRoutes = require('./auth');
const patientRoutes = require('./patients');
const medicalRecordRoutes = require('./medicalRecords');
const userRoutes = require('./users');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'MedBlock API is running',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  });
});

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MedBlock Healthcare API',
    version: process.env.API_VERSION || '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      patients: '/api/v1/patients',
      medicalRecords: '/api/v1/medical-records',
      users: '/api/v1/users'
    },
    documentation: 'API documentation will be available at /api/v1/docs'
  });
});

console.log('🔶 Mounting /auth routes...');
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/medical-records', medicalRecordRoutes);
router.use('/users', userRoutes);

// 404 handler for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

module.exports = router; 