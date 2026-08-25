import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { conectarSocket, desconectarSocket } from '../api/socket';

const AuthContext = createContext(null);

/** Permisos por perfil — refleja config/roles.js del backend */
export const PERMISOS = {
  'usuarios.gestionar':   ['administrador'],
  'bitacora.ver':         ['administrador'],
  'personal.ver':         ['administrador', 'logistica', 'operaciones'],
  'personal.editar':      ['administrador', 'logistica'],
  'unidades.ver':         ['administrador', 'logistica', 'operaciones'],
  'unidades.editar':      ['administrador', 'logistica'],
  'incidentes.ver':       ['administrador', 'operaciones', 'logistica', 'comunicaciones', 'rescatista'],
  'incidentes.editar':    ['administrador', 'operaciones'],
  'sci.gestionar':        ['administrador', 'operaciones'],
  'ubicacion.enviar':     ['rescatista', 'administrador', 'operaciones'],
  'ubicacion.monitorear': ['administrador', 'operaciones', 'logistica', 'comunicaciones'],
  'alertas.emitir':       ['administrador', 'comunicaciones', 'operaciones'],
  'prensa.gestionar':     ['administrador', 'comunicaciones'],
  'whatsapp.enviar':      ['administrador', 'comunicaciones', 'operaciones'],
  'reportes.generar':     ['administrador', 'operaciones', 'logistica', 'comunicaciones']
};

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem('sigma_usuario');
    return guardado ? JSON.parse(guardado) : null;
  });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('sigma_token');
    if (t) conectarSocket(t);
    setCargando(false);
    return () => desconectarSocket();
  }, []);

  const entrar = useCallback(async (email, password) => {
    const datos = await api.post('/auth/login', { email, password });
    localStorage.setItem('sigma_token', datos.token);
    localStorage.setItem('sigma_usuario', JSON.stringify(datos.usuario));
    setUsuario(datos.usuario);
    conectarSocket(datos.token);
    return datos.usuario;
  }, []);

  const salir = useCallback(() => {
    localStorage.removeItem('sigma_token');
    localStorage.removeItem('sigma_usuario');
    desconectarSocket();
    setUsuario(null);
  }, []);

  const puede = useCallback(
    (permiso) => !!usuario && (PERMISOS[permiso] || []).includes(usuario.rol),
    [usuario]
  );

  return (
    <AuthContext.Provider value={{ usuario, cargando, entrar, salir, puede }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
