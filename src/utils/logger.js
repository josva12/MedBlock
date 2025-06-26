const winston = require('winston');
const path = require('path');
const fs = require('fs');

console.log('🔶 Winston Logger: Starting initialization...');

// --- Robust Logs Directory Creation ---
const logsDir = path.join(__dirname, '../../logs'); // Should resolve to <project_root>/logs
let logsDirInitialized = false;
try {
  if (!fs.existsSync(logsDir)) {
    console.log(`🔶 Winston Logger: Logs directory "${logsDir}" does not exist. Attempting to create...`);
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`✅ Winston Logger: Logs directory "${logsDir}" created successfully.`);
    logsDirInitialized = true;
  } else {
    console.log(`🔶 Winston Logger: Logs directory "${logsDir}" already exists.`);
    logsDirInitialized = true;
  }
} catch (error) {
  console.error(`🔴 FATAL ERROR: Winston Logger: Could not create or access logs directory "${logsDir}". Error: ${error.message}`);
  console.error("🔴 Winston Logger: Falling back to console-only logging.");
  module.exports = {
    info: (...args) => console.info('[FALLBACK-INFO]', ...args),
    warn: (...args) => console.warn('[FALLBACK-WARN]', ...args),
    error: (...args) => console.error('[FALLBACK-ERROR]', ...args),
    debug: (...args) => console.debug('[FALLBACK-DEBUG]', ...args),
    stream: { write: (message) => console.info('[FALLBACK-STREAM]', message.trim()) },
    audit: (action, userId, resource) => console.log('[FALLBACK-AUDIT]', action, userId, resource),
    security: (event, userId) => console.log('[FALLBACK-SECURITY]', event, userId),
    medical: (action, patientId, recordType) => console.log('[FALLBACK-MEDICAL]', action, patientId, recordType),
    api: (method, url, statusCode) => console.log('[FALLBACK-API]', method, url, statusCode),
    database: (operation, collection) => console.log('[FALLBACK-DB]', operation, collection),
    encryption: (action, recordId) => console.log('[FALLBACK-ENCRYPT]', action, recordId),
    performance: (operation, duration) => console.log('[FALLBACK-PERF]', operation, duration),
  };
  return;
}

// --- Basic Logger Configuration ---
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  defaultMeta: {
    service: 'medblock-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
      )
    }),
  ],
};

// --- Add File Transports (only if logsDirInitialized) ---
if (logsDirInitialized) {
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true,
      format: winston.format.json()
    })
  );
  loggerConfig.transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
      format: winston.format.json()
    })
  );
} else {
  console.warn("🔶 Winston Logger: File transports disabled because logs directory couldn't be initialized.");
}

const logger = winston.createLogger(loggerConfig);

// Add custom stream for Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Add a basic custom audit method
const redact = (obj, fields = ['password', 'token', 'secret']) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  for (const field of fields) {
    if (clone[field]) clone[field] = '[REDACTED]';
  }
  return clone;
};

logger.audit = (action, userId, resource, details = {}) => {
  logger.info('AUDIT_LOG', { action, userId, resource, timestamp: new Date().toISOString(), ...redact(details) });
};

console.log('✅ Winston Logger: Instance created and configured.');
module.exports = logger; 