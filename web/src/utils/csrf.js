import { API_BASE_URL } from '../config/api.js';

// Cache for CSRF token to avoid multiple requests
let csrfTokenCache = {
  token: null,
  timestamp: null,
  expiresAt: null
};

// Cache duration: 50 minutes (tokens expire in 1 hour)
const CACHE_DURATION = 50 * 60 * 1000;

/**
 * Fetch CSRF token from the server
 * @returns {Promise<string>} CSRF token
 */
export const fetchCSRFToken = async () => {
  try {

    // Always fetch a fresh token since server deletes tokens after use
    const response = await fetch(`${API_BASE_URL}/api/auth/csrf-token`, {
      method: 'GET',
      credentials: 'include', // Important: include cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });


    if (!response.ok) {
      const errorText = await response.text();
      console.error('CSRF token fetch failed:', response.status, errorText);
      throw new Error(`Failed to fetch CSRF token: ${response.status}`);
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('CSRF token response is not JSON:', text);
      throw new Error('Server returned non-JSON response');
    }

    const data = await response.json();

    if (!data.csrfToken) {
      throw new Error('No CSRF token received from server');
    }

    // Don't cache the token since server deletes it after use
    return data.csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
};

/**
 * Get CSRF token (always fetch fresh one since server deletes after use)
 * @returns {Promise<string>} CSRF token
 */
export const getCSRFToken = async () => {
  return await fetchCSRFToken();
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
 * Create fetch options with CSRF token
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Fetch options with CSRF token
 */
export const createAuthenticatedFetchOptions = async (options = {}) => {
  try {
    const csrfToken = await getCSRFToken();

    const headers = {
      'X-CSRF-Token': csrfToken,
      ...(localStorage.getItem('accessToken') ? { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } : {}),
      ...(localStorage.getItem('sessionId') ? { 'X-Session-Id': localStorage.getItem('sessionId') } : {}),
      ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    return {
      ...options,
      headers,
      credentials: 'include',
    };
  } catch (error) {
    console.error('Error creating authenticated fetch options:', error);
    // Try once more without caching
    try {
      const csrfToken = await fetchCSRFToken();
      const headers = {
        'X-CSRF-Token': csrfToken,
        ...(localStorage.getItem('accessToken') ? { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` } : {}),
        ...(localStorage.getItem('sessionId') ? { 'X-Session-Id': localStorage.getItem('sessionId') } : {}),
        ...options.headers,
      };

      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      return {
        ...options,
        headers,
        credentials: 'include',
      };
    } catch (retryError) {
      console.error('Retry failed for CSRF token:', retryError);
      // Return options without CSRF token as final fallback
      return {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include',
      };
    }
  }
};

/**
 * Make an authenticated API request with CSRF token
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export const authenticatedFetch = async (url, options = {}) => {
  try {
    const authenticatedOptions = await createAuthenticatedFetchOptions(options);

    let response = await fetch(url, authenticatedOptions);

    // Intercept 401 and try to refresh token
    if (response.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            if (data.token) {
              localStorage.setItem('accessToken', data.token);
              // Retry original request with new token
              const newOptions = {
                ...authenticatedOptions,
                headers: {
                  ...authenticatedOptions.headers,
                  'Authorization': `Bearer ${data.token}`
                }
              };
              response = await fetch(url, newOptions);
            }
          } else {
            // Refresh failed - likely expired refresh token
            localStorage.removeItem('accessToken');
            localStorage.removeItem('sessionId');
            localStorage.removeItem('refreshToken');
          }
        } catch (e) {
          console.error("Token refresh failed", e);
        }
      }
    }

    // Intercept 403 and try to refresh CSRF token if expired
    if (response.status === 403 && !options._csrfRetry) {
      const cloned = response.clone();
      let isCsrfExpired = false;
      try {
        const errorData = await cloned.json();
        if (errorData.message === 'CSRF token expired') {
          isCsrfExpired = true;
        }
      } catch (e) {
        const text = await cloned.text();
        if (text.includes('CSRF token expired')) {
          isCsrfExpired = true;
        }
      }

      if (isCsrfExpired) {
        console.log('CSRF token expired, retrying with fresh token...');
        try {
          // Clear cache and fetch a new one
          clearCSRFTokenCache();
          const newOptions = await createAuthenticatedFetchOptions({ ...options, _csrfRetry: true });
          return await fetch(url, newOptions);
        } catch (retryError) {
          console.error('CSRF retry failed:', retryError);
        }
      }
    }

    if (!response.ok) {
      const cloned = response.clone();
      let errorData = null;
      try {
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          errorData = await cloned.json();
        } else {
          const text = await cloned.text();
          errorData = { message: text };
        }
      } catch (_) {
        // Fallback if body parsing fails
        try {
          const text = await cloned.text();
          errorData = { message: text };
        } catch (_) {
          errorData = { message: `HTTP ${response.status}` };
        }
      }
      console.error(`${response.status} response:`, errorData);
    }

    return response;
  } catch (error) {
    console.error('Authenticated fetch error:', error);
    throw error;
  }
};
