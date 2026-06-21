import isDisposableEmail from 'is-disposable-email';
import { logSecurityEvent } from '../middleware/security.js';

/**
 * Comprehensive email validation with fraud detection
 * @param {string} email - Email address to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.logSecurity - Whether to log security events
 * @param {string} options.context - Context for logging (signup, profile_update, etc.)
 * @param {string} options.ip - IP address for logging
 * @param {string} options.userAgent - User agent for logging
 * @returns {Object} Validation result
 */
export const validateEmail = (email, options = {}) => {
  const {
    logSecurity = true,
    context = 'email_validation',
    ip = null,
    userAgent = null
  } = options;

  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return {
      isValid: false,
      isFraud: false,
      reason: 'invalid_format',
      message: 'Please enter a valid email address'
    };
  }

  // Extract domain and local part
  const [localPart, domain] = normalizedEmail.split('@');

  // 1. Check against disposable email domains
  try {
    const isDisposable = isDisposableEmail(normalizedEmail);
    if (isDisposable) {
      if (logSecurity) {
        logSecurityEvent('disposable_email_attempt', {
          email: normalizedEmail,
          domain,
          context,
          ip,
          userAgent
        });
      }
      return {
        isValid: false,
        isFraud: true,
        reason: 'disposable_email',
        message: 'Disposable email addresses are not allowed. Please use a permanent email address.'
      };
    }
  } catch (error) {
    console.error('Error checking disposable email:', error);
    // Continue with other validations if disposable check fails
  }

  // 2. Check for valid TLD
  const validTlds = [
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'co', 'uk', 'ca', 'au', 'de', 'fr', 'it', 'es', 'nl', 'be', 'ch', 'at', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'hu', 'ro', 'bg', 'hr', 'si', 'sk', 'lt', 'lv', 'ee', 'ie', 'pt', 'gr', 'cy', 'mt', 'lu', 'jp', 'kr', 'cn', 'in', 'br', 'mx', 'ar', 'cl', 'co', 'pe', 've', 'ec', 'uy', 'py', 'bo', 'gy', 'sr', 'gf', 'fk', 'za', 'ng', 'ke', 'eg', 'ma', 'tn', 'dz', 'ly', 'sd', 'et', 'ug', 'tz', 'rw', 'bi', 'mw', 'zm', 'bw', 'sz', 'ls', 'na', 'ao', 'mz', 'mg', 'mu', 'sc', 'km', 'yt', 're', 'dj', 'so', 'er', 'ss', 'cf', 'td', 'cm', 'gq', 'ga', 'cg', 'cd', 'st', 'gabon', 'congo', 'centralafricanrepublic', 'chad', 'cameroon', 'equatorialguinea', 'sao', 'tome', 'principe', 'ru', 'by', 'ua', 'md', 'ge', 'am', 'az', 'kz', 'kg', 'tj', 'tm', 'uz', 'mn', 'af', 'pk', 'bd', 'lk', 'mv', 'bt', 'np', 'mm', 'th', 'la', 'kh', 'vn', 'my', 'sg', 'bn', 'id', 'ph', 'tl', 'au', 'nz', 'fj', 'pg', 'sb', 'vu', 'nc', 'pf', 'wf', 'ws', 'to', 'ki', 'tv', 'nr', 'fm', 'mh', 'pw', 'as', 'gu', 'mp', 'vi', 'pr', 'do', 'ht', 'cu', 'jm', 'bb', 'tt', 'ag', 'kn', 'lc', 'vc', 'gd', 'dm', 'ai', 'ms', 'tc', 'vg', 'ky', 'bm', 'fk', 'gs', 'sh', 'ac', 'ta', 'io', 'cc', 'cx', 'nf', 'hm', 'aq', 'tf', 'bv', 'sj', 'um', 'eh', 'ps', 'il', 'jo', 'lb', 'sy', 'iq', 'ir', 'tr', 'cy', 'il', 'ps', 'jo', 'lb', 'sy', 'iq', 'ir', 'af', 'pk', 'bd', 'lk', 'mv', 'bt', 'np', 'mm', 'th', 'la', 'kh', 'vn', 'my', 'sg', 'bn', 'id', 'ph', 'tl', 'au', 'nz', 'fj', 'pg', 'sb', 'vu', 'nc', 'pf', 'wf', 'ws', 'to', 'ki', 'tv', 'nr', 'fm', 'mh', 'pw', 'as', 'gu', 'mp', 'vi', 'pr', 'do', 'ht', 'cu', 'jm', 'bb', 'tt', 'ag', 'kn', 'lc', 'vc', 'gd', 'dm', 'ai', 'ms', 'tc', 'vg', 'ky', 'bm', 'fk', 'gs', 'sh', 'ac', 'ta', 'io', 'cc', 'cx', 'nf', 'hm', 'aq', 'tf', 'bv', 'sj', 'um', 'eh', 'ps', 'il', 'jo', 'lb', 'sy', 'iq', 'ir', 'tr', 'cy', 'il', 'ps', 'jo', 'lb', 'sy', 'iq', 'ir', 'af', 'pk', 'bd', 'lk', 'mv', 'bt', 'np', 'mm', 'th', 'la', 'kh', 'vn', 'my', 'sg', 'bn', 'id', 'ph', 'tl', 'au', 'nz', 'fj', 'pg', 'sb', 'vu', 'nc', 'pf', 'wf', 'ws', 'to', 'ki', 'tv', 'nr', 'fm', 'mh', 'pw', 'as', 'gu', 'mp', 'vi', 'pr', 'do', 'ht', 'cu', 'jm', 'bb', 'tt', 'ag', 'kn', 'lc', 'vc', 'gd', 'dm', 'ai', 'ms', 'tc', 'vg', 'ky', 'bm', 'fk', 'gs', 'sh', 'ac', 'ta', 'io', 'cc', 'cx', 'nf', 'hm', 'aq', 'tf', 'bv', 'sj', 'um', 'eh', 'ps', 'il', 'jo', 'lb', 'sy', 'iq', 'ir'
  ];
  
  const tld = domain.split('.').pop().toLowerCase();
  if (!validTlds.includes(tld)) {
    if (logSecurity) {
      logSecurityEvent('suspicious_tld', {
        email: normalizedEmail,
        tld,
        context,
        ip,
        userAgent
      });
    }
    return {
      isValid: false,
      isFraud: false,
      reason: 'suspicious_tld',
      message: 'This email domain appears to be suspicious. Please use a valid email address.'
    };
  }

  // 3. Check for suspicious domain patterns
  const suspiciousDomainPatterns = [
    // Domains with many subdomains (potential evasion)
    /^[^.]+(\.[^.]+){3,}$/,
    // Domains with suspicious keywords (exact second-level domains or subdomains, preventing false positives like testbook.com)
    /^(.*\.)?(temp|test|fake|dummy|spam|trash|junk|throwaway|disposable|temporary|10min|guerrilla|mailinator|tempmail|trashmail)([-][a-z0-9]+)*\.[a-z]{2,}(\.[a-z]{2,})?$/i,
    // Domains with random character patterns
    /^[a-z0-9]{15,}\.[a-z]{2,}$/i
  ];

  for (const pattern of suspiciousDomainPatterns) {
    if (pattern.test(domain)) {
      if (logSecurity) {
        logSecurityEvent('suspicious_domain_pattern', {
          email: normalizedEmail,
          domain,
          pattern: pattern.toString(),
          context,
          ip,
          userAgent
        });
      }
      return {
        isValid: false,
        isFraud: false,
        reason: 'suspicious_domain',
        message: 'This email domain appears to be suspicious. Please use a valid email address.'
      };
    }
  }

  // 4. Check for suspicious patterns in local part (skip for trusted domains like gmail/yahoo to avoid false positives)
  const trustedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'zoho.com', 'protonmail.com', 'proton.me', 'live.com', 'yandex.com', 'gmx.com', 'mail.com'];
  
  if (!trustedDomains.includes(domain)) {
    const suspiciousPatterns = [
      // More than 5 consecutive digits(rare in legit mails)
      /\d{6,}/,
      // Common disposable email patterns in local part (exact match or followed by digits only)
      /^(temp|test|fake|dummy|spam|trash|junk|throwaway|disposable|temporary)(?:\d+)?$/i,
      // Random character patterns
      /^[a-z0-9]{20,}$/i, // Very long random strings
      // Multiple dots or special characters
      /\.{2,}/,
      /_{2,}/,
      / -{2,}/
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(localPart)) {
        if (logSecurity) {
          logSecurityEvent('suspicious_email_pattern', {
            email: normalizedEmail,
            pattern: pattern.toString(),
            context,
            ip,
            userAgent
          });
        }
        return {
          isValid: false,
          isFraud: false,
          reason: 'suspicious_local_part',
          message: 'This email address appears to be suspicious. Please use a valid email address.'
        };
      }
    }
  }

  // 5. Check for common fraud indicators
  const fraudIndicators = [
    // Email contains suspicious keywords
    /(fraud|scam|phish|hack|steal|steal|cheat|fake|spam|bot|robot|automated)/i,
    // Very short or very long local parts
    /^.{1,2}@/,
    /^.{50,}@/,
    // Multiple special characters
    /[!@#$%^&*()_+={}[\]|\\:";'<>?,./]{3,}/
  ];

  for (const indicator of fraudIndicators) {
    if (indicator.test(normalizedEmail)) {
      if (logSecurity) {
        logSecurityEvent('fraud_indicator_detected', {
          email: normalizedEmail,
          indicator: indicator.toString(),
          context,
          ip,
          userAgent
        });
      }
      return {
        isValid: false,
        isFraud: true,
        reason: 'fraud_indicator',
        message: 'This email address contains suspicious content. Please use a valid email address.'
      };
    }
  }

  // 6. Check for RFC compliance
  if (localPart.length > 64 || domain.length > 253) {
    return {
      isValid: false,
      isFraud: false,
      reason: 'rfc_violation',
      message: 'Email address exceeds maximum length limits.'
    };
  }

  // All validations passed
  return {
    isValid: true,
    isFraud: false,
    reason: 'valid',
    message: 'Email address is valid',
    normalizedEmail
  };
};

/**
 * Quick validation for basic email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid format
 */
export const isValidEmailFormat = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email?.toLowerCase().trim());
};

/**
 * Check if email is disposable (quick check)
 * @param {string} email - Email to check
 * @returns {boolean} Is disposable
 */
export const isDisposableEmailAddress = (email) => {
  try {
    return isDisposableEmail(email?.toLowerCase().trim());
  } catch (error) {
    console.error('Error checking disposable email:', error);
    return false;
  }
};

/**
 * Get fraud detection statistics
 * @returns {Object} Statistics
 */
export const getFraudStats = () => {
  // This would typically query a database for fraud attempt statistics
  // For now, return a placeholder
  return {
    totalAttempts: 0,
    fraudAttempts: 0,
    disposableEmails: 0,
    suspiciousPatterns: 0
  };
};
