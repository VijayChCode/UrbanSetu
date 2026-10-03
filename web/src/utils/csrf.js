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
 * @param {string} url - The URL being fetched
 * @returns {Promise<Object>} Fetch options with CSRF token
 */
export const createAuthenticatedFetchOptions = async (options = {}, url = '') => {
  try {
    // List of public routes that don't need CSRF protection
    const publicRoutes = [
      '/api/auth/signin',
      '/api/auth/signup',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/send-otp',
      '/api/auth/verify-otp',
      '/api/auth/send-forgot-password-otp',
      '/api/auth/send-login-otp',
      '/api/auth/verify-login-otp',
      '/api/auth/refresh',
      '/api/auth/csrf-token'
    ];

    const isPublicRoute = url && publicRoutes.some(route => url.includes(route));

    // Skip CSRF if it's a public route or if we already have a Bearer token
    // (Note: verifyCSRFToken middleware on backend also skips if Bearer is present)
    const authToken = localStorage.getItem('accessToken');
    const csrfToken = isPublicRoute ? null : await getCSRFToken();

    const headers = {
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
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
    // Return options without CSRF token as fallback
    return {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    };
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
    const authenticatedOptions = await createAuthenticatedFetchOptions(options, url);

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
              // Save rotated refresh token so the old one doesn't get reused
              if (data.refreshToken) {
                localStorage.setItem('refreshToken', data.refreshToken);
              }
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

/**
 * Upload a file with real-time progress tracking using XMLHttpRequest.
 * The native fetch API does NOT support upload progress events, so we use XHR.
 * 
 * @param {string} url - API endpoint URL
 * @param {FormData} formData - FormData with the file to upload
 * @param {Object} options - Options
 * @param {AbortSignal} [options.signal] - AbortController signal for cancellation
 * @param {function(number): void} [options.onProgress] - Progress callback receiving 0-100
 * @returns {Promise<Object>} Parsed JSON response from the server
 */
export const uploadWithProgress = (url, formData, { signal, onProgress } = {}) => {
  return new Promise(async (resolve, reject) => {
    let aborted = false;

    try {
      // Get auth headers (same logic as authenticatedFetch)
      const authToken = localStorage.getItem('accessToken');
      let csrfToken = null;
      try {
        csrfToken = await getCSRFToken();
      } catch (_) { /* proceed without CSRF if fetch fails */ }

      const xhr = new XMLHttpRequest();

      // Handle abort signal
      if (signal) {
        if (signal.aborted) {
          const err = new Error('Upload aborted');
          err.name = 'AbortError';
          reject(err);
          return;
        }
        const onAbort = () => {
          aborted = true;
          xhr.abort();
        };
        signal.addEventListener('abort', onAbort, { once: true });
        // Cleanup listener when XHR finishes
        xhr.addEventListener('loadend', () => signal.removeEventListener('abort', onAbort), { once: true });
      }

      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            const error = new Error(data.message || `Upload failed with status ${xhr.status}`);
            error.response = { status: xhr.status, data };
            reject(error);
          }
        } catch (e) {
          reject(new Error('Failed to parse upload response'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Upload network error'));
      };

      xhr.onabort = () => {
        const err = new Error('Upload aborted');
        err.name = 'AbortError';
        reject(err);
      };

      xhr.open('POST', url);

      // Set headers (don't set Content-Type — browser auto-sets multipart boundary for FormData)
      if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) xhr.setRequestHeader('X-Session-Id', sessionId);
      xhr.withCredentials = true;

      xhr.send(formData);
    } catch (error) {
      if (!aborted) reject(error);
    }
  });
};

/**
 * Upload a video directly from the browser to Cloudinary, bypassing the backend.
 * The backend only provides a lightweight signature — the actual file never touches Render.
 * This eliminates RAM/timeout issues on Render's free tier for large videos.
 *
 * @param {File} file - The video file to upload
 * @param {Object} options - { signal, onProgress }
 * @returns {Promise<{ videoUrl: string, publicId: string }>}
 */
export const uploadVideoDirectToCloudinary = async (file, { signal, onProgress } = {}) => {
  // Step 1: Get signed upload params from our backend (lightweight, no file data)
  const authToken = localStorage.getItem('accessToken');
  const sessionId = localStorage.getItem('sessionId');
  const sigRes = await fetch(`${API_BASE_URL}/api/upload/video-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
    },
    credentials: 'include',
  });

  if (!sigRes.ok) {
    throw new Error('Failed to get upload signature');
  }

  const { signature, timestamp, folder, cloudName, apiKey, accountIndex } = await sigRes.json();

  // Step 2: Upload directly to Cloudinary (browser → Cloudinary, no backend involved)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (signal) {
      if (signal.aborted) {
        const err = new Error('Upload aborted');
        err.name = 'AbortError';
        return reject(err);
      }
      const onAbort = () => xhr.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      xhr.addEventListener('loadend', () => signal.removeEventListener('abort', onAbort), { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          // Record the upload in our pool tracking (fire-and-forget)
          fetch(`${API_BASE_URL}/api/upload/video-confirm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({ accountIndex, fileSize: file.size }),
          }).catch(() => {});

          resolve({ videoUrl: data.secure_url, publicId: data.public_id });
        } else {
          reject(new Error(data.error?.message || `Cloudinary upload failed (${xhr.status})`));
        }
      } catch (e) {
        reject(new Error('Failed to parse Cloudinary response'));
      }
    };

    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.onabort = () => {
      const err = new Error('Upload aborted');
      err.name = 'AbortError';
      reject(err);
    };

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', apiKey);
    form.append('timestamp', timestamp);
    form.append('signature', signature);
    form.append('folder', folder);
    form.append('resource_type', 'video');

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
    xhr.send(form);
  });
};
