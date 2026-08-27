const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PERMISOS } = require('../config/roles');

let io = null;

/** Dispositivos con sesión abierta ahora mismo, por usuario_id */
const conectados = new Map();

function tienePermiso(permiso, rol) {
  return (PERMISOS[permiso] || []).includes(rol);
}

function difundirDispositivos() {
  emitir('ubicacion:dispositivos', [...conectados.values()]);
}

const IP_RED_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/;

/**
 * A diferencia del CORS de Express, Socket.IO valida la cabecera Origin de
 * cada conexión (incluida la del proxy de Vite) contra esta lista, aunque
 * el navegador nunca la vea directamente. Fuera de producción se acepta
 * cualquier IP de red local además de los orígenes configurados, para que
 * un celular que entra por la IP del equipo pueda conectarse en desarrollo.
 */
function origenSocketPermitido(origen, callback) {
  const permitidos = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
  if (!origen || permitidos.includes(origen)) return callback(null, true);
  if (process.env.NODE_ENV !== 'production' && IP_RED_LOCAL.test(origen)) return callback(null, true);
  callback(new Error('Origen no permitido.'));
}

function inicializar(servidorHttp) {
  io = new Server(servidorHttp, {
    cors: { origin: origenSocketPermitido, credentials: true }
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

    if (tienePermiso('ubicacion.enviar', u.rol)) {
      conectados.set(u.id, {
        usuario_id: u.id, nombres: u.nombres, apellidos: u.apellidos,
        rol: u.rol, conectado_en: new Date().toISOString()
      });
      difundirDispositivos();
    }

    socket.on('incidente:seguir', (incidenteId) => socket.join(`incidente:${incidenteId}`));
    socket.on('incidente:dejar', (incidenteId) => socket.leave(`incidente:${incidenteId}`));

    // El centro de monitoreo pide a un dispositivo que transmita su posición
    socket.on('ubicacion:solicitar', ({ usuarioId }) => {
      if (!tienePermiso('ubicacion.monitorear', u.rol) || !usuarioId) return;
      emitirA(`usuario:${usuarioId}`, 'ubicacion:solicitud', {
        solicitanteId: u.id, solicitanteNombre: `${u.nombres} ${u.apellidos}`,
        solicitanteRol: u.rol, ts: new Date().toISOString()
      });
    });

    // El dispositivo acepta o rechaza la solicitud de ubicación
    socket.on('ubicacion:solicitud:respuesta', ({ solicitanteId, aceptada }) => {
      if (!solicitanteId) return;
      emitirA(`usuario:${solicitanteId}`, 'ubicacion:solicitud:respuesta', {
        usuarioId: u.id, nombres: u.nombres, apellidos: u.apellidos, aceptada: !!aceptada
      });
    });

    socket.on('disconnect', () => {
      console.log(`[socket] ${u.email} desconectado`);
      if (conectados.has(u.id)) {
        conectados.delete(u.id);
        difundirDispositivos();
      }
    });
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

module.exports = {
  inicializar, emitir, emitirA, obtenerIo: () => io,
  listarConectados: () => [...conectados.values()]
};
