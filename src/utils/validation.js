const mongoose = require('mongoose');

/**
 * Validate if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid ObjectId, false otherwise
 */
const validateObjectId = (id) => {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {boolean} - True if valid email, false otherwise
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (Kenyan format)
 * @param {string} phone - The phone number to validate
 * @returns {boolean} - True if valid phone number, false otherwise
 */
const validatePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  const phoneRegex = /^(\+254|0)[17]\d{8}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate national ID format (Kenyan format)
 * @param {string} nationalId - The national ID to validate
 * @returns {boolean} - True if valid national ID, false otherwise
 */
const validateNationalId = (nationalId) => {
  if (!nationalId || typeof nationalId !== 'string') {
    return false;
  }
  const nationalIdRegex = /^\d{8}$/;
  return nationalIdRegex.test(nationalId);
};

/**
 * Validate NHIF number format
 * @param {string} nhifNumber - The NHIF number to validate
 * @returns {boolean} - True if valid NHIF number, false otherwise
 */
const validateNHIFNumber = (nhifNumber) => {
  if (!nhifNumber || typeof nhifNumber !== 'string') {
    return false;
  }
  const nhifRegex = /^\d{10}$/;
  return nhifRegex.test(nhifNumber);
};

/**
 * Validate date format (ISO string or Date object)
 * @param {string|Date} date - The date to validate
 * @returns {boolean} - True if valid date, false otherwise
 */
const validateDate = (date) => {
  if (!date) {
    return false;
  }
  
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime());
};

/**
 * Validate numeric range
 * @param {number} value - The value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {boolean} - True if value is within range, false otherwise
 */
const validateNumericRange = (value, min, max) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return false;
  }
  return value >= min && value <= max;
};

/**
 * Validate string length
 * @param {string} str - The string to validate
 * @param {number} minLength - Minimum allowed length
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} - True if string length is within range, false otherwise
 */
const validateStringLength = (str, minLength, maxLength) => {
  if (typeof str !== 'string') {
    return false;
  }
  return str.length >= minLength && str.length <= maxLength;
};

/**
 * Validate enum values
 * @param {*} value - The value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @returns {boolean} - True if value is in allowed values, false otherwise
 */
const validateEnum = (value, allowedValues) => {
  return allowedValues.includes(value);
};

/**
 * Sanitize string input (remove extra whitespace, trim)
 * @param {string} str - The string to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') {
    return '';
  }
  return str.trim().replace(/\s+/g, ' ');
};

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {number} maxLimit - Maximum allowed limit
 * @returns {Object} - Validation result with sanitized values
 */
const validatePagination = (page, limit, maxLimit = 100) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  const isValidPage = !isNaN(pageNum) && pageNum >= 1;
  const isValidLimit = !isNaN(limitNum) && limitNum >= 1 && limitNum <= maxLimit;
  
  return {
    isValid: isValidPage && isValidLimit,
    page: isValidPage ? pageNum : 1,
    limit: isValidLimit ? limitNum : 20,
    errors: {
      page: isValidPage ? null : 'Page must be a positive integer',
      limit: isValidLimit ? null : `Limit must be a positive integer between 1 and ${maxLimit}`
    }
  };
};

/**
 * Validate sorting parameters
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order (asc/desc)
 * @param {Array} allowedFields - Array of allowed sort fields
 * @returns {Object} - Validation result with sanitized values
 */
const validateSorting = (sortBy, sortOrder, allowedFields) => {
  const isValidField = allowedFields.includes(sortBy);
  const isValidOrder = ['asc', 'desc'].includes(sortOrder);
  
  return {
    isValid: isValidField && isValidOrder,
    sortBy: isValidField ? sortBy : allowedFields[0],
    sortOrder: isValidOrder ? sortOrder : 'desc',
    errors: {
      sortBy: isValidField ? null : `Invalid sort field. Allowed: ${allowedFields.join(', ')}`,
      sortOrder: isValidOrder ? null : 'Sort order must be "asc" or "desc"'
    }
  };
};

module.exports = {
  validateObjectId,
  validateEmail,
  validatePhoneNumber,
  validateNationalId,
  validateNHIFNumber,
  validateDate,
  validateNumericRange,
  validateStringLength,
  validateEnum,
  sanitizeString,
  validatePagination,
  validateSorting
}; 