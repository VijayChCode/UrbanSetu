// Utility functions for handling authentication with cookie and localStorage fallbacks
import { authenticatedFetch as csrfAuthenticatedFetch } from './csrf.js';

// Check if cookies are working by setting and reading a test cookie
export const areCookiesEnabled = () => {
  try {
    // Try to set a test cookie
    document.cookie = "test_cookie=1; path=/; SameSite=None; Secure";
    
    // Try to read it back
    const testValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('test_cookie='))
      ?.split('=')[1];
    
    // Clean up test cookie
    document.cookie = "test_cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=None; Secure";
    
    return testValue === '1';
  } catch (error) {
    console.warn('Cookie test failed:', error);
    return false;
  }
};

// Get token from cookie (preferred) or localStorage (fallback)
export const getAuthToken = () => {
  // Try cookie first
  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('access_token='))
    ?.split('=')[1];
  
  if (cookieToken) {
    return cookieToken;
  }
  
  // Fallback to localStorage
  return localStorage.getItem('accessToken');
};

// Create fetch options with proper authentication headers
export const createAuthenticatedFetchOptions = (options = {}) => {
  const token = getAuthToken();
  const cookiesEnabled = areCookiesEnabled();
  
  const fetchOptions = {
    credentials: 'include', // Always include for CORS
    ...options
  };
  
  // If cookies are not working or no cookie token available, use Authorization header
  if (!cookiesEnabled || !document.cookie.includes('access_token=')) {
    if (token) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Authorization': `Bearer ${token}`
      };
    }
  }
  
  return fetchOptions;
};

// Enhanced fetch function that automatically handles authentication and CSRF
export const authenticatedFetch = async (url, options = {}) => {
  return csrfAuthenticatedFetch(url, options);
};

// Check if user is authenticated (has valid token)
export const isAuthenticated = () => {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    // Basic JWT structure check (3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Check if token is expired (basic check)
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Date.now() / 1000;
    
    // If token has expiration and it's expired
    if (payload.exp && payload.exp < currentTime) {
      // Clean up expired token
      localStorage.removeItem('accessToken');
      document.cookie = 'access_token=; Max-Age=0; path=/; domain=' + window.location.hostname + '; secure; samesite=None';
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('Token validation failed:', error);
    return false;
  }
};

// Clear all authentication data
export const clearAuthData = () => {
  localStorage.removeItem('accessToken');
  document.cookie = 'access_token=; Max-Age=0; path=/; domain=' + window.location.hostname + '; secure; samesite=None';
};