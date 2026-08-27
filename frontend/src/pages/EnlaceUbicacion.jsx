import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import MapaOperativo from '../components/MapaOperativo';

// Mismos umbrales que la transmisión en vivo del personal registrado:
// se envía apenas hay movimiento real, sin saturar al servidor si está quieto.
const MIN_INTERVALO_MS = 8000;
const DISTANCIA_MIN_M = 15;

function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

const ORG_NOMBRE = import.meta.env.VITE_ORG_NOMBRE || 'Centro de monitoreo';

export default function EnlaceUbicacion() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [estado, setEstado] = useState('cargando'); // cargando | pendiente | activo | rechazado | finalizado | error
  const [error, setError] = useState('');
  const [posicion, setPosicion] = useState(null);
  const observador = useRef(null);
  const ultimoEnvio = useRef({ ts: 0, lat: null, lng: null });

  useEffect(() => {
    api.get(`/enlaces/publico/${token}`)
      .then((datos) => {
        setInfo(datos);
        setEstado(datos.estado === 'activo' ? 'activo' : datos.estado === 'rechazado' ? 'rechazado'
          : datos.estado === 'finalizado' ? 'finalizado' : 'pendiente');
      })
      .catch((e) => { setError(e.message); setEstado('error'); });

    return () => {
      if (observador.current != null) navigator.geolocation.clearWatch(observador.current);
    };
  }, [token]);

  const enviarUbicacion = async (p) => {
    try {
      await api.post(`/enlaces/publico/${token}/ubicacion`, { lat: p.lat, lng: p.lng, precision_m: p.precision_m });
    } catch (e) { setError(e.message); }
  };

  const manejarPosicionEnVivo = (p) => {
    const punto = { lat: p.coords.latitude, lng: p.coords.longitude, precision_m: p.coords.accuracy };
    setPosicion(punto);

    const ahora = Date.now();
    const { ts, lat, lng } = ultimoEnvio.current;
    const movioSuficiente = lat == null || distanciaMetros(lat, lng, punto.lat, punto.lng) >= DISTANCIA_MIN_M;
    if (!movioSuficiente && ahora - ts < MIN_INTERVALO_MS) return;

    ultimoEnvio.current = { ts: ahora, lat: punto.lat, lng: punto.lng };
    enviarUbicacion(punto);
  };

  const iniciarTransmision = () => {
    if (!navigator.geolocation) {
      setError('Este dispositivo no permite obtener la ubicación.');
      return;
    }
    ultimoEnvio.current = { ts: 0, lat: null, lng: null };
    observador.current = navigator.geolocation.watchPosition(
      manejarPosicionEnVivo,
      (e) => setError(
        e.code === 1
          ? 'Permiso de ubicación denegado. Habilítalo en los ajustes del navegador.'
          : 'No se pudo obtener la ubicación. Verifica el GPS y vuelve a intentarlo.'
      ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  const autorizar = async () => {
    setError('');
    try {
      await api.post(`/enlaces/publico/${token}/autorizar`);
      setEstado('activo');
      iniciarTransmision();
    } catch (e) { setError(e.message); }
  };

  const rechazar = async () => {
    setError('');
    try {
      await api.post(`/enlaces/publico/${token}/rechazar`);
      setEstado('rechazado');
    } catch (e) { setError(e.message); }
  };

  const detener = async () => {
    if (observador.current != null) { navigator.geolocation.clearWatch(observador.current); observador.current = null; }
    try { await api.post(`/enlaces/publico/${token}/finalizar`); } catch { /* ya se cierra localmente */ }
    setEstado('finalizado');
  };

  if (estado === 'cargando') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Cargando…</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16
    }}>
      <div className="panel" style={{ maxWidth: 440, width: '100%' }}>
        <div className="panel-cabecera"><h3>{ORG_NOMBRE}</h3></div>

        {error && <div className="aviso aviso-error">{error}</div>}

        {estado === 'error' && (
          <p>No se pudo abrir este enlace. Puede que haya vencido o que ya no exista; pide uno nuevo al centro de monitoreo.</p>
        )}

        {estado === 'pendiente' && (
          <>
            <p>
              <b>{info?.solicitante}</b> te solicita compartir tu ubicación en tiempo real
              {info?.incidente ? ` para el incidente ${info.incidente.codigo} · ${info.incidente.titulo}` : ''}.
            </p>
            <p style={{ fontSize: 13, color: 'var(--texto-tenue)' }}>
              Tu posición solo se transmite mientras esta página quede abierta y tú lo autorices.
              Puedes dejar de compartir en cualquier momento.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn btn-primario btn-bloque" onClick={autorizar}>
                Autorizar y compartir mi ubicación
              </button>
              <button className="btn btn-bloque" onClick={rechazar}>Rechazar</button>
            </div>
          </>
        )}

        {estado === 'activo' && (
          <>
            <div className="aviso aviso-ok">Estás transmitiendo tu ubicación en tiempo real.</div>
            {posicion && (
              <div className="coord" style={{ marginTop: 6 }}>
                {posicion.lat.toFixed(6)}, {posicion.lng.toFixed(6)}
              </div>
            )}
            <button className="btn btn-peligro btn-bloque" style={{ marginTop: 14 }} onClick={detener}>
              Dejar de compartir
            </button>
          </>
        )}

        {estado === 'rechazado' && <p>Rechazaste la solicitud. No se compartió tu ubicación.</p>}
        {estado === 'finalizado' && <p>Dejaste de compartir tu ubicación. Puedes cerrar esta página.</p>}
      </div>

      {estado === 'activo' && posicion && (
        <div className="panel" style={{ maxWidth: 440, width: '100%', padding: 0, overflow: 'hidden', height: 280 }}>
          <MapaOperativo centro={[posicion.lat, posicion.lng]} zoom={16} puntoSeleccionado={posicion} mostrarLeyenda={false} />
        </div>
      )}
    </div>
  );
}
