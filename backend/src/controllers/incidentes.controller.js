const { pool } = require('../config/db');
const { registrar } = require('../utils/bitacora');
const { emitir } = require('../sockets');

function nuevoCodigo(id) {
  const f = new Date();
  return `INC-${f.getFullYear()}${String(f.getMonth() + 1).padStart(2, '0')}-${String(id).padStart(4, '0')}`;
}

async function listar(req, res) {
  const { estado, nivel } = req.query;
  let sql = `SELECT i.*, CONCAT(u.nombres,' ',u.apellidos) AS reportante,
              (SELECT COUNT(*) FROM asignaciones_unidad a WHERE a.incidente_id=i.id AND a.liberado_en IS NULL) AS unidades_asignadas
             FROM incidentes i LEFT JOIN usuarios u ON u.id=i.reportado_por WHERE 1=1`;
  const args = [];
  if (estado) { sql += ' AND i.estado=?'; args.push(estado); }
  if (nivel)  { sql += ' AND i.nivel_alerta=?'; args.push(nivel); }
  sql += " ORDER BY FIELD(i.nivel_alerta,'rojo','naranja','amarillo','verde'), i.fecha_inicio DESC";
  const [filas] = await pool.query(sql, args);
  res.json(filas);
}

async function obtener(req, res) {
  const id = req.params.id;
  const [[incidente]] = await pool.query(
    `SELECT i.*, CONCAT(u.nombres,' ',u.apellidos) AS reportante
     FROM incidentes i LEFT JOIN usuarios u ON u.id=i.reportado_por WHERE i.id=?`, [id]);
  if (!incidente) return res.status(404).json({ error: 'No se encontró ese incidente.' });

  const [unidades] = await pool.query(
    `SELECT a.id AS asignacion_id, un.* FROM asignaciones_unidad a
     JOIN unidades_operativas un ON un.id=a.unidad_id
     WHERE a.incidente_id=? AND a.liberado_en IS NULL`, [id]);

  const [ubicaciones] = await pool.query(
    `SELECT * FROM v_ultima_ubicacion WHERE incidente_id=?`, [id]);

  res.json({ ...incidente, unidades, ubicaciones });
}

async function crear(req, res) {
  const b = req.body;
  if (!b.titulo || !b.tipo || b.lat == null || b.lng == null) {
    return res.status(400).json({ error: 'Indica título, tipo y la posición del incidente en el mapa.' });
  }
  const [r] = await pool.query(
    `INSERT INTO incidentes (codigo, titulo, descripcion, tipo, nivel_alerta, estado, lat, lng, direccion, afectados, reportado_por)
     VALUES ('TMP',?,?,?,?, 'activo', ?,?,?,?,?)`,
    [b.titulo, b.descripcion || null, b.tipo, b.nivel_alerta || 'verde',
     b.lat, b.lng, b.direccion || null, b.afectados || 0, req.usuario.id]
  );
  const codigo = nuevoCodigo(r.insertId);
  await pool.query('UPDATE incidentes SET codigo=? WHERE id=?', [codigo, r.insertId]);

  await registrar(req, 'crear', 'incidentes', r.insertId, codigo);
  emitir('incidente:nuevo', { id: r.insertId, codigo, titulo: b.titulo, nivel_alerta: b.nivel_alerta || 'verde', lat: b.lat, lng: b.lng });
  res.status(201).json({ id: r.insertId, codigo, mensaje: 'Incidente abierto.' });
}

async function actualizar(req, res) {
  const b = req.body;
  await pool.query(
    `UPDATE incidentes SET titulo=COALESCE(?,titulo), descripcion=?, tipo=COALESCE(?,tipo),
       nivel_alerta=COALESCE(?,nivel_alerta), estado=COALESCE(?,estado), lat=COALESCE(?,lat),
       lng=COALESCE(?,lng), direccion=?, afectados=COALESCE(?,afectados),
       fecha_cierre = IF(?='cerrado', NOW(), fecha_cierre)
     WHERE id=?`,
    [b.titulo, b.descripcion || null, b.tipo, b.nivel_alerta, b.estado, b.lat, b.lng,
     b.direccion || null, b.afectados, b.estado || '', req.params.id]
  );
  await registrar(req, 'actualizar', 'incidentes', req.params.id, b.nivel_alerta || '');
  emitir('incidente:actualizado', { id: Number(req.params.id), ...b });
  res.json({ mensaje: 'Incidente actualizado.' });
}

async function cambiarNivel(req, res) {
  const { nivel_alerta } = req.body;
  if (!['verde', 'amarillo', 'naranja', 'rojo'].includes(nivel_alerta)) {
    return res.status(400).json({ error: 'Nivel de alerta no válido.' });
  }
  await pool.query('UPDATE incidentes SET nivel_alerta=? WHERE id=?', [nivel_alerta, req.params.id]);
  const [[inc]] = await pool.query('SELECT codigo, titulo FROM incidentes WHERE id=?', [req.params.id]);

  await pool.query(
    `INSERT INTO alertas (incidente_id, nivel, titulo, mensaje, canal, emitida_por)
     VALUES (?,?,?,?, 'interno', ?)`,
    [req.params.id, nivel_alerta, `Cambio a alerta ${nivel_alerta.toUpperCase()}`,
     `El incidente ${inc.codigo} (${inc.titulo}) pasó a nivel de alerta ${nivel_alerta}.`, req.usuario.id]
  );

  await registrar(req, 'cambiar_nivel', 'incidentes', req.params.id, nivel_alerta);
  emitir('alerta:nivel', { incidente_id: Number(req.params.id), nivel_alerta, codigo: inc.codigo, titulo: inc.titulo });
  res.json({ mensaje: `Incidente elevado a nivel ${nivel_alerta}.` });
}

async function asignarUnidad(req, res) {
  const { unidad_id } = req.body;
  await pool.query('INSERT INTO asignaciones_unidad (incidente_id, unidad_id) VALUES (?,?)',
    [req.params.id, unidad_id]);
  await pool.query("UPDATE unidades_operativas SET estado='en_ruta' WHERE id=?", [unidad_id]);
  emitir('unidad:asignada', { incidente_id: Number(req.params.id), unidad_id });
  res.status(201).json({ mensaje: 'Unidad asignada al incidente.' });
}

async function liberarUnidad(req, res) {
  await pool.query('UPDATE asignaciones_unidad SET liberado_en=NOW() WHERE id=?', [req.params.asignacionId]);
  const [[a]] = await pool.query('SELECT unidad_id FROM asignaciones_unidad WHERE id=?', [req.params.asignacionId]);
  if (a) await pool.query("UPDATE unidades_operativas SET estado='disponible' WHERE id=?", [a.unidad_id]);
  res.json({ mensaje: 'Unidad liberada.' });
}

async function eliminar(req, res) {
  await pool.query('DELETE FROM incidentes WHERE id=?', [req.params.id]);
  await registrar(req, 'eliminar', 'incidentes', req.params.id);
  res.json({ mensaje: 'Incidente eliminado.' });
}

module.exports = { listar, obtener, crear, actualizar, cambiarNivel, asignarUnidad, liberarUnidad, eliminar };
