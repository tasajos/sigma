const { pool } = require('../config/db');
const { registrar } = require('../utils/bitacora');
const { emitir } = require('../sockets');

const PUESTOS = [
  { clave: 'comandante_incidente',        nombre: 'Comandante del Incidente', seccion: 'Comando' },
  { clave: 'oficial_seguridad',           nombre: 'Oficial de Seguridad',     seccion: 'Staff de Comando' },
  { clave: 'oficial_informacion_publica', nombre: 'Oficial de Información Pública', seccion: 'Staff de Comando' },
  { clave: 'oficial_enlace',              nombre: 'Oficial de Enlace',        seccion: 'Staff de Comando' },
  { clave: 'jefe_operaciones',            nombre: 'Jefe de Operaciones',      seccion: 'Staff General' },
  { clave: 'jefe_planificacion',          nombre: 'Jefe de Planificación',    seccion: 'Staff General' },
  { clave: 'jefe_logistica',              nombre: 'Jefe de Logística',        seccion: 'Staff General' },
  { clave: 'jefe_administracion_finanzas',nombre: 'Jefe de Administración y Finanzas', seccion: 'Staff General' }
];

async function puestos(req, res) { res.json(PUESTOS); }

/** POST /api/sci/:incidenteId/activar */
async function activar(req, res) {
  const id = req.params.incidenteId;
  await pool.query('UPDATE incidentes SET sci_activado=TRUE WHERE id=?', [id]);
  const [[inc]] = await pool.query('SELECT codigo, titulo FROM incidentes WHERE id=?', [id]);
  await registrar(req, 'activar_sci', 'incidentes', id, inc?.codigo);
  emitir('sci:activado', { incidente_id: Number(id), codigo: inc?.codigo });
  res.json({ mensaje: `SCI activado para el incidente ${inc?.codigo}.` });
}

async function desactivar(req, res) {
  const id = req.params.incidenteId;
  await pool.query('UPDATE incidentes SET sci_activado=FALSE WHERE id=?', [id]);
  await pool.query('UPDATE sci_estructura SET activo=FALSE WHERE incidente_id=?', [id]);
  await registrar(req, 'desactivar_sci', 'incidentes', id);
  res.json({ mensaje: 'SCI desactivado.' });
}

/** GET /api/sci/:incidenteId */
async function estructura(req, res) {
  const id = req.params.incidenteId;
  const [[inc]] = await pool.query('SELECT id, codigo, titulo, sci_activado, nivel_alerta, estado FROM incidentes WHERE id=?', [id]);
  if (!inc) return res.status(404).json({ error: 'No se encontró ese incidente.' });

  const [asignados] = await pool.query(
    `SELECT s.*, CONCAT(p.nombres,' ',p.apellidos) AS personal, p.codigo AS codigo_personal,
            p.telefono, CONCAT(u.nombres,' ',u.apellidos) AS usuario
     FROM sci_estructura s
     LEFT JOIN personal_emergencia p ON p.id = s.personal_id
     LEFT JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.incidente_id=? AND s.activo=TRUE`, [id]);

  const [objetivos] = await pool.query(
    'SELECT * FROM sci_objetivos WHERE incidente_id=? ORDER BY FIELD(prioridad,"alta","media","baja"), id', [id]);

  const organigrama = PUESTOS.map(p => ({
    ...p, asignacion: asignados.find(a => a.puesto === p.clave) || null
  }));

  res.json({ incidente: inc, organigrama, objetivos });
}

/** PUT /api/sci/:incidenteId/puesto */
async function asignarPuesto(req, res) {
  const { puesto, personal_id, usuario_id, notas } = req.body;
  if (!PUESTOS.some(p => p.clave === puesto)) {
    return res.status(400).json({ error: 'Puesto SCI no válido.' });
  }
  await pool.query(
    `INSERT INTO sci_estructura (incidente_id, puesto, personal_id, usuario_id, notas, activo)
     VALUES (?,?,?,?,?,TRUE)
     ON DUPLICATE KEY UPDATE personal_id=VALUES(personal_id), usuario_id=VALUES(usuario_id),
       notas=VALUES(notas), activo=TRUE, asignado_en=NOW()`,
    [req.params.incidenteId, puesto, personal_id || null, usuario_id || null, notas || null]
  );
  await registrar(req, 'asignar_puesto_sci', 'sci_estructura', req.params.incidenteId, puesto);
  emitir('sci:actualizado', { incidente_id: Number(req.params.incidenteId), puesto });
  res.json({ mensaje: 'Puesto asignado.' });
}

async function liberarPuesto(req, res) {
  await pool.query('UPDATE sci_estructura SET activo=FALSE WHERE incidente_id=? AND puesto=?',
    [req.params.incidenteId, req.params.puesto]);
  res.json({ mensaje: 'Puesto liberado.' });
}

async function crearObjetivo(req, res) {
  const { descripcion, prioridad } = req.body;
  if (!descripcion) return res.status(400).json({ error: 'Escribe el objetivo operacional.' });
  const [r] = await pool.query(
    'INSERT INTO sci_objetivos (incidente_id, descripcion, prioridad) VALUES (?,?,?)',
    [req.params.incidenteId, descripcion, prioridad || 'media']);
  res.status(201).json({ id: r.insertId, mensaje: 'Objetivo agregado.' });
}

async function alternarObjetivo(req, res) {
  await pool.query('UPDATE sci_objetivos SET cumplido = NOT cumplido WHERE id=?', [req.params.objetivoId]);
  res.json({ mensaje: 'Objetivo actualizado.' });
}

async function eliminarObjetivo(req, res) {
  await pool.query('DELETE FROM sci_objetivos WHERE id=?', [req.params.objetivoId]);
  res.json({ mensaje: 'Objetivo eliminado.' });
}

module.exports = { puestos, activar, desactivar, estructura, asignarPuesto, liberarPuesto,
  crearObjetivo, alternarObjetivo, eliminarObjetivo, PUESTOS };
