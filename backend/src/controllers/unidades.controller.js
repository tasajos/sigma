const { pool } = require('../config/db');
const { registrar } = require('../utils/bitacora');

async function listar(req, res) {
  const { estado, tipo } = req.query;
  let sql = `SELECT un.*, CONCAT(p.nombres,' ',p.apellidos) AS responsable
             FROM unidades_operativas un
             LEFT JOIN personal_emergencia p ON p.id = un.responsable_id WHERE 1=1`;
  const args = [];
  if (estado) { sql += ' AND un.estado=?'; args.push(estado); }
  if (tipo)   { sql += ' AND un.tipo=?';   args.push(tipo); }
  sql += ' ORDER BY un.codigo';
  const [filas] = await pool.query(sql, args);
  res.json(filas);
}

async function crear(req, res) {
  const b = req.body;
  if (!b.codigo || !b.tipo) return res.status(400).json({ error: 'Código y tipo de unidad son obligatorios.' });
  const [r] = await pool.query(
    `INSERT INTO unidades_operativas (codigo, tipo, placa, descripcion, capacidad, base, responsable_id, estado, lat, lng)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [b.codigo, b.tipo, b.placa || null, b.descripcion || null, b.capacidad || 0, b.base || null,
     b.responsable_id || null, b.estado || 'disponible', b.lat || null, b.lng || null]
  );
  await registrar(req, 'crear', 'unidades_operativas', r.insertId, b.codigo);
  res.status(201).json({ id: r.insertId, mensaje: 'Unidad registrada.' });
}

async function actualizar(req, res) {
  const b = req.body;
  await pool.query(
    `UPDATE unidades_operativas SET codigo=COALESCE(?,codigo), tipo=COALESCE(?,tipo), placa=?,
       descripcion=?, capacidad=COALESCE(?,capacidad), base=?, responsable_id=?,
       estado=COALESCE(?,estado), lat=?, lng=? WHERE id=?`,
    [b.codigo, b.tipo, b.placa || null, b.descripcion || null, b.capacidad, b.base || null,
     b.responsable_id || null, b.estado, b.lat || null, b.lng || null, req.params.id]
  );
  await registrar(req, 'actualizar', 'unidades_operativas', req.params.id);
  res.json({ mensaje: 'Unidad actualizada.' });
}

async function eliminar(req, res) {
  await pool.query('DELETE FROM unidades_operativas WHERE id=?', [req.params.id]);
  await registrar(req, 'eliminar', 'unidades_operativas', req.params.id);
  res.json({ mensaje: 'Unidad eliminada.' });
}

module.exports = { listar, crear, actualizar, eliminar };
