import { API_BASE_URL } from '../config/api';

export const areCookiesEnabled = () => {
  // Dummy function to prevent breaking imports
  return true;
};

export const getAuthToken = () => {
  return localStorage.getItem("accessToken");
};

export const createAuthenticatedFetchOptions = (options = {}) => {
  const token = getAuthToken();
  const sessionId = localStorage.getItem("sessionId");

  return {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {})
    }
  };
};

export const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include'
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      if (data.token) {
        localStorage.setItem("accessToken", data.token);
        return data.token;
      }
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
  }
  return null;
};

export const authenticatedFetch = async (url, options = {}) => {
  const { autoRedirect = true, ...fetchOptions } = options;
  const opts = createAuthenticatedFetchOptions(fetchOptions);
  let response = await fetch(url, opts);

  if (response.status === 401 && !options._retry) {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem('refreshToken');

    // ONLY attempt refresh if we have a refresh token
    if (refreshToken) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry original request with new token
        const newOpts = createAuthenticatedFetchOptions({ ...fetchOptions, _retry: true });
        response = await fetch(url, newOpts);
        return response;
      }
    }

    // If we reach here, either refresh failed or No refresh token was present.
    // If it was meant to be an authenticated request (we had a token) and refresh failed, 
    // OR if the endpoint is strictly requiring auth and we want to redirect.

    // WE SHOULD ONLY REDIRECT IF:
    // 1. autoRedirect is true
    // 2. We are in a browser
    // 3. We are not already on sign-in
    // 4. IMPORTANT: Only if we HAD an accessToken or refreshToken (meaning the user IS logged in but session expired).
    // Guest users should NOT be redirected for 401s on public pages.

    if (autoRedirect && (accessToken || refreshToken)) {
      clearAuthData();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-in')) {
        window.location.href = '/sign-in';
      }
    }
  }
  return response;
};

export const isAuthenticated = () => {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
};

export const clearAuthData = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("sessionId");
  localStorage.removeItem("refreshToken");
};