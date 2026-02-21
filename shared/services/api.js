// API Service for both Web and Mobile
import { API_BASE_URL, API_ENDPOINTS } from '../constants/api.js';

// Base API configuration
const createApiClient = (baseURL = API_BASE_URL) => {
  const client = {
    baseURL,

    // Generic request method
    request: async (endpoint, options = {}) => {
      const { headers, ...restOptions } = options;
      const url = `${baseURL}${endpoint}`;
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        ...restOptions,
      };

      // Add auth token if available (will be implemented per platform)
      const token = await client.getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || `HTTP ${response.status}`);
        }

        return data;
      } catch (error) {
        console.error('API Request Error:', error);
        throw error;
      }
    },

    // HTTP methods
    get: (endpoint, options = {}) =>
      client.request(endpoint, { method: 'GET', ...options }),

    post: (endpoint, data, options = {}) =>
      client.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
        ...options
      }),

    put: (endpoint, data, options = {}) =>
      client.request(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data),
        ...options
      }),

    delete: (endpoint, options = {}) =>
      client.request(endpoint, { method: 'DELETE', ...options }),

    patch: (endpoint, data, options = {}) =>
      client.request(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(data),
        ...options
      }),

    // Platform-specific token getter (to be overridden)
    /** @type {function(): Promise<string | null>} */
    getAuthToken: async () => null,
  };

  return client;
};

// Create default API client
const api = createApiClient();

// Authentication API
export const authAPI = {
  signup: (userData) => api.post(API_ENDPOINTS.AUTH.SIGNUP, userData),
  signin: (credentials) => api.post(API_ENDPOINTS.AUTH.SIGNIN, credentials),
  signout: () => api.post(API_ENDPOINTS.AUTH.SIGNOUT),
  googleAuth: (token) => api.post(API_ENDPOINTS.AUTH.GOOGLE, { token }),
};

// User API
export const userAPI = {
  updateProfile: (userData) => api.post(API_ENDPOINTS.USER.PROFILE, userData),
  deleteAccount: (userId) => api.delete(`${API_ENDPOINTS.USER.DELETE}/${userId}`),
  getUserListings: (userId) => api.get(`${API_ENDPOINTS.USER.LISTINGS}/${userId}`),
};

// Listings API
export const listingsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`${API_ENDPOINTS.LISTINGS.SEARCH}?${queryString}`);
  },
  getById: (id) => api.get(`${API_ENDPOINTS.LISTINGS.BASE}/${id}`),
  create: (listingData) => api.post(API_ENDPOINTS.LISTINGS.CREATE, listingData),
  update: (id, listingData) => api.put(`${API_ENDPOINTS.LISTINGS.UPDATE}/${id}`, listingData),
  delete: (id) => api.delete(`${API_ENDPOINTS.LISTINGS.DELETE}/${id}`),
  search: (searchParams) => api.get(`${API_ENDPOINTS.LISTINGS.SEARCH}?${new URLSearchParams(searchParams)}`),
};

// Bookings API
export const bookingsAPI = {
  getAll: () => api.get(API_ENDPOINTS.BOOKINGS.BASE),
  getById: (id) => api.get(`${API_ENDPOINTS.BOOKINGS.BASE}/${id}`),
  create: (bookingData) => api.post(API_ENDPOINTS.BOOKINGS.CREATE, bookingData),
  update: (id, updateData) => api.put(`${API_ENDPOINTS.BOOKINGS.UPDATE}/${id}`, updateData),
  getArchived: () => api.get(API_ENDPOINTS.BOOKINGS.ARCHIVED),
};

// Wishlist API
export const wishlistAPI = {
  getAll: () => api.get(API_ENDPOINTS.WISHLIST.BASE),
  add: (listingId) => api.post(API_ENDPOINTS.WISHLIST.ADD, { listingId }),
  remove: (listingId) => api.delete(`${API_ENDPOINTS.WISHLIST.REMOVE}/${listingId}`),
};

// Contact API
export const contactAPI = {
  submit: (contactData) => api.post(API_ENDPOINTS.CONTACT.SUBMIT, contactData),
};

// Admin API
export const adminAPI = {
  getPendingRequests: () => api.get(API_ENDPOINTS.ADMIN.REQUESTS),
  approveRequest: (userId) => api.put(`${API_ENDPOINTS.ADMIN.APPROVE}/${userId}`),
  rejectRequest: (userId) => api.put(`${API_ENDPOINTS.ADMIN.REJECT}/${userId}`),
};

// Upload API
export const uploadAPI = {
  uploadImage: (formData) => api.request(API_ENDPOINTS.UPLOAD.IMAGE, {
    method: 'POST',
    body: formData,
    headers: {}, // Let browser set Content-Type for FormData
  }),
  uploadDocument: (formData) => api.request(API_ENDPOINTS.UPLOAD.DOCUMENT, {
    method: 'POST',
    body: formData,
    headers: {}, // Let browser set Content-Type for FormData
  }),
};

// Export the API client for platform-specific customization
export { createApiClient };
export default api;
