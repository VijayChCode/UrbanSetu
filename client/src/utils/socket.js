import { io } from "socket.io-client";

const SOCKET_URL = "https://urbansetu.onrender.com"; // backend URL

export const socket = io(SOCKET_URL, {
  withCredentials: true,
  transports: ['websocket'],
}); 