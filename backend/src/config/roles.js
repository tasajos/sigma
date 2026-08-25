// Catálogo de perfiles y permisos declarativos.
// Cada rol es independiente: no hay herencia entre perfiles.
const ROLES = {
  ADMIN:   'administrador',
  RESCATE: 'rescatista',
  OPS:     'operaciones',
  LOG:     'logistica',
  COM:     'comunicaciones'
};

const PERMISOS = {
  'usuarios.gestionar':   [ROLES.ADMIN],
  'bitacora.ver':         [ROLES.ADMIN],
  'personal.ver':         [ROLES.ADMIN, ROLES.LOG, ROLES.OPS],
  'personal.editar':      [ROLES.ADMIN, ROLES.LOG],
  'unidades.ver':         [ROLES.ADMIN, ROLES.LOG, ROLES.OPS],
  'unidades.editar':      [ROLES.ADMIN, ROLES.LOG],
  'incidentes.ver':       [ROLES.ADMIN, ROLES.OPS, ROLES.LOG, ROLES.COM, ROLES.RESCATE],
  'incidentes.editar':    [ROLES.ADMIN, ROLES.OPS],
  'sci.gestionar':        [ROLES.ADMIN, ROLES.OPS],
  'ubicacion.enviar':     [ROLES.RESCATE, ROLES.ADMIN, ROLES.OPS],
  'ubicacion.monitorear': [ROLES.ADMIN, ROLES.OPS, ROLES.LOG, ROLES.COM],
  'alertas.emitir':       [ROLES.ADMIN, ROLES.COM, ROLES.OPS],
  'prensa.gestionar':     [ROLES.ADMIN, ROLES.COM],
  'whatsapp.enviar':      [ROLES.ADMIN, ROLES.COM, ROLES.OPS],
  'reportes.generar':     [ROLES.ADMIN, ROLES.OPS, ROLES.LOG, ROLES.COM]
};

module.exports = { ROLES, PERMISOS };
