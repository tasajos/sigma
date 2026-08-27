const crypto = require('crypto');
const { pool } = require('../config/db');
const { emitir } = require('../sockets');
const wa = require('../services/whatsapp.service');

const HORAS_VALIDEZ_DEFECTO = 12;

/**
 * Construye la URL pública del enlace a partir del origen real desde el que
 * el centro de monitoreo hizo la petición (cabecera Origin del navegador),
 * para que el enlace generado apunte a la misma dirección que el operador
 * está usando: la IP de red en desarrollo, o el dominio real en producción.
 * FRONTEND_URL queda como respaldo si esa cabecera no llega.
 */
function urlPublica(token, req) {
  const base = (req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/u/${token}`;
}

async function buscarVigente(token) {
  const [[fila]] = await pool.query('SELECT * FROM enlaces_ubicacion WHERE token=?', [token]);
  if (!fila) return null;
  return { ...fila, vencido: new Date(fila.expira_en) < new Date() };
}

/** POST /api/enlaces — el centro de monitoreo genera un enlace para pedir la ubicación de cualquiera */
async function crear(req, res) {
  const { etiqueta, telefono, incidente_id, horas_validez } = req.body;
  if (!etiqueta || !etiqueta.trim()) {
    return res.status(400).json({ error: 'Indica a quién corresponde este enlace (nombre o referencia).' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  const horas = Number(horas_validez) > 0 ? Number(horas_validez) : HORAS_VALIDEZ_DEFECTO;
  const expiraEn = new Date(Date.now() + horas * 3600 * 1000);

  const [r] = await pool.query(
    `INSERT INTO enlaces_ubicacion (token, etiqueta, telefono, incidente_id, creado_por, expira_en)
     VALUES (?,?,?,?,?,?)`,
    [token, etiqueta.trim(), telefono || null, incidente_id || null, req.usuario.id, expiraEn]
  );

  let incidenteTexto = null;
  if (incidente_id) {
    const [[i]] = await pool.query('SELECT codigo, titulo FROM incidentes WHERE id=?', [incidente_id]);
    if (i) incidenteTexto = `${i.codigo} · ${i.titulo}`;
  }

  const url = urlPublica(token, req);
  const mensaje = [
    `*Solicitud de ubicación · SIGMA-SCI*`,
    `${req.usuario.nombres} ${req.usuario.apellidos} del centro de monitoreo solicita tu ubicación en tiempo real` +
      (incidenteTexto ? ` para el incidente ${incidenteTexto}.` : '.'),
    '',
    'Abre este enlace y autoriza compartir tu ubicación:',
    url,
    '',
    `El enlace vence el ${expiraEn.toLocaleString('es-PE')}.`
  ].join('\n');

  res.status(201).json({
    id: r.insertId, token, url, mensaje,
    enlace_whatsapp: wa.construirEnlace(telefono, mensaje),
    expira_en: expiraEn
  });
}

/** GET /api/enlaces — enlaces vigentes, para el panel del centro de monitoreo */
async function listar(req, res) {
  const [filas] = await pool.query(
    `SELECT e.*, CONCAT(u.nombres,' ',u.apellidos) AS creado_por_nombre, i.codigo AS incidente_codigo
     FROM enlaces_ubicacion e
     LEFT JOIN usuarios u ON u.id = e.creado_por
     LEFT JOIN incidentes i ON i.id = e.incidente_id
     WHERE e.expira_en > NOW() AND e.estado <> 'finalizado'
     ORDER BY e.creado_en DESC`
  );
  res.json(filas);
}

/** POST /api/enlaces/:id/cancelar — el centro de monitoreo cierra un enlace antes de que venza */
async function cancelar(req, res) {
  await pool.query(`UPDATE enlaces_ubicacion SET estado='finalizado' WHERE id=?`, [req.params.id]);
  const [[e]] = await pool.query('SELECT token FROM enlaces_ubicacion WHERE id=?', [req.params.id]);
  if (e) emitir('ubicacion:enlace:finalizado', { enlace_id: Number(req.params.id), token: e.token });
  res.json({ mensaje: 'Enlace cancelado.' });
}

/** GET /api/enlaces/publico/:token — la página pública lee quién y para qué solicita la ubicación */
async function obtenerPublico(req, res) {
  const enlace = await buscarVigente(req.params.token);
  if (!enlace) return res.status(404).json({ error: 'El enlace no existe.' });
  if (enlace.vencido) return res.status(410).json({ error: 'El enlace venció. Solicita uno nuevo al centro de monitoreo.' });

  const [[creador]] = await pool.query('SELECT nombres, apellidos FROM usuarios WHERE id=?', [enlace.creado_por]);
  let incidente = null;
  if (enlace.incidente_id) {
    const [[i]] = await pool.query('SELECT codigo, titulo FROM incidentes WHERE id=?', [enlace.incidente_id]);
    incidente = i || null;
  }
  res.json({
    etiqueta: enlace.etiqueta, estado: enlace.estado, expira_en: enlace.expira_en,
    solicitante: creador ? `${creador.nombres} ${creador.apellidos}` : 'Centro de monitoreo',
    incidente
  });
}

/** POST /api/enlaces/publico/:token/autorizar — el destinatario acepta transmitir su posición */
async function autorizar(req, res) {
  const enlace = await buscarVigente(req.params.token);
  if (!enlace) return res.status(404).json({ error: 'El enlace no existe.' });
  if (enlace.vencido) return res.status(410).json({ error: 'El enlace venció.' });
  await pool.query(`UPDATE enlaces_ubicacion SET estado='activo' WHERE id=?`, [enlace.id]);
  res.json({ mensaje: 'Ubicación autorizada. Ya puedes transmitir tu posición.' });
}

/** POST /api/enlaces/publico/:token/rechazar */
async function rechazar(req, res) {
  const enlace = await buscarVigente(req.params.token);
  if (!enlace) return res.status(404).json({ error: 'El enlace no existe.' });
  await pool.query(`UPDATE enlaces_ubicacion SET estado='rechazado' WHERE id=?`, [enlace.id]);
  res.json({ mensaje: 'Solicitud rechazada.' });
}

/** POST /api/enlaces/publico/:token/ubicacion — el destinatario transmite su posición en vivo */
async function reportarUbicacion(req, res) {
  const { lat, lng, precision_m } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'No se recibieron coordenadas. Activa la ubicación del dispositivo.' });
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'Las coordenadas están fuera de rango.' });
  }
  const enlace = await buscarVigente(req.params.token);
  if (!enlace) return res.status(404).json({ error: 'El enlace no existe.' });
  if (enlace.vencido) return res.status(410).json({ error: 'El enlace venció.' });
  if (enlace.estado !== 'activo') {
    return res.status(403).json({ error: 'Este enlace todavía no fue autorizado.' });
  }

  await pool.query(
    `INSERT INTO enlace_posiciones (enlace_id, lat, lng, precision_m) VALUES (?,?,?,?)`,
    [enlace.id, lat, lng, precision_m || null]
  );
  await pool.query(
    `UPDATE enlaces_ubicacion SET lat=?, lng=?, precision_m=?, ultima_actividad=NOW() WHERE id=?`,
    [lat, lng, precision_m || null, enlace.id]
  );

  emitir('ubicacion:enlace', {
    enlace_id: enlace.id, token: enlace.token, etiqueta: enlace.etiqueta,
    lat: Number(lat), lng: Number(lng), precision_m: precision_m || null,
    incidente_id: enlace.incidente_id, reportado_en: new Date().toISOString()
  });
  res.json({ mensaje: 'Ubicación transmitida.' });
}

/** POST /api/enlaces/publico/:token/finalizar — el propio destinatario deja de compartir */
async function finalizar(req, res) {
  const enlace = await buscarVigente(req.params.token);
  if (!enlace) return res.status(404).json({ error: 'El enlace no existe.' });
  await pool.query(`UPDATE enlaces_ubicacion SET estado='finalizado' WHERE id=?`, [enlace.id]);
  emitir('ubicacion:enlace:finalizado', { enlace_id: enlace.id, token: enlace.token });
  res.json({ mensaje: 'Dejaste de compartir tu ubicación.' });
}

module.exports = {
  crear, listar, cancelar, obtenerPublico, autorizar, rechazar, reportarUbicacion, finalizar
};
