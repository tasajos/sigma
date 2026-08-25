const { pool } = require('../config/db');
const { registrar } = require('../utils/bitacora');
const { emitir } = require('../sockets');

async function listar(req, res) {
  const [filas] = await pool.query(
    `SELECT b.*, i.codigo AS incidente_codigo, i.titulo AS incidente_titulo,
            CONCAT(u.nombres,' ',u.apellidos) AS autor
     FROM boletines_prensa b
     LEFT JOIN incidentes i ON i.id=b.incidente_id
     LEFT JOIN usuarios u ON u.id=b.creado_por
     ORDER BY b.creado_en DESC`);
  res.json(filas);
}

async function obtener(req, res) {
  const [filas] = await pool.query(
    `SELECT b.*, i.codigo AS incidente_codigo FROM boletines_prensa b
     LEFT JOIN incidentes i ON i.id=b.incidente_id WHERE b.id=?`, [req.params.id]);
  if (!filas.length) return res.status(404).json({ error: 'No se encontró ese boletín.' });
  res.json(filas[0]);
}

async function crear(req, res) {
  const { incidente_id, nivel, titulo, cuerpo, vocero } = req.body;
  if (!titulo || !cuerpo || !nivel) {
    return res.status(400).json({ error: 'Indica nivel, titular y cuerpo del boletín.' });
  }
  const [r] = await pool.query(
    `INSERT INTO boletines_prensa (incidente_id, nivel, titulo, cuerpo, vocero, creado_por)
     VALUES (?,?,?,?,?,?)`,
    [incidente_id || null, nivel, titulo, cuerpo, vocero || null, req.usuario.id]);
  await registrar(req, 'crear', 'boletines_prensa', r.insertId, nivel);
  res.status(201).json({ id: r.insertId, mensaje: 'Boletín guardado como borrador.' });
}

async function actualizar(req, res) {
  const { titulo, cuerpo, vocero, nivel, estado } = req.body;
  await pool.query(
    `UPDATE boletines_prensa SET titulo=COALESCE(?,titulo), cuerpo=COALESCE(?,cuerpo),
      vocero=?, nivel=COALESCE(?,nivel), estado=COALESCE(?,estado),
      publicado_en = IF(?='publicado', NOW(), publicado_en) WHERE id=?`,
    [titulo, cuerpo, vocero || null, nivel, estado, estado || '', req.params.id]);
  res.json({ mensaje: 'Boletín actualizado.' });
}

/** POST /api/prensa/:id/publicar — difunde a los canales de prensa */
async function publicar(req, res) {
  const [[b]] = await pool.query('SELECT * FROM boletines_prensa WHERE id=?', [req.params.id]);
  if (!b) return res.status(404).json({ error: 'No se encontró ese boletín.' });
  if (!['naranja', 'rojo'].includes(b.nivel) && !req.body.forzar) {
    return res.status(400).json({
      error: 'Los boletines a prensa se difunden en nivel naranja o rojo. Marca "forzar" para publicar de todas formas.'
    });
  }
  await pool.query("UPDATE boletines_prensa SET estado='publicado', publicado_en=NOW() WHERE id=?", [req.params.id]);
  await pool.query(
    `INSERT INTO alertas (incidente_id, nivel, titulo, mensaje, canal, emitida_por)
     VALUES (?,?,?,?, 'prensa', ?)`,
    [b.incidente_id, b.nivel, `Boletín de prensa: ${b.titulo}`, b.cuerpo.slice(0, 500), req.usuario.id]);

  await registrar(req, 'publicar', 'boletines_prensa', b.id, b.nivel);
  emitir('prensa:publicado', { id: b.id, titulo: b.titulo, nivel: b.nivel });
  res.json({ mensaje: 'Boletín publicado y registrado en la bitácora de alertas.' });
}

async function eliminar(req, res) {
  await pool.query('DELETE FROM boletines_prensa WHERE id=?', [req.params.id]);
  res.json({ mensaje: 'Boletín eliminado.' });
}

module.exports = { listar, obtener, crear, actualizar, publicar, eliminar };
