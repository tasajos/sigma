const jwt = require('jsonwebtoken');
const { PERMISOS } = require('../config/roles');

/** Verifica el token JWT y adjunta req.usuario */
function autenticar(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  }
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'La sesión expiró. Vuelve a iniciar sesión.' });
  }
}

/** Restringe el acceso a una lista explícita de roles */
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a esta operación.' });
    }
    next();
  };
}

/** Restringe por permiso declarado en config/roles.js */
function requierePermiso(permiso) {
  return (req, res, next) => {
    const permitidos = PERMISOS[permiso] || [];
    if (!req.usuario || !permitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Tu perfil no tiene acceso a esta operación.' });
    }
    next();
  };
}

module.exports = { autenticar, permitirRoles, requierePermiso };
