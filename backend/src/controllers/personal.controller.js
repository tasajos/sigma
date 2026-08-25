const { pool } = require('../config/db');
const { registrar } = require('../utils/bitacora');

async function listar(req, res) {
  const { estado, q } = req.query;
  let sql = `SELECT p.*, CONCAT(u.nombres,' ',u.apellidos) AS usuario_sistema, u.email
             FROM personal_emergencia p LEFT JOIN usuarios u ON u.id = p.usuario_id WHERE 1=1`;
  const args = [];
  if (estado) { sql += ' AND p.estado = ?'; args.push(estado); }
  if (q) {
    sql += ' AND (p.nombres LIKE ? OR p.apellidos LIKE ? OR p.documento LIKE ? OR p.codigo LIKE ?)';
    args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY p.apellidos, p.nombres';
  const [filas] = await pool.query(sql, args);
  res.json(filas);
}

async function obtener(req, res) {
  const [filas] = await pool.query('SELECT * FROM personal_emergencia WHERE id=?', [req.params.id]);
  if (!filas.length) return res.status(404).json({ error: 'No se encontró ese registro de personal.' });
  res.json(filas[0]);
}

async function crear(req, res) {
  const b = req.body;
  if (!b.nombres || !b.apellidos || !b.documento) {
    return res.status(400).json({ error: 'Nombres, apellidos y documento son obligatorios.' });
  }
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM personal_emergencia');
  const codigo = b.codigo || 'P-' + String(total + 1).padStart(4, '0');
  const [r] = await pool.query(
    `INSERT INTO personal_emergencia
      (usuario_id, codigo, nombres, apellidos, documento, fecha_nacimiento, tipo_sangre, telefono,
       contacto_emergencia, telefono_emergencia, institucion, especialidad, nivel_certificacion,
       vence_certificacion, estado)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [b.usuario_id || null, codigo, b.nombres, b.apellidos, b.documento, b.fecha_nacimiento || null,
     b.tipo_sangre || null, b.telefono || null, b.contacto_emergencia || null, b.telefono_emergencia || null,
     b.institucion || null, b.especialidad || null, b.nivel_certificacion || 'basico',
     b.vence_certificacion || null, b.estado || 'activo']
  );
  await registrar(req, 'crear', 'personal_emergencia', r.insertId, codigo);
  res.status(201).json({ id: r.insertId, codigo, mensaje: 'Personal registrado.' });
}

async function actualizar(req, res) {
  const b = req.body;
  await pool.query(
    `UPDATE personal_emergencia SET
       nombres=COALESCE(?,nombres), apellidos=COALESCE(?,apellidos), documento=COALESCE(?,documento),
       fecha_nacimiento=?, tipo_sangre=?, telefono=?, contacto_emergencia=?, telefono_emergencia=?,
       institucion=?, especialidad=?, nivel_certificacion=COALESCE(?,nivel_certificacion),
       vence_certificacion=?, estado=COALESCE(?,estado)
     WHERE id=?`,
    [b.nombres, b.apellidos, b.documento, b.fecha_nacimiento || null, b.tipo_sangre || null,
     b.telefono || null, b.contacto_emergencia || null, b.telefono_emergencia || null,
     b.institucion || null, b.especialidad || null, b.nivel_certificacion,
     b.vence_certificacion || null, b.estado, req.params.id]
  );
  await registrar(req, 'actualizar', 'personal_emergencia', req.params.id);
  res.json({ mensaje: 'Registro de personal actualizado.' });
}

async function eliminar(req, res) {
  await pool.query('DELETE FROM personal_emergencia WHERE id=?', [req.params.id]);
  await registrar(req, 'eliminar', 'personal_emergencia', req.params.id);
  res.json({ mensaje: 'Registro eliminado.' });
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
