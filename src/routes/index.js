console.log('✅ Main router (src/routes/index.js) loaded');
const express = require('express');
const router = express.Router();

// --- Import Route Files ---
const authRoutes = require('./auth');
const patientRoutes = require('./patients');
const medicalRecordRoutes = require('./medicalRecords');
const userRoutes = require('./users'); // For general user routes like GET /users/:id
const adminRoutes = require('./adminRoutes'); // Specifically for admin-only management routes

// --- Public Health & API Info Endpoints ---
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'MedBlock API is healthy and running',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  });
});

router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the MedBlock Healthcare API',
    version: process.env.API_VERSION || '1.0.0',
    documentation: 'API documentation will be available at /api/v1/docs'
  });
});

// --- Mount Application Routes ---
console.log('🔶 Mounting application routes...');

router.use('/auth', authRoutes); // For /api/v1/auth/login, etc.
router.use('/patients', patientRoutes); // For /api/v1/patients
router.use('/medical-records', medicalRecordRoutes); // For /api/v1/medical-records
router.use('/users', userRoutes); // For /api/v1/users (like GET /users and GET /users/:id)

// The admin routes for managing admins are mounted at the root of the API
// This makes the routes inside it like /api/v1/admin/admins and /api/v1/admin/users/:id
router.use('/admin', adminRoutes);

// --- Catch-All 404 Handler for API ---
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'API Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

module.exports = router; 