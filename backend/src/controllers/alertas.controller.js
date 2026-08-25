const { pool } = require('../config/db');
const { registrar } = require('../utils/bitacora');
const { emitir } = require('../sockets');

const NIVELES = {
  verde:    { orden: 1, etiqueta: 'Verde',    accion: 'Vigilancia. Sin despliegue.' },
  amarillo: { orden: 2, etiqueta: 'Amarillo', accion: 'Preparación. Unidades en alistamiento.' },
  naranja:  { orden: 3, etiqueta: 'Naranja',  accion: 'Respuesta. Despliegue y activación SCI.' },
  rojo:     { orden: 4, etiqueta: 'Rojo',     accion: 'Emergencia mayor. Notificación a prensa y autoridades.' }
};

async function catalogoNiveles(req, res) { res.json(NIVELES); }

async function listar(req, res) {
  const [filas] = await pool.query(
    `SELECT a.*, i.codigo AS incidente_codigo, i.titulo AS incidente_titulo,
            CONCAT(u.nombres,' ',u.apellidos) AS emisor
     FROM alertas a
     LEFT JOIN incidentes i ON i.id=a.incidente_id
     LEFT JOIN usuarios u ON u.id=a.emitida_por
     ORDER BY a.emitida_en DESC LIMIT 200`);
  res.json(filas);
}

async function emitirAlerta(req, res) {
  const { incidente_id, nivel, titulo, mensaje, canal } = req.body;
  if (!nivel || !titulo || !mensaje) {
    return res.status(400).json({ error: 'Indica nivel, título y mensaje de la alerta.' });
  }
  const [r] = await pool.query(
    `INSERT INTO alertas (incidente_id, nivel, titulo, mensaje, canal, emitida_por) VALUES (?,?,?,?,?,?)`,
    [incidente_id || null, nivel, titulo, mensaje, canal || 'interno', req.usuario.id]);

  await registrar(req, 'emitir_alerta', 'alertas', r.insertId, `${nivel}/${canal || 'interno'}`);
  emitir('alerta:nueva', {
    id: r.insertId, nivel, titulo, mensaje, canal: canal || 'interno',
    incidente_id: incidente_id || null, emitida_en: new Date().toISOString()
  });
  res.status(201).json({ id: r.insertId, mensaje: 'Alerta emitida.' });
}

async function marcarLeida(req, res) {
  await pool.query('UPDATE alertas SET leida=TRUE WHERE id=?', [req.params.id]);
  res.json({ mensaje: 'Alerta marcada como leída.' });
}

async function resumen(req, res) {
  const [[incidentes]] = await pool.query(
    `SELECT COUNT(*) AS total,
       SUM(estado='activo') AS activos,
       SUM(nivel_alerta='rojo' AND estado='activo') AS rojos,
       SUM(nivel_alerta='naranja' AND estado='activo') AS naranjas,
       SUM(nivel_alerta='amarillo' AND estado='activo') AS amarillos,
       SUM(sci_activado=TRUE AND estado='activo') AS sci_activos
     FROM incidentes`);
  const [[personal]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(estado='activo') AS activos FROM personal_emergencia`);
  const [[unidades]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(estado='disponible') AS disponibles,
       SUM(estado IN ('en_ruta','en_escena')) AS desplegadas FROM unidades_operativas`);
  const [[campo]] = await pool.query(
    `SELECT COUNT(*) AS en_campo FROM v_ultima_ubicacion
     WHERE reportado_en >= DATE_SUB(NOW(), INTERVAL 60 MINUTE)`);
  const [porTipo] = await pool.query(
    `SELECT tipo, COUNT(*) AS total FROM incidentes GROUP BY tipo ORDER BY total DESC`);
  const [ultimos7] = await pool.query(
    `SELECT DATE(fecha_inicio) AS dia, COUNT(*) AS total FROM incidentes
     WHERE fecha_inicio >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(fecha_inicio) ORDER BY dia`);

  const nivelGlobal = incidentes.rojos > 0 ? 'rojo'
    : incidentes.naranjas > 0 ? 'naranja'
    : incidentes.amarillos > 0 ? 'amarillo' : 'verde';

  res.json({ nivelGlobal, incidentes, personal, unidades, campo, porTipo, ultimos7 });
}

module.exports = { catalogoNiveles, listar, emitirAlerta, marcarLeida, resumen, NIVELES };
