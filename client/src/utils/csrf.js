// CSRF token utility functions

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Get CSRF token from server
export const getCSRFToken = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/csrf-token`, {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to get CSRF token');
        }
        
        const data = await response.json();
        return data.csrfToken;
    } catch (error) {
        console.error('Error getting CSRF token:', error);
        return null;
    }
};

// Create authenticated fetch options with CSRF token
export const createAuthenticatedFetchOptions = async (options = {}) => {
    const csrfToken = await getCSRFToken();
    
    const fetchOptions = {
        credentials: 'include',
        ...options
    };
    
    // Add CSRF token to headers
    if (csrfToken) {
        fetchOptions.headers = {
            ...fetchOptions.headers,
            'X-CSRF-Token': csrfToken
        };
    }
    
    // Add CSRF token to body for POST requests
    if (options.method === 'POST' && options.body) {
        try {
            const bodyData = JSON.parse(options.body);
            bodyData._csrf = csrfToken;
            fetchOptions.body = JSON.stringify(bodyData);
        } catch (error) {
            console.error('Error adding CSRF token to body:', error);
        }
    }
    
    return fetchOptions;
};

// Enhanced fetch function that automatically handles CSRF
export const authenticatedFetch = async (url, options = {}) => {
    const authOptions = await createAuthenticatedFetchOptions(options);
    return fetch(url, authOptions);
};