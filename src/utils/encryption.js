const crypto = require('crypto');
const logger = require('./logger');

class EncryptionService {
  constructor() {
    this.algorithm = process.env.ENCRYPTION_ALGORITHM || 'aes-256-cbc';
    this.key = process.env.ENCRYPTION_KEY;
    
    if (!this.key || this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
    }
    
    this.keyBuffer = Buffer.from(this.key, 'utf8');
  }

  /**
   * Encrypt sensitive healthcare data
   * @param {string} data - Data to encrypt
   * @param {string} recordId - Record ID for logging
   * @returns {string} - Encrypted data in format: iv:encryptedData
   */
  encrypt(data, recordId = null) {
    try {
      if (!data) {
        throw new Error('Data cannot be empty');
      }

      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.keyBuffer);
      cipher.setAutoPadding(true);
      
      // Encrypt the data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data
      const result = `${iv.toString('hex')}:${encrypted}`;
      
      logger.encryption('encrypt', recordId, true, {
        dataLength: data.length,
        algorithm: this.algorithm
      });
      
      return result;
    } catch (error) {
      logger.encryption('encrypt', recordId, false, {
        error: error.message,
        dataLength: data ? data.length : 0
      });
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive healthcare data
   * @param {string} encryptedData - Data to decrypt in format: iv:encryptedData
   * @param {string} recordId - Record ID for logging
   * @returns {string} - Decrypted data
   */
  decrypt(encryptedData, recordId = null) {
    try {
      if (!encryptedData) {
        throw new Error('Encrypted data cannot be empty');
      }

      // Split IV and encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.keyBuffer);
      decipher.setAutoPadding(true);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      logger.encryption('decrypt', recordId, true, {
        dataLength: decrypted.length,
        algorithm: this.algorithm
      });
      
      return decrypted;
    } catch (error) {
      logger.encryption('decrypt', recordId, false, {
        error: error.message,
        dataLength: encryptedData ? encryptedData.length : 0
      });
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt sensitive fields in an object
   * @param {Object} data - Object containing sensitive data
   * @param {Array} fieldsToEncrypt - Array of field names to encrypt
   * @param {string} recordId - Record ID for logging
   * @returns {Object} - Object with encrypted fields
   */
  encryptObject(data, fieldsToEncrypt = [], recordId = null) {
    try {
      const encryptedData = { ...data };
      
      for (const field of fieldsToEncrypt) {
        if (encryptedData[field] && typeof encryptedData[field] === 'string') {
          encryptedData[field] = this.encrypt(encryptedData[field], recordId);
        }
      }
      
      return encryptedData;
    } catch (error) {
      logger.error('Object encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive fields in an object
   * @param {Object} data - Object containing encrypted data
   * @param {Array} fieldsToDecrypt - Array of field names to decrypt
   * @param {string} recordId - Record ID for logging
   * @returns {Object} - Object with decrypted fields
   */
  decryptObject(data, fieldsToDecrypt = [], recordId = null) {
    try {
      const decryptedData = { ...data };
      
      for (const field of fieldsToDecrypt) {
        if (decryptedData[field] && typeof decryptedData[field] === 'string') {
          decryptedData[field] = this.decrypt(decryptedData[field], recordId);
        }
      }
      
      return decryptedData;
    } catch (error) {
      logger.error('Object decryption failed:', error);
      throw error;
    }
  }

  /**
   * Generate a secure hash for data integrity
   * @param {string} data - Data to hash
   * @returns {string} - SHA-256 hash
   */
  generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a secure random token
   * @param {number} length - Length of token (default: 32)
   * @returns {string} - Random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Verify data integrity using hash
   * @param {string} data - Original data
   * @param {string} hash - Expected hash
   * @returns {boolean} - True if hash matches
   */
  verifyHash(data, hash) {
    const calculatedHash = this.generateHash(data);
    return calculatedHash === hash;
  }

  /**
   * Encrypt file buffer
   * @param {Buffer} fileBuffer - File buffer to encrypt
   * @param {string} recordId - Record ID for logging
   * @returns {Buffer} - Encrypted file buffer
   */
  encryptFile(fileBuffer, recordId = null) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.keyBuffer);
      
      const encrypted = Buffer.concat([
        iv,
        cipher.update(fileBuffer),
        cipher.final()
      ]);
      
      logger.encryption('encrypt_file', recordId, true, {
        originalSize: fileBuffer.length,
        encryptedSize: encrypted.length
      });
      
      return encrypted;
    } catch (error) {
      logger.encryption('encrypt_file', recordId, false, {
        error: error.message
      });
      throw new Error(`File encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt file buffer
   * @param {Buffer} encryptedBuffer - Encrypted file buffer
   * @param {string} recordId - Record ID for logging
   * @returns {Buffer} - Decrypted file buffer
   */
  decryptFile(encryptedBuffer, recordId = null) {
    try {
      const iv = encryptedBuffer.slice(0, 16);
      const encrypted = encryptedBuffer.slice(16);
      
      const decipher = crypto.createDecipher(this.algorithm, this.keyBuffer);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      logger.encryption('decrypt_file', recordId, true, {
        encryptedSize: encryptedBuffer.length,
        decryptedSize: decrypted.length
      });
      
      return decrypted;
    } catch (error) {
      logger.encryption('decrypt_file', recordId, false, {
        error: error.message
      });
      throw new Error(`File decryption failed: ${error.message}`);
    }
  }

  /**
   * Get encryption status and configuration
   * @returns {Object} - Encryption service status
   */
  getStatus() {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyBuffer.length,
      isConfigured: !!this.key,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new EncryptionService(); 