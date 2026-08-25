import { io } from 'socket.io-client';

let socket = null;

export function conectarSocket(token) {
  if (socket) socket.disconnect();
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', {
    auth: { token },
    transports: ['websocket', 'polling']
  });
  return socket;
}

export function obtenerSocket() { return socket; }

export function desconectarSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
