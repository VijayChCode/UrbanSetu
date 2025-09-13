const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Cache for CSRF token to avoid multiple requests
let csrfTokenCache = {
  token: null,
  timestamp: null,
  expiresAt: null
};

// Cache duration: 45 minutes (tokens expire in 1 hour, refresh 15 min before expiry)
const CACHE_DURATION = 45 * 60 * 1000;

// Maximum retry attempts for token fetching
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validate CSRF token format
 * @param {string} token - Token to validate
 * @returns {boolean} - Whether token is valid
 */
const isValidCSRFToken = (token) => {
  return typeof token === 'string' && 
         token.length === 64 && // 32 bytes = 64 hex characters
         /^[a-f0-9]+$/i.test(token);
};

/**
 * Fetch CSRF token from the server with retry logic
 * @param {number} attempt - Current attempt number
 * @returns {Promise<string>} CSRF token
 */
export const fetchCSRFToken = async (attempt = 1) => {
  try {
    // Validate API base URL
    if (!API_BASE_URL) {
      throw new Error('API_BASE_URL is not configured');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/csrf-token`, {
      method: 'GET',
      credentials: 'include', // Important: include cookies
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CSRF token fetch failed:', response.status, errorText);
      
      // Retry on server errors (5xx) or rate limiting (429)
      if ((response.status >= 500 || response.status === 429) && attempt < MAX_RETRY_ATTEMPTS) {
        console.log(`Retrying CSRF token fetch (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        await sleep(RETRY_DELAY * attempt); // Exponential backoff
        return fetchCSRFToken(attempt + 1);
      }
      
      throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from server');
    }
    
    if (!data.csrfToken) {
      throw new Error('No CSRF token received from server');
    }

    // Validate token format
    if (!isValidCSRFToken(data.csrfToken)) {
      throw new Error('Invalid CSRF token format received from server');
    }

    return data.csrfToken;
  } catch (error) {
    // Handle network errors with retry
    if (error.name === 'AbortError' || error.name === 'TypeError') {
      if (attempt < MAX_RETRY_ATTEMPTS) {
        console.log(`Network error, retrying CSRF token fetch (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        await sleep(RETRY_DELAY * attempt);
        return fetchCSRFToken(attempt + 1);
      }
    }
    
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
};

/**
 * Get CSRF token with caching and validation
 * @returns {Promise<string>} CSRF token
 */
export const getCSRFToken = async () => {
  const now = Date.now();
  
  // Check if we have a valid cached token
  if (csrfTokenCache.token && 
      csrfTokenCache.timestamp && 
      csrfTokenCache.expiresAt &&
      now < csrfTokenCache.expiresAt &&
      isValidCSRFToken(csrfTokenCache.token)) {
    return csrfTokenCache.token;
  }
  
  // Fetch fresh token
  const token = await fetchCSRFToken();
  
  // Cache the token with expiration
  csrfTokenCache = {
    token,
    timestamp: now,
    expiresAt: now + CACHE_DURATION
  };
  
  return token;
};

/**
 * Clear CSRF token cache (useful for logout or errors)
 */
export const clearCSRFTokenCache = () => {
  csrfTokenCache = {
    token: null,
    timestamp: null,
    expiresAt: null
  };
};

/**
 * Create fetch options with CSRF token and enhanced security
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Fetch options with CSRF token
 */
export const createAuthenticatedFetchOptions = async (options = {}) => {
  try {
    const csrfToken = await getCSRFToken();
    
    // Validate token before using
    if (!isValidCSRFToken(csrfToken)) {
      throw new Error('Invalid CSRF token format');
    }
    
    return {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest', // Helps identify AJAX requests
        ...options.headers,
      },
      credentials: 'include',
      // Add timeout to prevent hanging requests
      signal: options.signal || AbortSignal.timeout(30000), // 30 second timeout
    };
  } catch (error) {
    console.error('Error creating authenticated fetch options:', error);
    
    // Clear cache on error and try once more
    clearCSRFTokenCache();
    
    try {
      const csrfToken = await fetchCSRFToken();
      
      if (!isValidCSRFToken(csrfToken)) {
        throw new Error('Invalid CSRF token format on retry');
      }
      
      return {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers,
        },
        credentials: 'include',
        signal: options.signal || AbortSignal.timeout(30000),
      };
    } catch (retryError) {
      console.error('Retry failed for CSRF token:', retryError);
      // Return options without CSRF token as final fallback
      return {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers,
        },
        credentials: 'include',
        signal: options.signal || AbortSignal.timeout(30000),
      };
    }
  }
};

/**
 * Make an authenticated API request with CSRF token and enhanced error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export const authenticatedFetch = async (url, options = {}) => {
  try {
    // Validate URL
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided');
    }
    
    const authenticatedOptions = await createAuthenticatedFetchOptions(options);
    
    const response = await fetch(url, authenticatedOptions);
    
    // Handle CSRF token errors specifically
    if (!response.ok && response.status === 403) {
      const errorData = await response.json().catch(() => ({ message: 'CSRF token error' }));
      console.error('CSRF token error:', errorData);
      
      // Clear cache on CSRF error to force fresh token on next request
      clearCSRFTokenCache();
      
      // If it's a CSRF error, we might want to retry once with a fresh token
      if (errorData.message && errorData.message.toLowerCase().includes('csrf')) {
        console.log('Retrying request with fresh CSRF token');
        clearCSRFTokenCache();
        const retryOptions = await createAuthenticatedFetchOptions(options);
        return await fetch(url, retryOptions);
      }
    }
    
    // Handle other authentication errors
    if (!response.ok && (response.status === 401 || response.status === 403)) {
      const errorData = await response.json().catch(() => ({ message: 'Authentication error' }));
      console.error('Authentication error:', errorData);
    }
    
    return response;
  } catch (error) {
    console.error('Authenticated fetch error:', error);
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error - please check your connection');
    }
    
    throw error;
  }
};
