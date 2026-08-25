const { pool } = require('../config/db');
const P = require('../services/pdf.service');
const { PUESTOS } = require('./sci.controller');
const { registrar } = require('../utils/bitacora');

function enviar(res, doc, nombre) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  doc.pipe(res);
  P.finalizar(doc);
}

const NOMBRE_PUESTO = Object.fromEntries(PUESTOS.map(p => [p.clave, p.nombre]));

/* ============================================================
   1. Informe de incidente (situacional)
   ============================================================ */
async function informeIncidente(req, res) {
  const id = req.params.id;
  const [[inc]] = await pool.query(
    `SELECT i.*, CONCAT(u.nombres,' ',u.apellidos) AS reportante
     FROM incidentes i LEFT JOIN usuarios u ON u.id=i.reportado_por WHERE i.id=?`, [id]);
  if (!inc) return res.status(404).json({ error: 'No se encontró ese incidente.' });

  const [unidades] = await pool.query(
    `SELECT un.codigo, un.tipo, un.placa, un.estado, un.base, a.asignado_en
     FROM asignaciones_unidad a JOIN unidades_operativas un ON un.id=a.unidad_id
     WHERE a.incidente_id=? AND a.liberado_en IS NULL`, [id]);

  const [sci] = await pool.query(
    `SELECT s.puesto, CONCAT(p.nombres,' ',p.apellidos) AS personal, p.telefono, s.notas
     FROM sci_estructura s LEFT JOIN personal_emergencia p ON p.id=s.personal_id
     WHERE s.incidente_id=? AND s.activo=TRUE`, [id]);

  const [ubic] = await pool.query(
    `SELECT nombres, apellidos, rol, lat, lng, estado, reportado_en
     FROM v_ultima_ubicacion WHERE incidente_id=?`, [id]);

  const [alertas] = await pool.query(
    `SELECT nivel, titulo, canal, emitida_en FROM alertas WHERE incidente_id=? ORDER BY emitida_en DESC LIMIT 15`, [id]);

  const doc = P.crearDocumento({
    titulo: 'Informe situacional de incidente',
    subtitulo: inc.titulo,
    nivel: inc.nivel_alerta,
    codigo: inc.codigo
  });

  P.indicadores(doc, [
    { rotulo: 'Estado',   valor: inc.estado.toUpperCase(), color: P.C.acento },
    { rotulo: 'Afectados', valor: inc.afectados, color: P.C.naranja },
    { rotulo: 'Unidades', valor: unidades.length, color: P.C.verde },
    { rotulo: 'En campo', valor: ubic.length, color: P.C.amarillo }
  ]);

  P.seccion(doc, 'Datos del evento');
  P.ficha(doc, [
    ['Código', inc.codigo, 'mono'],
    ['Tipo de evento', inc.tipo.replace(/_/g, ' ')],
    ['Fecha de inicio', P.fecha(inc.fecha_inicio)],
    ['Fecha de cierre', inc.fecha_cierre ? P.fecha(inc.fecha_cierre) : 'En curso'],
    ['Latitud', P.coord(inc.lat), 'mono'],
    ['Longitud', P.coord(inc.lng), 'mono'],
    ['Dirección o referencia', inc.direccion],
    ['Reportado por', inc.reportante],
    ['SCI', inc.sci_activado ? 'Activado' : 'No activado'],
    ['Nivel de alerta', inc.nivel_alerta.toUpperCase()]
  ]);

  P.seccion(doc, 'Descripción');
  P.parrafo(doc, inc.descripcion || 'Sin descripción registrada.');

  if (inc.sci_activado && sci.length) {
    P.seccion(doc, 'Estructura de comando activada');
    P.tabla(doc, ['Puesto SCI', 'Responsable', 'Contacto', 'Notas'],
      sci.map(s => [NOMBRE_PUESTO[s.puesto] || s.puesto, s.personal, s.telefono, s.notas]),
      { anchos: [150, 140, 90, 119] });
  }

  P.seccion(doc, 'Unidades desplegadas');
  unidades.length
    ? P.tabla(doc, ['Código', 'Tipo', 'Placa', 'Estado', 'Base', 'Asignada'],
        unidades.map(u => [u.codigo, u.tipo.replace(/_/g, ' '), u.placa, u.estado.replace(/_/g, ' '), u.base, P.fecha(u.asignado_en)]),
        { anchos: [60, 90, 70, 80, 90, 109] })
    : P.parrafo(doc, 'No hay unidades asignadas a este incidente.');

  P.seccion(doc, 'Última posición del personal en campo');
  ubic.length
    ? P.tabla(doc, ['Personal', 'Perfil', 'Latitud', 'Longitud', 'Estado', 'Reporte'],
        ubic.map(u => [`${u.nombres} ${u.apellidos}`, u.rol, P.coord(u.lat), P.coord(u.lng), u.estado.replace(/_/g, ' '), P.fecha(u.reportado_en)]),
        { anchos: [110, 78, 75, 75, 76, 85] })
    : P.parrafo(doc, 'No se han recibido posiciones asociadas a este incidente.');

  if (alertas.length) {
    P.seccion(doc, 'Historial de alertas');
    P.tabla(doc, ['Nivel', 'Título', 'Canal', 'Emitida'],
      alertas.map(a => [a.nivel.toUpperCase(), a.titulo, a.canal, P.fecha(a.emitida_en)]),
      { anchos: [60, 219, 80, 140] });
  }

  await registrar(req, 'exportar_pdf', 'incidentes', id, 'informe situacional');
  enviar(res, doc, `informe-${inc.codigo}.pdf`);
}

/* ============================================================
   2. Informe SCI (organigrama y objetivos)
   ============================================================ */
async function informeSci(req, res) {
  const id = req.params.id;
  const [[inc]] = await pool.query('SELECT * FROM incidentes WHERE id=?', [id]);
  if (!inc) return res.status(404).json({ error: 'No se encontró ese incidente.' });

  const [asignados] = await pool.query(
    `SELECT s.*, CONCAT(p.nombres,' ',p.apellidos) AS personal, p.codigo AS codigo_personal, p.telefono
     FROM sci_estructura s LEFT JOIN personal_emergencia p ON p.id=s.personal_id
     WHERE s.incidente_id=? AND s.activo=TRUE`, [id]);
  const [objetivos] = await pool.query(
    'SELECT * FROM sci_objetivos WHERE incidente_id=? ORDER BY FIELD(prioridad,"alta","media","baja")', [id]);

  const doc = P.crearDocumento({
    titulo: 'Sistema de Comando de Incidentes',
    subtitulo: `${inc.titulo} · Estructura organizacional del periodo operacional`,
    nivel: inc.nivel_alerta,
    codigo: inc.codigo
  });

  P.seccion(doc, 'Referencia del incidente');
  P.ficha(doc, [
    ['Incidente', inc.codigo, 'mono'],
    ['Estado del SCI', inc.sci_activado ? 'ACTIVADO' : 'NO ACTIVADO'],
    ['Inicio del periodo', P.fecha(inc.fecha_inicio)],
    ['Posición', `${P.coord(inc.lat)}, ${P.coord(inc.lng)}`, 'mono']
  ]);

  ['Comando', 'Staff de Comando', 'Staff General'].forEach(seccionNombre => {
    const puestosSeccion = PUESTOS.filter(p => p.seccion === seccionNombre);
    P.seccion(doc, seccionNombre);
    P.tabla(doc, ['Puesto', 'Responsable asignado', 'Contacto', 'Observaciones'],
      puestosSeccion.map(p => {
        const a = asignados.find(x => x.puesto === p.clave);
        return [p.nombre, a?.personal || 'Sin asignar', a?.telefono || '—', a?.notas || '—'];
      }), { anchos: [150, 140, 90, 119] });
  });

  P.seccion(doc, 'Objetivos del periodo operacional');
  objetivos.length
    ? P.tabla(doc, ['Prioridad', 'Objetivo', 'Cumplido'],
        objetivos.map(o => [o.prioridad.toUpperCase(), o.descripcion, o.cumplido ? 'Sí' : 'Pendiente']),
        { anchos: [80, 339, 80] })
    : P.parrafo(doc, 'No se han definido objetivos para este periodo operacional.');

  await registrar(req, 'exportar_pdf', 'sci', id, 'informe SCI');
  enviar(res, doc, `sci-${inc.codigo}.pdf`);
}

/* ============================================================
   3. Boletín de prensa
   ============================================================ */
async function boletinPrensa(req, res) {
  const [[b]] = await pool.query(
    `SELECT b.*, i.codigo AS incidente_codigo, i.titulo AS incidente_titulo, i.lat, i.lng, i.direccion,
            CONCAT(u.nombres,' ',u.apellidos) AS autor
     FROM boletines_prensa b
     LEFT JOIN incidentes i ON i.id=b.incidente_id
     LEFT JOIN usuarios u ON u.id=b.creado_por WHERE b.id=?`, [req.params.id]);
  if (!b) return res.status(404).json({ error: 'No se encontró ese boletín.' });

  const doc = P.crearDocumento({
    titulo: 'Boletín oficial de prensa',
    subtitulo: `${process.env.ORG_CIUDAD || ''} · ${b.estado.toUpperCase()}`,
    nivel: b.nivel,
    codigo: b.incidente_codigo || `BOL-${String(b.id).padStart(4, '0')}`
  });

  doc.fillColor(P.C.tinta).font('Helvetica-Bold').fontSize(19)
     .text(b.titulo, 48, doc.y, { width: doc.page.width - 96, lineGap: 2 });
  doc.moveDown(0.4);
  doc.fillColor(P.C.suave).font('Helvetica').fontSize(9)
     .text(`${process.env.ORG_NOMBRE || 'Centro de Operaciones de Emergencia'} · ${P.fecha(b.publicado_en || b.creado_en)}`);
  doc.moveDown(1);

  P.parrafo(doc, b.cuerpo);

  if (b.incidente_codigo) {
    P.seccion(doc, 'Referencia del evento');
    P.ficha(doc, [
      ['Incidente', b.incidente_codigo, 'mono'],
      ['Denominación', b.incidente_titulo],
      ['Ubicación', b.direccion],
      ['Coordenadas', `${P.coord(b.lat)}, ${P.coord(b.lng)}`, 'mono']
    ]);
  }

  P.destacado(doc, 'Vocería autorizada',
    `${b.vocero || 'Oficial de Información Pública'} — ${process.env.ORG_NOMBRE || 'Centro de Operaciones de Emergencia'}. ` +
    'Este documento es la única fuente oficial sobre el evento. Cualquier ampliación se emitirá por este mismo canal.',
    P.COLOR_NIVEL[b.nivel]);

  await registrar(req, 'exportar_pdf', 'boletines_prensa', b.id, 'boletín');
  enviar(res, doc, `boletin-${b.id}.pdf`);
}

/* ============================================================
   4. Nómina de personal de emergencias
   ============================================================ */
async function informePersonal(req, res) {
  const [personal] = await pool.query(
    'SELECT * FROM personal_emergencia ORDER BY estado, apellidos, nombres');

  const doc = P.crearDocumento({
    titulo: 'Nómina de personal de emergencias',
    subtitulo: `${personal.length} registros · Corte al ${new Date().toLocaleDateString('es-PE')}`,
    nivel: 'verde'
  });

  P.indicadores(doc, [
    { rotulo: 'Total', valor: personal.length, color: P.C.acento },
    { rotulo: 'Activos', valor: personal.filter(p => p.estado === 'activo').length, color: P.C.verde },
    { rotulo: 'En descanso', valor: personal.filter(p => p.estado === 'descanso').length, color: P.C.amarillo },
    { rotulo: 'De baja', valor: personal.filter(p => p.estado === 'baja').length, color: P.C.rojo }
  ]);

  P.seccion(doc, 'Detalle de la nómina');
  P.tabla(doc, ['Código', 'Apellidos y nombres', 'Documento', 'Sangre', 'Especialidad', 'Nivel', 'Estado'],
    personal.map(p => [p.codigo, `${p.apellidos}, ${p.nombres}`, p.documento, p.tipo_sangre,
      p.especialidad, p.nivel_certificacion, p.estado]),
    { anchos: [52, 122, 66, 42, 106, 62, 49] });

  await registrar(req, 'exportar_pdf', 'personal_emergencia', null, 'nómina');
  enviar(res, doc, 'nomina-personal.pdf');
}

/* ============================================================
   5. Inventario de unidades operativas
   ============================================================ */
async function informeUnidades(req, res) {
  const [unidades] = await pool.query(
    `SELECT un.*, CONCAT(p.nombres,' ',p.apellidos) AS responsable
     FROM unidades_operativas un LEFT JOIN personal_emergencia p ON p.id=un.responsable_id
     ORDER BY un.estado, un.codigo`);

  const doc = P.crearDocumento({
    titulo: 'Inventario de unidades operativas',
    subtitulo: `${unidades.length} unidades registradas`,
    nivel: 'verde'
  });

  P.indicadores(doc, [
    { rotulo: 'Total', valor: unidades.length, color: P.C.acento },
    { rotulo: 'Disponibles', valor: unidades.filter(u => u.estado === 'disponible').length, color: P.C.verde },
    { rotulo: 'Desplegadas', valor: unidades.filter(u => ['en_ruta', 'en_escena'].includes(u.estado)).length, color: P.C.naranja },
    { rotulo: 'Fuera de servicio', valor: unidades.filter(u => ['mantenimiento', 'fuera_servicio'].includes(u.estado)).length, color: P.C.rojo }
  ]);

  P.seccion(doc, 'Detalle del inventario');
  P.tabla(doc, ['Código', 'Tipo', 'Placa', 'Base', 'Responsable', 'Cap.', 'Estado'],
    unidades.map(u => [u.codigo, u.tipo.replace(/_/g, ' '), u.placa, u.base, u.responsable, u.capacidad, u.estado.replace(/_/g, ' ')]),
    { anchos: [58, 88, 62, 92, 100, 34, 65] });

  await registrar(req, 'exportar_pdf', 'unidades_operativas', null, 'inventario');
  enviar(res, doc, 'inventario-unidades.pdf');
}

/* ============================================================
   6. Consolidado del periodo
   ============================================================ */
async function informeConsolidado(req, res) {
  const desde = req.query.desde || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const hasta = req.query.hasta || new Date().toISOString().slice(0, 10);

  const [incidentes] = await pool.query(
    `SELECT * FROM incidentes WHERE DATE(fecha_inicio) BETWEEN ? AND ?
     ORDER BY FIELD(nivel_alerta,'rojo','naranja','amarillo','verde'), fecha_inicio DESC`, [desde, hasta]);
  const [porTipo] = await pool.query(
    `SELECT tipo, COUNT(*) AS total, SUM(afectados) AS afectados FROM incidentes
     WHERE DATE(fecha_inicio) BETWEEN ? AND ? GROUP BY tipo ORDER BY total DESC`, [desde, hasta]);
  const [[wa]] = await pool.query(
    `SELECT COUNT(*) AS total FROM notificaciones_whatsapp WHERE DATE(enviado_en) BETWEEN ? AND ?`, [desde, hasta]);
  const [[bol]] = await pool.query(
    `SELECT COUNT(*) AS total FROM boletines_prensa WHERE DATE(creado_en) BETWEEN ? AND ? AND estado='publicado'`, [desde, hasta]);

  const nivelMax = incidentes.some(i => i.nivel_alerta === 'rojo') ? 'rojo'
    : incidentes.some(i => i.nivel_alerta === 'naranja') ? 'naranja'
    : incidentes.some(i => i.nivel_alerta === 'amarillo') ? 'amarillo' : 'verde';

  const doc = P.crearDocumento({
    titulo: 'Informe consolidado de operaciones',
    subtitulo: `Periodo del ${desde} al ${hasta}`,
    nivel: nivelMax
  });

  P.indicadores(doc, [
    { rotulo: 'Incidentes', valor: incidentes.length, color: P.C.acento },
    { rotulo: 'Nivel rojo', valor: incidentes.filter(i => i.nivel_alerta === 'rojo').length, color: P.C.rojo },
    { rotulo: 'Con SCI', valor: incidentes.filter(i => i.sci_activado).length, color: P.C.naranja },
    { rotulo: 'Afectados', valor: incidentes.reduce((a, i) => a + (i.afectados || 0), 0), color: P.C.amarillo }
  ]);

  P.seccion(doc, 'Distribución por tipo de evento');
  porTipo.length
    ? P.tabla(doc, ['Tipo de evento', 'Incidentes', 'Personas afectadas'],
        porTipo.map(t => [t.tipo.replace(/_/g, ' '), t.total, t.afectados || 0]),
        { anchos: [259, 120, 120] })
    : P.parrafo(doc, 'No se registraron eventos en el periodo seleccionado.');

  P.seccion(doc, 'Relación de incidentes del periodo');
  incidentes.length
    ? P.tabla(doc, ['Código', 'Denominación', 'Tipo', 'Nivel', 'Estado', 'Inicio'],
        incidentes.map(i => [i.codigo, i.titulo, i.tipo.replace(/_/g, ' '),
          i.nivel_alerta.toUpperCase(), i.estado, P.fecha(i.fecha_inicio)]),
        { anchos: [86, 132, 84, 52, 62, 83] })
    : P.parrafo(doc, 'Sin incidentes registrados.');

  P.seccion(doc, 'Actividad de notificación');
  P.ficha(doc, [
    ['Avisos por WhatsApp', wa.total],
    ['Boletines publicados a prensa', bol.total]
  ]);

  await registrar(req, 'exportar_pdf', 'consolidado', null, `${desde} a ${hasta}`);
  enviar(res, doc, `consolidado-${desde}-${hasta}.pdf`);
}

module.exports = {
  informeIncidente, informeSci, boletinPrensa,
  informePersonal, informeUnidades, informeConsolidado
};
