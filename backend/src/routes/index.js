const router = require('express').Router();
const ah = require('../utils/asyncHandler');
const { autenticar, requierePermiso, permitirRoles } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

const auth      = require('../controllers/auth.controller');
const usuarios  = require('../controllers/usuarios.controller');
const personal  = require('../controllers/personal.controller');
const unidades  = require('../controllers/unidades.controller');
const tiposUnidad = require('../controllers/tiposUnidad.controller');
const incident  = require('../controllers/incidentes.controller');
const sci       = require('../controllers/sci.controller');
const ubic      = require('../controllers/ubicaciones.controller');
const alertas   = require('../controllers/alertas.controller');
const prensa    = require('../controllers/prensa.controller');
const whatsapp  = require('../controllers/whatsapp.controller');
const reportes  = require('../controllers/reportes.controller');

/* ---------------- Autenticación (público) ---------------- */
router.post('/auth/login',    ah(auth.login));
router.post('/auth/registro', ah(auth.registroRescatista));
router.get ('/auth/perfil',   autenticar, ah(auth.perfil));
router.put ('/auth/password', autenticar, ah(auth.cambiarPassword));

/* ---------------- Usuarios y roles (administrador) ---------------- */
router.get   ('/roles',                autenticar, ah(usuarios.listarRoles));
router.get   ('/usuarios',             autenticar, requierePermiso('usuarios.gestionar'), ah(usuarios.listar));
router.post  ('/usuarios',             autenticar, requierePermiso('usuarios.gestionar'), ah(usuarios.crear));
router.put   ('/usuarios/:id',         autenticar, requierePermiso('usuarios.gestionar'), ah(usuarios.actualizar));
router.patch ('/usuarios/:id/estado',  autenticar, requierePermiso('usuarios.gestionar'), ah(usuarios.cambiarEstado));
router.patch ('/usuarios/:id/password',autenticar, requierePermiso('usuarios.gestionar'), ah(usuarios.reiniciarPassword));
router.delete('/usuarios/:id',         autenticar, requierePermiso('usuarios.gestionar'), ah(usuarios.eliminar));
router.get   ('/bitacora',             autenticar, requierePermiso('bitacora.ver'), ah(usuarios.bitacora));

/* ---------------- Personal de emergencias ---------------- */
router.get   ('/personal',     autenticar, requierePermiso('personal.ver'),    ah(personal.listar));
router.get   ('/personal/:id', autenticar, requierePermiso('personal.ver'),    ah(personal.obtener));
router.post  ('/personal',     autenticar, requierePermiso('personal.editar'), ah(personal.crear));
router.put   ('/personal/:id', autenticar, requierePermiso('personal.editar'), ah(personal.actualizar));
router.delete('/personal/:id', autenticar, requierePermiso('personal.editar'), ah(personal.eliminar));

/* ---------------- Unidades operativas ---------------- */
router.get   ('/unidades',                 autenticar, requierePermiso('unidades.ver'),    ah(unidades.listar));
router.get   ('/unidades/siguiente-codigo', autenticar, requierePermiso('unidades.editar'), ah(unidades.siguienteCodigo));
router.post  ('/unidades',                 autenticar, requierePermiso('unidades.editar'), ah(unidades.crear));
router.put   ('/unidades/:id',             autenticar, requierePermiso('unidades.editar'), ah(unidades.actualizar));
router.delete('/unidades/:id',             autenticar, requierePermiso('unidades.editar'), ah(unidades.eliminar));

/* ---------------- Categorías de unidad (catálogo editable) ---------------- */
router.get ('/tipos-unidad', autenticar, ah(tiposUnidad.listar));
router.post('/tipos-unidad', autenticar, requierePermiso('unidades.editar'), ah(tiposUnidad.crear));

/* ---------------- Incidentes ---------------- */
router.get   ('/incidentes',           autenticar, requierePermiso('incidentes.ver'),    ah(incident.listar));
router.get   ('/incidentes/:id',       autenticar, requierePermiso('incidentes.ver'),    ah(incident.obtener));
router.post  ('/incidentes',           autenticar, requierePermiso('incidentes.editar'), ah(incident.crear));
router.put   ('/incidentes/:id',       autenticar, requierePermiso('incidentes.editar'), ah(incident.actualizar));
router.patch ('/incidentes/:id/nivel', autenticar, requierePermiso('alertas.emitir'),    ah(incident.cambiarNivel));
router.post  ('/incidentes/:id/unidades', autenticar, requierePermiso('incidentes.editar'), ah(incident.asignarUnidad));
router.delete('/incidentes/:id/unidades/:asignacionId', autenticar, requierePermiso('incidentes.editar'), ah(incident.liberarUnidad));
router.delete('/incidentes/:id',       autenticar, permitirRoles(ROLES.ADMIN),           ah(incident.eliminar));

/* ---------------- SCI ---------------- */
router.get   ('/sci/puestos',                     autenticar, ah(sci.puestos));
router.get   ('/sci/:incidenteId',                autenticar, requierePermiso('incidentes.ver'), ah(sci.estructura));
router.post  ('/sci/:incidenteId/activar',        autenticar, requierePermiso('sci.gestionar'),  ah(sci.activar));
router.post  ('/sci/:incidenteId/desactivar',     autenticar, requierePermiso('sci.gestionar'),  ah(sci.desactivar));
router.put   ('/sci/:incidenteId/puesto',         autenticar, requierePermiso('sci.gestionar'),  ah(sci.asignarPuesto));
router.delete('/sci/:incidenteId/puesto/:puesto', autenticar, requierePermiso('sci.gestionar'),  ah(sci.liberarPuesto));
router.post  ('/sci/:incidenteId/objetivos',      autenticar, requierePermiso('sci.gestionar'),  ah(sci.crearObjetivo));
router.patch ('/sci/:incidenteId/objetivos/:objetivoId', autenticar, requierePermiso('sci.gestionar'), ah(sci.alternarObjetivo));
router.delete('/sci/:incidenteId/objetivos/:objetivoId', autenticar, requierePermiso('sci.gestionar'), ah(sci.eliminarObjetivo));

/* ---------------- Ubicaciones en campo ---------------- */
router.post('/ubicaciones',                    autenticar, requierePermiso('ubicacion.enviar'),     ah(ubic.reportar));
router.get ('/ubicaciones/actuales',           autenticar, requierePermiso('ubicacion.monitorear'), ah(ubic.actuales));
router.get ('/ubicaciones/mias',               autenticar, ah(ubic.mias));
router.get ('/ubicaciones/historial/:usuarioId', autenticar, requierePermiso('ubicacion.monitorear'), ah(ubic.historial));

/* ---------------- Alertas ---------------- */
router.get  ('/alertas',            autenticar, ah(alertas.listar));
router.get  ('/alertas/niveles',    autenticar, ah(alertas.catalogoNiveles));
router.get  ('/alertas/resumen',    autenticar, ah(alertas.resumen));
router.post ('/alertas',            autenticar, requierePermiso('alertas.emitir'), ah(alertas.emitirAlerta));
router.patch('/alertas/:id/leida',  autenticar, ah(alertas.marcarLeida));

/* ---------------- Prensa ---------------- */
router.get   ('/prensa',              autenticar, ah(prensa.listar));
router.get   ('/prensa/:id',          autenticar, ah(prensa.obtener));
router.post  ('/prensa',              autenticar, requierePermiso('prensa.gestionar'), ah(prensa.crear));
router.put   ('/prensa/:id',          autenticar, requierePermiso('prensa.gestionar'), ah(prensa.actualizar));
router.post  ('/prensa/:id/publicar', autenticar, requierePermiso('prensa.gestionar'), ah(prensa.publicar));
router.delete('/prensa/:id',          autenticar, requierePermiso('prensa.gestionar'), ah(prensa.eliminar));

/* ---------------- WhatsApp ---------------- */
router.post('/whatsapp/coordenadas', autenticar, requierePermiso('whatsapp.enviar'), ah(whatsapp.enviarCoordenadas));
router.post('/whatsapp/difusion',    autenticar, requierePermiso('whatsapp.enviar'), ah(whatsapp.difusion));
router.get ('/whatsapp/historial',   autenticar, requierePermiso('whatsapp.enviar'), ah(whatsapp.historial));

/* ---------------- Reportes PDF ---------------- */
router.get('/reportes/incidente/:id', autenticar, requierePermiso('reportes.generar'), ah(reportes.informeIncidente));
router.get('/reportes/sci/:id',       autenticar, requierePermiso('reportes.generar'), ah(reportes.informeSci));
router.get('/reportes/prensa/:id',    autenticar, requierePermiso('reportes.generar'), ah(reportes.boletinPrensa));
router.get('/reportes/personal',      autenticar, requierePermiso('reportes.generar'), ah(reportes.informePersonal));
router.get('/reportes/unidades',      autenticar, requierePermiso('reportes.generar'), ah(reportes.informeUnidades));
router.get('/reportes/consolidado',   autenticar, requierePermiso('reportes.generar'), ah(reportes.informeConsolidado));

module.exports = router;
