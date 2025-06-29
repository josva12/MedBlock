/**
 * PII Masking Utilities
 * Functions to mask Personally Identifiable Information based on user roles
 */

/**
 * Mask email address for non-admin users
 * @param {string} email - The email to mask
 * @returns {string|undefined} - Masked email or undefined if no email
 */
function maskEmail(email) {
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  if (!local || !domain) return email; // Return original if invalid format
  return `${local.charAt(0)}***@${domain}`;
}

/**
 * Mask phone number for non-admin users
 * @param {string} phone - The phone number to mask
 * @returns {string|undefined} - Masked phone number or undefined if no phone
 */
function maskPhoneNumber(phone) {
  if (!phone) return undefined;
  
  // Handle Kenyan phone numbers (+254 or 0 prefix)
  if (phone.startsWith('+254')) {
    // Show first 4 digits (+254) and last 3 digits
    return phone.slice(0, 4) + '***' + phone.slice(-3);
  } else if (phone.startsWith('0')) {
    // Show first 2 digits (0) and last 3 digits
    return phone.slice(0, 2) + '***' + phone.slice(-3);
  }
  
  // Fallback for other formats
  return phone.slice(0, 3) + '***' + phone.slice(-3);
}

/**
 * Mask national ID for non-admin users
 * @param {string} nationalId - The national ID to mask
 * @returns {string|undefined} - Masked national ID or undefined if no ID
 */
function maskNationalId(nationalId) {
  if (!nationalId) return undefined;
  // Show first 3 and last 2 digits
  return nationalId.replace(/(\d{3})\d+(\d{2})/, '$1***$2');
}

/**
 * Mask address fields for non-admin users
 * @param {Object} address - The address object to mask
 * @returns {Object} - Masked address object
 */
function maskAddress(address) {
  if (!address) return address;
  
  return {
    ...address,
    street: '[REDACTED]',
    ward: '[REDACTED]',
    // Keep county and subCounty as they're less sensitive
    county: address.county,
    subCounty: address.subCounty,
    city: address.city,
    postalCode: address.postalCode,
    country: address.country
  };
}

/**
 * Mask emergency contact information for non-admin users
 * @param {Object} emergencyContact - The emergency contact object to mask
 * @returns {Object} - Masked emergency contact object
 */
function maskEmergencyContact(emergencyContact) {
  if (!emergencyContact) return emergencyContact;
  
  return {
    ...emergencyContact,
    phoneNumber: maskPhoneNumber(emergencyContact.phoneNumber),
    email: maskEmail(emergencyContact.email),
    address: maskAddress(emergencyContact.address)
  };
}

/**
 * Mask insurance details for non-admin users
 * @param {Array} insuranceDetails - The insurance details array to mask
 * @returns {Array} - Masked insurance details array
 */
function maskInsuranceDetails(insuranceDetails) {
  if (!insuranceDetails || !Array.isArray(insuranceDetails)) return insuranceDetails;
  
  return insuranceDetails.map(insurance => ({
    ...insurance,
    policyNumber: insurance.policyNumber ? 
      insurance.policyNumber.slice(0, 3) + '***' + insurance.policyNumber.slice(-3) : 
      insurance.policyNumber,
    nhifNumber: insurance.nhifNumber ? 
      insurance.nhifNumber.slice(0, 3) + '***' + insurance.nhifNumber.slice(-3) : 
      insurance.nhifNumber,
    groupNumber: insurance.groupNumber ? 
      insurance.groupNumber.slice(0, 2) + '***' + insurance.groupNumber.slice(-2) : 
      insurance.groupNumber
  }));
}

module.exports = {
  maskEmail,
  maskPhoneNumber,
  maskNationalId,
  maskAddress,
  maskEmergencyContact,
  maskInsuranceDetails
}; 