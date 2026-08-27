import { io } from 'socket.io-client';

let socket = null;

export function conectarSocket(token) {
  if (socket) socket.disconnect();
  // Sin VITE_SOCKET_URL, se conecta al mismo origen que sirvió la app
  // (en desarrollo eso pasa por el proxy de Vite hacia el backend, así
  // que funciona igual entrando por localhost o por la IP de red).
  socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling']
  });
  return socket;
}

export function obtenerSocket() { return socket; }

export function desconectarSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
