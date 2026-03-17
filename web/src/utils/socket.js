import { io } from "socket.io-client";
import { getAuthToken, refreshAccessToken } from './auth';
import { API_BASE_URL } from '../config/api';

// Prefer explicit socket URL, then API base URL, then same-origin
const SOCKET_URL = API_BASE_URL;

function getToken() {
  const token = getAuthToken();
  // Only log when token is not found to reduce console noise
  if (!token) {
    console.log('[Socket] getToken: not found');
  }
  return token;
}

// Create a socket instance with auth
export let socket = io(SOCKET_URL, {
  auth: {
    token: getToken(),
  },
  withCredentials: true,
  transports: ['websocket'],
});

// Update socket auth token manually
export const updateSocketToken = (newToken) => {
  if (socket) {
    socket.auth = { token: newToken };
    if (socket.connected) {
      // Forced reconnection ensures the new token is used by the server middleware immediately
      socket.disconnect().connect();
    }
  }
};

// Current session id (from cookie or redux payload)
function getSessionId() {
  const match = document.cookie.split('; ').find(row => row.startsWith('session_id='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function registerSessionRoom() {
  const sessionId = getSessionId();
  if (sessionId && socket && socket.connected) {
    socket.emit('registerSession', { sessionId });
  }
}

function registerUserRoom() {
  try {
    const match = document.cookie.split('; ').find(row => row.startsWith('_id='));
    const userId = match ? decodeURIComponent(match.split('=')[1]) : null;
    if (userId && socket && socket.connected) {
      socket.emit('registerUser', { userId });
    }
  } catch (_) { }
}

// Periodically ensure we're joined to the current session room (covers cases where cookie appears after connect)
let sessionRegisterInterval = null;
function ensureSessionRoomRegistration() {
  if (sessionRegisterInterval) return;
  sessionRegisterInterval = setInterval(() => {
    try { registerSessionRoom(); } catch (_) { }
  }, 15000); // every 15s
}

// Add socket event listeners for debugging
socket.on('connect', () => {
  console.log('[Socket] Connected to server');
  registerSessionRoom();
  registerUserRoom();
  ensureSessionRoomRegistration();

  // Re-register user room after connection to ensure authentication
  const token = getToken();
  if (token) {
    // Extract user ID from token if possible, or wait for server to set it
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.id) {
          socket.emit('registerUser', { userId: payload.id });
        }
      }
    } catch (e) {
      // Token parsing failed, will rely on cookie-based registration
    }
  }
});

socket.on('disconnect', () => {
  console.log('[Socket] Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.log('[Socket] Connection error:', error);

  // If token expired, try to refresh or ask user to sign in
  if (error.message && (error.message.includes('expired') || error.message.includes('jwt'))) {
    console.log('[Socket] Token expired, attempting to refresh...');
    
    // Explicitly call refreshAccessToken
    refreshAccessToken().then(newToken => {
      if (newToken) {
        console.log('[Socket] Token refreshed successfully, reconnecting...');
        socket.auth = { token: newToken };
        socket.connect();
      } else {
        console.log('[Socket] Refresh failed, clearing auth');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('sessionId');
        document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
      }
    });
  }
});

// Listen for forced logout events
socket.on('forceLogout', ({ reason }) => {
  console.log('[Socket] Force logout received:', reason);
  // Clear auth and reload to sign-in
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('sessionId');
  } catch (_) { }
  document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
  document.cookie = 'refresh_token=; Max-Age=0; path=/; SameSite=None; Secure';
  document.cookie = 'session_id=; Max-Age=0; path=/; SameSite=None; Secure';
  window.location.href = '/sign-in?error=forced_logout';
});

// Targeted force logout for a specific session (fallback if session room isn't joined)
socket.on('forceLogoutSession', ({ sessionId, reason }) => {
  const current = (document.cookie.split('; ').find(r => r.startsWith('session_id='))?.split('=')[1]) || null;
  if (current && sessionId && current === sessionId) {
    console.log('[Socket] Targeted force logout for this session:', reason);
    try { localStorage.removeItem('accessToken'); localStorage.removeItem('sessionId'); } catch (_) { }
    document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
    document.cookie = 'refresh_token=; Max-Age=0; path=/; SameSite=None; Secure';
    document.cookie = 'session_id=; Max-Age=0; path=/; SameSite=None; Secure';
    window.location.href = '/sign-in?error=forced_logout';
  }
});

// Function to reconnect socket with new token (call after login/logout)
export function reconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
  // Only log reconnection if there's a token (login) to reduce noise
  const token = getToken();
  if (token) {
    console.log('[Socket] reconnecting with token');
  }
  socket = io(SOCKET_URL, {
    auth: {
      token: token,
    },
    withCredentials: true,
    transports: ['websocket'],
  });

  // Add socket event listeners for debugging
  socket.on('connect', () => {
    // Only log reconnection if there's a token (login) to reduce noise
    if (token) {
      console.log('[Socket] Reconnected to server');
    }
    registerSessionRoom();
    registerUserRoom();

    // Re-register user room after reconnection
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.id) {
            socket.emit('registerUser', { userId: payload.id });
          }
        }
      } catch (e) {
        // Token parsing failed
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from server');
  });

  socket.on('connect_error', (error) => {
    console.log('[Socket] Connection error:', error);

    // If token expired, try to refresh or ask user to sign in
    if (error.message && (error.message.includes('expired') || error.message.includes('jwt'))) {
      console.log('[Socket] Token expired, attempting to refresh...');
      
      refreshAccessToken().then(newToken => {
        if (newToken) {
          console.log('[Socket] Token refreshed successfully, reconnecting...');
          socket.auth = { token: newToken };
          socket.connect();
        } else {
          console.log('[Socket] Refresh failed, clearing auth');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('sessionId');
          document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
        }
      });
    }
  });

  socket.on('forceLogout', ({ reason }) => {
    console.log('[Socket] Force logout received:', reason);
    try { localStorage.removeItem('accessToken'); localStorage.removeItem('sessionId'); } catch (_) { }
    document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
    document.cookie = 'refresh_token=; Max-Age=0; path=/; SameSite=None; Secure';
    document.cookie = 'session_id=; Max-Age=0; path=/; SameSite=None; Secure';
    window.location.href = '/sign-in?error=forced_logout';
  });
  socket.on('forceLogoutSession', ({ sessionId, reason }) => {
    const current = (document.cookie.split('; ').find(r => r.startsWith('session_id='))?.split('=')[1]) || null;
    if (current && sessionId && current === sessionId) {
      console.log('[Socket] Targeted force logout for this session:', reason);
      try { localStorage.removeItem('accessToken'); localStorage.removeItem('sessionId'); } catch (_) { }
      document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
      document.cookie = 'refresh_token=; Max-Age=0; path=/; SameSite=None; Secure';
      document.cookie = 'session_id=; Max-Age=0; path=/; SameSite=None; Secure';
      window.location.href = '/sign-in?error=forced_logout';
    }
  });
} 