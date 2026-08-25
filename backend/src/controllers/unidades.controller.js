const { pool } = require('../config/db');
const { registrar } = require('../utils/bitacora');

/** Calcula el siguiente código disponible para un tipo, a partir de su
 *  prefijo (AMB, AUT, ...) y el mayor número ya usado con ese prefijo.
 *  El código es único a nivel global, así que evita colisiones entre
 *  categorías aunque haya datos históricos mal clasificados. */
async function generarCodigo(tipoClave) {
  const [[t]] = await pool.query('SELECT prefijo FROM tipos_unidad WHERE clave=?', [tipoClave]);
  if (!t) throw Object.assign(new Error('Tipo de unidad no encontrado.'), { status: 400 });

  const [filas] = await pool.query(
    "SELECT codigo FROM unidades_operativas WHERE codigo LIKE CONCAT(?, '-%')", [t.prefijo]
  );
  let maximo = 0;
  for (const f of filas) {
    const n = parseInt(String(f.codigo).slice(t.prefijo.length + 1), 10);
    if (!Number.isNaN(n) && n > maximo) maximo = n;
  }
  return `${t.prefijo}-${String(maximo + 1).padStart(2, '0')}`;
}

/** GET /api/unidades/siguiente-codigo?tipo=ambulancia */
async function siguienteCodigo(req, res) {
  if (!req.query.tipo) return res.status(400).json({ error: 'Indica el tipo de unidad.' });
  res.json({ codigo: await generarCodigo(req.query.tipo) });
}

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
  if (!b.tipo) return res.status(400).json({ error: 'El tipo de unidad es obligatorio.' });
  const codigo = await generarCodigo(b.tipo);
  const [r] = await pool.query(
    `INSERT INTO unidades_operativas (codigo, tipo, placa, descripcion, capacidad, base, responsable_id, estado, lat, lng)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [codigo, b.tipo, b.placa || null, b.descripcion || null, b.capacidad || 0, b.base || null,
     b.responsable_id || null, b.estado || 'disponible', b.lat || null, b.lng || null]
  );
  await registrar(req, 'crear', 'unidades_operativas', r.insertId, codigo);
  res.status(201).json({ id: r.insertId, codigo, mensaje: 'Unidad registrada.' });
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

module.exports = { listar, crear, actualizar, eliminar, siguienteCodigo };
