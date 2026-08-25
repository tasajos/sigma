import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { obtenerSocket } from '../api/socket';
import { api } from '../api/client';

const SECCIONES = [
  { grupo: 'Monitoreo' },
  { a: '/',            i: '◎', t: 'Tablero' },
  { a: '/mapa',        i: '◈', t: 'Mapa operativo', permiso: 'ubicacion.monitorear' },
  { a: '/campo',       i: '➤', t: 'Enviar mi posición', permiso: 'ubicacion.enviar' },

  { grupo: 'Respuesta' },
  { a: '/incidentes',  i: '▲', t: 'Incidentes', permiso: 'incidentes.ver' },
  { a: '/alertas',     i: '◉', t: 'Alertas' },

  { grupo: 'Recursos' },
  { a: '/personal',    i: '☰', t: 'Personal', permiso: 'personal.ver' },
  { a: '/unidades',    i: '▤', t: 'Unidades operativas', permiso: 'unidades.ver' },

  { grupo: 'Difusión' },
  { a: '/prensa',      i: '❖', t: 'Boletines de prensa', permiso: 'prensa.gestionar' },
  { a: '/whatsapp',    i: '✆', t: 'Avisos por WhatsApp', permiso: 'whatsapp.enviar' },
  { a: '/reportes',    i: '⎙', t: 'Reportes PDF', permiso: 'reportes.generar' },

  { grupo: 'Administración' },
  { a: '/usuarios',    i: '⚙', t: 'Usuarios y perfiles', permiso: 'usuarios.gestionar' },
  { a: '/bitacora',    i: '❐', t: 'Bitácora', permiso: 'bitacora.ver' }
];

const TITULOS = {
  '/': ['Tablero de situación', 'Estado consolidado de la operación'],
  '/mapa': ['Mapa operativo', 'Posiciones reportadas desde campo en tiempo real'],
  '/campo': ['Envío de posición', 'Transmite tu ubicación al centro de monitoreo'],
  '/incidentes': ['Incidentes', 'Registro y seguimiento de eventos adversos'],
  '/alertas': ['Alertas y notificaciones', 'Historial y emisión de avisos'],
  '/personal': ['Personal de emergencias', 'Registro del recurso humano acreditado'],
  '/unidades': ['Unidades operativas', 'Inventario de vehículos y equipos'],
  '/prensa': ['Boletines de prensa', 'Comunicados oficiales del evento'],
  '/whatsapp': ['Avisos por WhatsApp', 'Envío de coordenadas y difusión'],
  '/reportes': ['Reportes', 'Generación y exportación en PDF'],
  '/usuarios': ['Usuarios y perfiles', 'Altas, permisos y estado de las cuentas'],
  '/bitacora': ['Bitácora del sistema', 'Trazabilidad de acciones']
};

export default function Layout() {
  const { usuario, salir, puede } = useAuth();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  const [abierto, setAbierto] = useState(false);
  const [nivel, setNivel] = useState('verde');
  const [enLinea, setEnLinea] = useState(false);
  const [hora, setHora] = useState(new Date());

  useEffect(() => { setAbierto(false); }, [pathname]);

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let vivo = true;
    const cargarNivel = () => api.get('/alertas/resumen')
      .then(r => vivo && setNivel(r.nivelGlobal))
      .catch(() => {});
    cargarNivel();

    const s = obtenerSocket();
    if (s) {
      const marcar = () => setEnLinea(s.connected);
      s.on('connect', marcar); s.on('disconnect', marcar); marcar();
      s.on('alerta:nivel', cargarNivel);
      s.on('incidente:nuevo', cargarNivel);
      s.on('alerta:nueva', cargarNivel);
      return () => {
        vivo = false;
        s.off('connect', marcar); s.off('disconnect', marcar);
        s.off('alerta:nivel', cargarNivel); s.off('incidente:nuevo', cargarNivel);
        s.off('alerta:nueva', cargarNivel);
      };
    }
    return () => { vivo = false; };
  }, []);

  const [titulo, subtitulo] = TITULOS[pathname] || ['SIGMA-SCI', ''];
  const visibles = SECCIONES.filter(s => s.grupo || !s.permiso || puede(s.permiso));

  const cerrarSesion = () => { salir(); navegar('/acceso'); };

  return (
    <div className="app">
      {/* Franja de nivel de alerta: presente en toda la sesión */}
      <div className={`franja-nivel nivel-${nivel}`} title={`Nivel de alerta global: ${nivel}`} />

      <div className="app-cuerpo">
        {abierto && <div className="velo-lateral" onClick={() => setAbierto(false)} />}

        <aside className={`lateral ${abierto ? 'abierto' : ''}`}>
          <div className="marca">
            <div className="marca-nombre">SIGMA<span>·SCI</span></div>
            <div className="marca-sub">Monitoreo de eventos adversos</div>
          </div>

          <nav className="nav">
            {visibles.map((s, i) =>
              s.grupo
                ? <div className="nav-grupo rotulo" key={`g${i}`}>{s.grupo}</div>
                : <NavLink key={s.a} to={s.a} end={s.a === '/'}
                    className={({ isActive }) => isActive ? 'activo' : ''}>
                    <span className="nav-icono" aria-hidden="true">{s.i}</span>{s.t}
                  </NavLink>
            )}
          </nav>

          <div className="usuario-tarjeta">
            <div className="usuario-nombre">{usuario?.nombres} {usuario?.apellidos}</div>
            <div className="usuario-rol">{usuario?.rol}</div>
            <button className="btn btn-menudo btn-bloque" style={{ marginTop: 10 }} onClick={cerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="contenido">
          <header className="barra-superior">
            <button className="menu-boton" onClick={() => setAbierto(v => !v)} aria-label="Abrir menú">☰</button>
            <div className="barra-titulo">
              <h2>{titulo}</h2>
              <p>{subtitulo}</p>
            </div>
            <div className="conexion">
              <span className={`punto ${enLinea ? 'viva' : ''}`} />
              {enLinea ? 'Enlace activo' : 'Sin enlace'}
            </div>
            <div className="reloj">{hora.toLocaleTimeString('es-PE')}</div>
          </header>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
