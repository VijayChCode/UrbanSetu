import { io } from "socket.io-client";
import { getAuthToken } from './auth';

const SOCKET_URL = "https://urbansetu.onrender.com"; // backend URL

function getToken() {
  const token = getAuthToken();
  console.log('[Socket] getToken:', token ? 'found' : 'not found');
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