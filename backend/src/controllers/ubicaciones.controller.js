const { pool } = require('../config/db');
const { emitir, listarConectados } = require('../sockets');

/** POST /api/ubicaciones — el actor en campo reporta su posición */
async function reportar(req, res) {
  const { lat, lng, precision_m, altitud_m, bateria, estado, nota, incidente_id } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'No se recibieron coordenadas. Activa la ubicación del dispositivo.' });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Las coordenadas están fuera de rango.' });
  }

  const [r] = await pool.query(
    `INSERT INTO ubicaciones (usuario_id, incidente_id, lat, lng, precision_m, altitud_m, bateria, estado, nota)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [req.usuario.id, incidente_id || null, lat, lng, precision_m || null, altitud_m || null,
     bateria ?? null, estado || 'disponible', nota || null]
  );

  const carga = {
    id: r.insertId, usuario_id: req.usuario.id,
    nombres: req.usuario.nombres, apellidos: req.usuario.apellidos, rol: req.usuario.rol,
    lat: Number(lat), lng: Number(lng), precision_m, estado: estado || 'disponible',
    nota: nota || null, incidente_id: incidente_id || null, reportado_en: new Date().toISOString()
  };

  emitir('ubicacion:nueva', carga);
  if ((estado || '') === 'emergencia') emitir('ubicacion:emergencia', carga);

  res.status(201).json({ mensaje: 'Ubicación transmitida al centro de monitoreo.', ubicacion: carga });
}

/** GET /api/ubicaciones/actuales — última posición de cada actor */
async function actuales(req, res) {
  const [filas] = await pool.query('SELECT * FROM v_ultima_ubicacion ORDER BY reportado_en DESC');
  res.json(filas);
}

/** GET /api/ubicaciones/historial/:usuarioId — recorrido */
async function historial(req, res) {
  const limite = Math.min(Number(req.query.limite || 100), 500);
  const [filas] = await pool.query(
    'SELECT * FROM ubicaciones WHERE usuario_id=? ORDER BY reportado_en DESC LIMIT ?',
    [req.params.usuarioId, limite]);
  res.json(filas);
}

/** GET /api/ubicaciones/mias */
async function mias(req, res) {
  const [filas] = await pool.query(
    'SELECT * FROM ubicaciones WHERE usuario_id=? ORDER BY reportado_en DESC LIMIT 50', [req.usuario.id]);
  res.json(filas);
}

/** GET /api/ubicaciones/conectados — dispositivos con sesión abierta ahora mismo */
async function conectados(req, res) {
  res.json(listarConectados());
}

module.exports = { reportar, actuales, historial, mias, conectados };
