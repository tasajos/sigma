const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function inicializar(servidorHttp) {
  io = new Server(servidorHttp, {
    cors: { origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','), credentials: true }
  });

  // Autenticación del canal en tiempo real
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Sesión requerida.'));
    try {
      socket.usuario = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Sesión no válida.'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.usuario;
    socket.join(`rol:${u.rol}`);
    socket.join(`usuario:${u.id}`);
    console.log(`[socket] ${u.email} (${u.rol}) conectado`);

    socket.on('incidente:seguir', (incidenteId) => socket.join(`incidente:${incidenteId}`));
    socket.on('incidente:dejar', (incidenteId) => socket.leave(`incidente:${incidenteId}`));
    socket.on('disconnect', () => console.log(`[socket] ${u.email} desconectado`));
  });

  return io;
}

/** Difunde un evento a todos los tableros conectados */
function emitir(evento, carga) {
  if (io) io.emit(evento, carga);
}

/** Difunde solo a una sala (rol, usuario o incidente) */
function emitirA(sala, evento, carga) {
  if (io) io.to(sala).emit(evento, carga);
}

module.exports = { inicializar, emitir, emitirA, obtenerIo: () => io };
