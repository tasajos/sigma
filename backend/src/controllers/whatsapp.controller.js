const { pool } = require('../config/db');
const wa = require('../services/whatsapp.service');
const { registrar } = require('../utils/bitacora');

/** POST /api/whatsapp/coordenadas */
async function enviarCoordenadas(req, res) {
  const { destino, lat, lng, titulo, referencia, nivel, incidente_id, reportado_por, modo } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'Faltan las coordenadas que quieres compartir.' });
  }

  let incidenteTexto = null;
  if (incidente_id) {
    const [[i]] = await pool.query('SELECT codigo, titulo FROM incidentes WHERE id=?', [incidente_id]);
    if (i) incidenteTexto = `${i.codigo} · ${i.titulo}`;
  }

  const mensaje = wa.componerMensaje({
    titulo, lat, lng, referencia, nivel,
    incidente: incidenteTexto,
    reportadoPor: reportado_por || `${req.usuario.nombres} ${req.usuario.apellidos}`,
    hora: new Date().toLocaleString('es-PE')
  });

  const modoFinal = modo || process.env.WHATSAPP_MODO || 'enlace';
  let enlace = null, estado = 'generado';

  if (modoFinal === 'api') {
    try {
      await wa.enviarPorApi(destino, mensaje);
      await wa.enviarUbicacionPorApi(destino, { lat, lng, nombre: titulo, direccion: referencia });
      estado = 'enviado';
    } catch (e) {
      estado = 'fallido';
      await pool.query(
        `INSERT INTO notificaciones_whatsapp (destino, mensaje, lat, lng, incidente_id, modo, estado, enviado_por)
         VALUES (?,?,?,?,?,'api','fallido',?)`,
        [destino || '', mensaje, lat, lng, incidente_id || null, req.usuario.id]);
      return res.status(e.status || 502).json({ error: e.message });
    }
  } else {
    enlace = wa.construirEnlace(destino, mensaje);
  }

  const [r] = await pool.query(
    `INSERT INTO notificaciones_whatsapp (destino, mensaje, lat, lng, incidente_id, modo, estado, enviado_por)
     VALUES (?,?,?,?,?,?,?,?)`,
    [destino || '', mensaje, lat, lng, incidente_id || null, modoFinal, estado, req.usuario.id]);

  await registrar(req, 'whatsapp', 'notificaciones_whatsapp', r.insertId, destino || 'sin destino');
  res.status(201).json({ id: r.insertId, modo: modoFinal, estado, enlace, mensaje });
}

/** POST /api/whatsapp/difusion — envía un mismo aviso a varios destinos */
async function difusion(req, res) {
  const { destinos = [], texto, lat, lng, incidente_id } = req.body;
  if (!destinos.length || !texto) {
    return res.status(400).json({ error: 'Indica al menos un destino y el texto del aviso.' });
  }
  const resultados = [];
  for (const destino of destinos) {
    const enlace = wa.construirEnlace(destino, texto);
    const [r] = await pool.query(
      `INSERT INTO notificaciones_whatsapp (destino, mensaje, lat, lng, incidente_id, modo, estado, enviado_por)
       VALUES (?,?,?,?,?,'enlace','generado',?)`,
      [destino, texto, lat || null, lng || null, incidente_id || null, req.usuario.id]);
    resultados.push({ id: r.insertId, destino, enlace });
  }
  res.status(201).json({ total: resultados.length, resultados });
}

async function historial(req, res) {
  const [filas] = await pool.query(
    `SELECT n.*, CONCAT(u.nombres,' ',u.apellidos) AS emisor, i.codigo AS incidente_codigo
     FROM notificaciones_whatsapp n
     LEFT JOIN usuarios u ON u.id=n.enviado_por
     LEFT JOIN incidentes i ON i.id=n.incidente_id
     ORDER BY n.enviado_en DESC LIMIT 200`);
  res.json(filas);
}

module.exports = { enviarCoordenadas, difusion, historial };
