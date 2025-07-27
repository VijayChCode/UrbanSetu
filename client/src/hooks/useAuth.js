import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { areCookiesEnabled, getAuthToken, isAuthenticated } from '../utils/auth';

// Custom hook for authentication state and utilities
export const useAuth = () => {
  const { currentUser, loading, error } = useSelector((state) => state.user);
  const [cookiesEnabled, setCookiesEnabled] = useState(true);
  const [authMethod, setAuthMethod] = useState('cookie'); // 'cookie' or 'localStorage'

  useEffect(() => {
    // Check cookie support on mount
    const checkCookies = () => {
      const enabled = areCookiesEnabled();
      setCookiesEnabled(enabled);
      setAuthMethod(enabled ? 'cookie' : 'localStorage');
      
      if (!enabled) {
        console.warn('Third-party cookies are blocked. Authentication will use localStorage fallback.');
      }
    };

    checkCookies();
    
    // Recheck periodically in case settings change
    const interval = setInterval(checkCookies, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const token = getAuthToken();
  const authenticated = isAuthenticated();

  return {
    currentUser,
    loading,
    error,
    token,
    authenticated,
    cookiesEnabled,
    authMethod,
    // Helper methods
    hasValidToken: () => !!token && authenticated,
    getToken: getAuthToken,
    isUsingFallback: () => authMethod === 'localStorage'
  };
};

export default useAuth;