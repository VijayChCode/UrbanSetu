import { io } from "socket.io-client";

const SOCKET_URL = "https://urbansetu.onrender.com"; // backend URL

// Helper to get token from localStorage (or cookies if you use them)
function getToken() {
  return localStorage.getItem('accessToken');
}

// Create a socket instance with auth
export let socket = io(SOCKET_URL, {
  auth: {
    token: getToken(),
  },
  withCredentials: true,
  transports: ['websocket'],
});

// Function to reconnect socket with new token (call after login/logout)
export function reconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
  socket = io(SOCKET_URL, {
    auth: {
      token: getToken(),
    },
    withCredentials: true,
    transports: ['websocket'],
  });
} 