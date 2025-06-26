console.log('✅ server.js starting...');
require('dotenv').config();
console.log('✅ Environment Loaded:', process.env.MONGODB_URI);
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

// Import custom modules
const db = require('./config/database');
console.log('✅ db module imported into server.js');

// TRY A BUILT-IN MODULE FIRST
try {
  const os = require('os');
  console.log('✅ os module imported successfully into server.js');
  console.log('✅ Current OS Platform:', os.platform());
} catch (e) {
  console.error('❌ FAILED to import os module in server.js:', e);
  process.exit(1);
}

let logger;

try {
  console.log('🟠 Attempting to import logger in server.js...');
  logger = require('./utils/logger');
  console.log('✅ logger module imported into server.js SUCCESSFULLY');
  if (logger && typeof logger.info === 'function') {
    logger.info('--- Logger test from server.js ---');
  } else {
    console.error('❌ Logger imported into server.js, but seems invalid!');
  }
} catch (e) {
  console.error('❌❌❌ CRITICAL FAILURE importing logger in server.js:', e);
  if (e.stack) {
    console.error(e.stack);
  }
  process.exit(1);
}

// const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

console.log('✅ server.js is running...');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger && logger.info ? logger.info(message.trim()) : console.log(message.trim())
    }
  }));
}

// Request logging middleware
app.use((req, res, next) => {
  if (logger && logger.info) {
    logger.info(`${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId
    });
  }
  next();
});

// API routes
app.use('/api/v1', routes);

// Health check endpoint (outside API versioning)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.API_VERSION || '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'MedBlock Healthcare API',
    version: process.env.API_VERSION || '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    documentation: '/api/v1'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
// app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (err, promise) => {
  if (logger && typeof logger.error === 'function') {
    logger.error('Unhandled Promise Rejection:', err);
  } else {
    console.error('Unhandled Promise Rejection (fallback log):', err);
  }
  process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  if (logger && typeof logger.error === 'function') {
    logger.error('Uncaught Exception:', err);
  } else {
    console.error('Uncaught Exception (fallback log):', err);
  }
  process.exit(1);
});

// Start server
console.log('🔥 About to call db.connect()');
console.log('🧪 logger object keys:', Object.keys(logger || {}));

const startServer = async () => {
  try {
    await db.connect();
    if (logger && typeof logger.info === 'function') {
      logger.info('Database connected successfully');
    } else {
      console.log('Database connected successfully (using console.log)');
    }
    app.listen(PORT, () => {
      if (logger && typeof logger.info === 'function') {
        logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
        logger.info(`Health check available at http://localhost:${PORT}/health`);
        logger.info(`API documentation available at http://localhost:${PORT}/api/v1`);
      } else {
        console.log(`Server running on port ${PORT} (using console.log)`);
      }
    });
  } catch (error) {
    console.error('❌ Failed during db.connect():', error);
    if (logger && typeof logger.error === 'function') {
      logger.error('❌ Failed during db.connect():', error);
    }
    process.exit(1);
  }
};

startServer().catch(err => {
  console.error('❌ Server crashed in startServer promise:', err);
  process.exit(1);
});

module.exports = app; 