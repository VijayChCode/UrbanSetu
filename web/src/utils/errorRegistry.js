export const ERROR_CODES = {
  // System & React
  ERR_SYS_REACT_CRASH: "ERR_SYS_REACT_CRASH",
  ERR_SYS_UNDEFINED: "ERR_SYS_UNDEFINED",
  
  // Network
  ERR_NET_CONNECT: "ERR_NET_CONNECT",
  ERR_NET_TIMEOUT: "ERR_NET_TIMEOUT",
  
  // API Response
  ERR_API_UNAUTHORIZED: "ERR_API_UNAUTHORIZED",
  ERR_API_FORBIDDEN: "ERR_API_FORBIDDEN",
  ERR_API_NOT_FOUND: "ERR_API_NOT_FOUND",
  ERR_API_BAD_REQUEST: "ERR_API_BAD_REQUEST",
  ERR_API_SERVER_ERROR: "ERR_API_SERVER_ERROR",
  ERR_API_LOAD_FAIL: "ERR_API_LOAD_FAIL",
  
  // Authentication & Security
  ERR_AUTH_PASSWORD: "ERR_AUTH_PASSWORD",
  ERR_AUTH_LOCKED: "ERR_AUTH_LOCKED",
  ERR_AUTH_EXPIRED: "ERR_AUTH_EXPIRED",
  
  // Validation & Operations
  ERR_VAL_REQUIRED: "ERR_VAL_REQUIRED",
  ERR_VAL_UPLOAD: "ERR_VAL_UPLOAD",
  
  // Web3 / Blockchain
  ERR_WEB3_METAMASK: "ERR_WEB3_METAMASK",
  
  // Generic Fallback
  ERR_GEN_UNKNOWN: "ERR_GEN_UNKNOWN"
};

// Maps common error message substrings to their corresponding code
const ERROR_PATTERNS = [
  { pattern: /session expired|unauthorized|sign in again/i, code: ERROR_CODES.ERR_API_UNAUTHORIZED },
  { pattern: /forbidden|permission|access denied|not authorized/i, code: ERROR_CODES.ERR_API_FORBIDDEN },
  { pattern: /not found|could not find|unable to find/i, code: ERROR_CODES.ERR_API_NOT_FOUND },
  { pattern: /incorrect password|password incorrect|wrong password/i, code: ERROR_CODES.ERR_AUTH_PASSWORD },
  { pattern: /too many incorrect attempts|locked/i, code: ERROR_CODES.ERR_AUTH_LOCKED },
  { pattern: /required|select at least one|fill required/i, code: ERROR_CODES.ERR_VAL_REQUIRED },
  { pattern: /upload failed|uploading failed|ai audited|image is required/i, code: ERROR_CODES.ERR_VAL_UPLOAD },
  { pattern: /metamask|wallet/i, code: ERROR_CODES.ERR_WEB3_METAMASK },
  { pattern: /failed to fetch|network error|offline|connection/i, code: ERROR_CODES.ERR_NET_CONNECT },
  { pattern: /timeout|timed out/i, code: ERROR_CODES.ERR_NET_TIMEOUT },
  { pattern: /failed to load|unable to load|loading error|fetch sessions|fetch details/i, code: ERROR_CODES.ERR_API_LOAD_FAIL }
];

/**
 * Resolves an error message string or object into a standardized error code.
 * @param {string|object} error - The error message or object to resolve.
 * @returns {string} The standardized error code.
 */
export function getErrorCode(error) {
  if (!error) return ERROR_CODES.ERR_GEN_UNKNOWN;
  
  const message = typeof error === 'string' 
    ? error 
    : (error.message || error.toString() || '');
    
  for (const { pattern, code } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return code;
    }
  }
  
  // Special checking for HTTP status code triggers if passed as status or if status is in message
  if (message.includes('401')) return ERROR_CODES.ERR_API_UNAUTHORIZED;
  if (message.includes('403')) return ERROR_CODES.ERR_API_FORBIDDEN;
  if (message.includes('404')) return ERROR_CODES.ERR_API_NOT_FOUND;
  if (message.includes('400')) return ERROR_CODES.ERR_API_BAD_REQUEST;
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return ERROR_CODES.ERR_API_SERVER_ERROR;
  }
  
  return ERROR_CODES.ERR_GEN_UNKNOWN;
}
