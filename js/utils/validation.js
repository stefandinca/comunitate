// =====================================================
// INPUT VALIDATION UTILITIES
// =====================================================

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validates phone number (Romanian format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export function isValidPhone(phone) {
    const phoneRegex = /^(\+4|0)[0-9]{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, message: string}} Validation result
 */
export function validatePassword(password) {
    if (password.length < 6) {
        return {
            valid: false,
            message: 'Parola trebuie să aibă cel puțin 6 caractere'
        };
    }
    return { valid: true, message: 'Parolă validă' };
}

/**
 * Validates required field
 * @param {string} value - Value to check
 * @param {string} fieldName - Field name for error message
 * @returns {{valid: boolean, message: string}} Validation result
 */
export function validateRequired(value, fieldName = 'Câmpul') {
    if (!value || value.trim() === '') {
        return {
            valid: false,
            message: `${fieldName} este obligatoriu`
        };
    }
    return { valid: true, message: '' };
}

/**
 * Validates text length
 * @param {string} text - Text to validate
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 * @param {string} fieldName - Field name for error message
 * @returns {{valid: boolean, message: string}} Validation result
 */
export function validateLength(text, minLength, maxLength, fieldName = 'Text') {
    if (text.length < minLength) {
        return {
            valid: false,
            message: `${fieldName} trebuie să aibă cel puțin ${minLength} caractere`
        };
    }
    if (text.length > maxLength) {
        return {
            valid: false,
            message: `${fieldName} nu poate depăși ${maxLength} caractere`
        };
    }
    return { valid: true, message: '' };
}

/**
 * Validates price value
 * @param {string|number} price - Price to validate
 * @returns {{valid: boolean, message: string}} Validation result
 */
export function validatePrice(price) {
    const numPrice = Number(price);
    if (isNaN(numPrice)) {
        return {
            valid: false,
            message: 'Prețul trebuie să fie un număr valid'
        };
    }
    if (numPrice < 0) {
        return {
            valid: false,
            message: 'Prețul nu poate fi negativ'
        };
    }
    return { valid: true, message: '' };
}

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Sanitizes user input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input) {
    if (!input) return '';
    return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}
