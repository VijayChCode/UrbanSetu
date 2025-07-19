import { io } from "socket.io-client";

const SOCKET_URL = "https://urbansetu.onrender.com"; // backend URL

// Helper to get token from cookie (preferred) or localStorage (fallback)
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function getToken() {
  // Try cookie first (since backend sets 'access_token' cookie)
  const cookieToken = getCookie('access_token');
  if (cookieToken) {
    console.log('[Socket] getToken from cookie:', cookieToken);
    return cookieToken;
  }
  // Fallback to localStorage if needed
  const localToken = localStorage.getItem('accessToken');
  console.log('[Socket] getToken from localStorage:', localToken);
  return localToken;
}

// Create a socket instance with auth
export let socket = io(SOCKET_URL, {
  auth: {
    token: getToken(),
  },
  withCredentials: true,
  transports: ['websocket'],
});

// Add socket event listeners for debugging
socket.on('connect', () => {
  console.log('[Socket] Connected to server');
});

socket.on('disconnect', () => {
  console.log('[Socket] Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.log('[Socket] Connection error:', error);
});

// Function to reconnect socket with new token (call after login/logout)
export function reconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
  console.log('[Socket] reconnecting with token:', getToken());
  socket = io(SOCKET_URL, {
    auth: {
      token: getToken(),
    },
    withCredentials: true,
    transports: ['websocket'],
  });
  
  // Add socket event listeners for debugging
  socket.on('connect', () => {
    console.log('[Socket] Reconnected to server');
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from server');
  });

  socket.on('connect_error', (error) => {
    console.log('[Socket] Connection error:', error);
  });
} 