import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import Layout from './components/Layout';

import Login from './pages/Login';
import Registro from './pages/Registro';
import EnlaceUbicacion from './pages/EnlaceUbicacion';
import Tablero from './pages/Tablero';
import Mapa from './pages/Mapa';
import Campo from './pages/Campo';
import Incidentes from './pages/Incidentes';
import IncidenteDetalle from './pages/IncidenteDetalle';
import Personal from './pages/Personal';
import Unidades from './pages/Unidades';
import Alertas from './pages/Alertas';
import Prensa from './pages/Prensa';
import Whatsapp from './pages/Whatsapp';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';
import Bitacora from './pages/Bitacora';

/** Si ya hay sesión, el acceso redirige al tablero correspondiente */
function SoloInvitados({ children }) {
  const { usuario } = useAuth();
  if (usuario) return <Navigate to={usuario.rol === 'rescatista' ? '/campo' : '/'} replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/acceso"   element={<SoloInvitados><Login /></SoloInvitados>} />
          <Route path="/registro" element={<SoloInvitados><Registro /></SoloInvitados>} />
          <Route path="/u/:token" element={<EnlaceUbicacion />} />

          <Route element={<RutaProtegida><Layout /></RutaProtegida>}>
            <Route index element={<Tablero />} />
            <Route path="mapa"  element={<RutaProtegida permiso="ubicacion.monitorear"><Mapa /></RutaProtegida>} />
            <Route path="campo" element={<RutaProtegida permiso="ubicacion.enviar"><Campo /></RutaProtegida>} />
            <Route path="incidentes"     element={<RutaProtegida permiso="incidentes.ver"><Incidentes /></RutaProtegida>} />
            <Route path="incidentes/:id" element={<RutaProtegida permiso="incidentes.ver"><IncidenteDetalle /></RutaProtegida>} />
            <Route path="personal" element={<RutaProtegida permiso="personal.ver"><Personal /></RutaProtegida>} />
            <Route path="unidades" element={<RutaProtegida permiso="unidades.ver"><Unidades /></RutaProtegida>} />
            <Route path="alertas"  element={<Alertas />} />
            <Route path="prensa"   element={<RutaProtegida permiso="prensa.gestionar"><Prensa /></RutaProtegida>} />
            <Route path="whatsapp" element={<RutaProtegida permiso="whatsapp.enviar"><Whatsapp /></RutaProtegida>} />
            <Route path="reportes" element={<RutaProtegida permiso="reportes.generar"><Reportes /></RutaProtegida>} />
            <Route path="usuarios" element={<RutaProtegida permiso="usuarios.gestionar"><Usuarios /></RutaProtegida>} />
            <Route path="bitacora" element={<RutaProtegida permiso="bitacora.ver"><Bitacora /></RutaProtegida>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
