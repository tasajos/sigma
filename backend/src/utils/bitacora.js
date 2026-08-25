const { pool } = require('../config/db');

async function registrar(req, accion, entidad, entidadId = null, detalle = null) {
  try {
    await pool.query(
      'INSERT INTO bitacora (usuario_id, accion, entidad, entidad_id, detalle, ip) VALUES (?,?,?,?,?,?)',
      [req.usuario?.id || null, accion, entidad, entidadId, detalle, req.ip]
    );
  } catch (e) {
    console.error('[bitacora]', e.message);
  }
}

module.exports = { registrar };
