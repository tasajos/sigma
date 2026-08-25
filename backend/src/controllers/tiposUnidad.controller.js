const { pool } = require('../config/db');

function normalizarClave(etiqueta) {
  return String(etiqueta).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** GET /api/tipos-unidad */
async function listar(req, res) {
  const [filas] = await pool.query('SELECT * FROM tipos_unidad ORDER BY etiqueta');
  res.json(filas);
}

/** POST /api/tipos-unidad */
async function crear(req, res) {
  const { etiqueta, prefijo } = req.body;
  if (!etiqueta || !prefijo) {
    return res.status(400).json({ error: 'Indica el nombre y el prefijo de la nueva categoría.' });
  }
  const clave = normalizarClave(etiqueta);
  if (!clave) return res.status(400).json({ error: 'El nombre de la categoría no es válido.' });

  const pref = String(prefijo).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!pref) return res.status(400).json({ error: 'El prefijo de código no es válido.' });

  await pool.query('INSERT INTO tipos_unidad (clave, etiqueta, prefijo) VALUES (?,?,?)',
    [clave, etiqueta.trim(), pref]);
  res.status(201).json({ clave, etiqueta: etiqueta.trim(), prefijo: pref, mensaje: 'Categoría creada.' });
}

module.exports = { listar, crear };
