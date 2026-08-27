import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { obtenerSocket } from '../api/socket';
import MapaOperativo from '../components/MapaOperativo';

const ESTADOS = [
  { v: 'disponible',    t: 'Disponible' },
  { v: 'en_movimiento', t: 'En movimiento' },
  { v: 'en_escena',     t: 'En escena' },
  { v: 'emergencia',    t: 'Emergencia' }
];

// Umbrales para no saturar al servidor: se transmite apenas se detecta
// movimiento real, o como máximo cada MIN_INTERVALO_MS si el actor sigue quieto.
const MIN_INTERVALO_MS = 8000;
const DISTANCIA_MIN_M = 15;

function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export default function Campo() {
  const { usuario } = useAuth();
  const [posicion, setPosicion] = useState(null);
  const [estado, setEstado] = useState('disponible');
  const [nota, setNota] = useState('');
  const [incidenteId, setIncidenteId] = useState('');
  const [incidentes, setIncidentes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState('');
  const [automatico, setAutomatico] = useState(false);
  const [solicitud, setSolicitud] = useState(null);
  const observador = useRef(null);
  const ultimoEnvio = useRef({ ts: 0, lat: null, lng: null });

  // El watchPosition se registra una sola vez; estas refs le permiten leer
  // siempre el estado/nota/incidente vigentes sin tener que reiniciarlo.
  const estadoRef = useRef(estado);
  const notaRef = useRef(nota);
  const incidenteIdRef = useRef(incidenteId);
  useEffect(() => { estadoRef.current = estado; }, [estado]);
  useEffect(() => { notaRef.current = nota; }, [nota]);
  useEffect(() => { incidenteIdRef.current = incidenteId; }, [incidenteId]);

  useEffect(() => {
    api.get('/incidentes?estado=activo').then(setIncidentes).catch(() => {});
    api.get('/ubicaciones/mias').then(datos => fusionarHistorial(datos)).catch(() => {});
    return () => {
      if (observador.current != null) navigator.geolocation.clearWatch(observador.current);
    };
  }, []);

  useEffect(() => {
    const s = obtenerSocket();
    if (!s) return;
    const alSolicitar = (data) => setSolicitud(data);
    s.on('ubicacion:solicitud', alSolicitar);
    return () => s.off('ubicacion:solicitud', alSolicitar);
  }, []);

  const fusionarHistorial = (nuevos) => {
    setHistorial(h => {
      const combinado = [...h];
      for (const n of Array.isArray(nuevos) ? nuevos : [nuevos]) {
        if (!combinado.some(x => String(x.id) === String(n.id))) combinado.push(n);
      }
      return combinado
        .sort((a, b) => new Date(b.reportado_en) - new Date(a.reportado_en))
        .slice(0, 50);
    });
  };

  const leerPosicion = () =>
    new Promise((resolver, rechazar) => {
      if (!navigator.geolocation) {
        return rechazar(new Error('Este dispositivo no permite obtener la ubicación.'));
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolver({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          precision_m: p.coords.accuracy,
          altitud_m: p.coords.altitude
        }),
        (e) => rechazar(new Error(
          e.code === 1
            ? 'Permiso de ubicación denegado. Habilítalo en los ajustes del navegador.'
            : 'No se pudo obtener la ubicación. Verifica el GPS y vuelve a intentarlo.'
        )),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });

  const localizar = async () => {
    setError('');
    try {
      const p = await leerPosicion();
      setPosicion(p);
    } catch (e) { setError(e.message); }
  };

  const enviarPosicion = async (p) => {
    setError('');
    try {
      const bateria = navigator.getBattery
        ? Math.round((await navigator.getBattery()).level * 100)
        : null;

      const r = await api.post('/ubicaciones', {
        ...p, estado: estadoRef.current, nota: notaRef.current || null,
        incidente_id: incidenteIdRef.current || null, bateria
      });
      setMensaje(r.mensaje);
      fusionarHistorial(r.ubicacion);
      setTimeout(() => setMensaje(null), 4000);
    } catch (e) { setError(e.message); }
  };

  const transmitir = async () => {
    setMensaje(null);
    try {
      const p = posicion || await leerPosicion();
      setPosicion(p);
      await enviarPosicion(p);
    } catch (e) { setError(e.message); }
  };

  /** Se dispara con cada actualización del GPS mientras el envío en vivo está activo */
  const manejarPosicionEnVivo = (p) => {
    const punto = {
      lat: p.coords.latitude, lng: p.coords.longitude,
      precision_m: p.coords.accuracy, altitud_m: p.coords.altitude
    };
    setPosicion(punto);

    const ahora = Date.now();
    const { ts, lat, lng } = ultimoEnvio.current;
    const movioSuficiente = lat == null || distanciaMetros(lat, lng, punto.lat, punto.lng) >= DISTANCIA_MIN_M;
    if (!movioSuficiente && ahora - ts < MIN_INTERVALO_MS) return;

    ultimoEnvio.current = { ts: ahora, lat: punto.lat, lng: punto.lng };
    enviarPosicion(punto);
  };

  const alternarAutomatico = () => {
    if (automatico) {
      if (observador.current != null) navigator.geolocation.clearWatch(observador.current);
      observador.current = null;
      setAutomatico(false);
      return;
    }
    if (!navigator.geolocation) {
      setError('Este dispositivo no permite obtener la ubicación.');
      return;
    }
    setError('');
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
    setAutomatico(true);
  };

  const responderSolicitud = (aceptada) => {
    const s = obtenerSocket();
    if (s && solicitud) {
      s.emit('ubicacion:solicitud:respuesta', { solicitanteId: solicitud.solicitanteId, aceptada });
    }
    if (aceptada && !automatico) alternarAutomatico();
    setSolicitud(null);
  };

  return (
    <div className="vista">
      <div className="rejilla rejilla-2" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-cabecera"><h3>Transmitir posición</h3></div>

            {solicitud && (
              <div className="aviso aviso-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span><b>{solicitud.solicitanteNombre}</b> solicitó tu ubicación en tiempo real desde el centro de monitoreo.</span>
                <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-primario btn-menudo" onClick={() => responderSolicitud(true)}>Aceptar</button>
                  <button className="btn btn-menudo" onClick={() => responderSolicitud(false)}>Rechazar</button>
                </span>
              </div>
            )}

            {error && <div className="aviso aviso-error">{error}</div>}
            {mensaje && <div className="aviso aviso-ok">{mensaje}</div>}

            <div className="panel" style={{ background: 'var(--tinta)', marginBottom: 16 }}>
              <div className="rotulo">Coordenadas del dispositivo</div>
              {posicion ? (
                <>
                  <div className="coord" style={{ fontSize: 18, marginTop: 6 }}>
                    {posicion.lat.toFixed(6)}, {posicion.lng.toFixed(6)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--texto-tenue)', marginTop: 4 }}>
                    Precisión aproximada: ±{Math.round(posicion.precision_m || 0)} m
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--texto-tenue)', marginTop: 6, fontSize: 13 }}>
                  Aún no se ha leído la ubicación del dispositivo.
                </div>
              )}
              <button className="btn btn-menudo" style={{ marginTop: 12 }} onClick={localizar}>
                Leer mi ubicación
              </button>
            </div>

            <div className="campo">
              <label htmlFor="estado">Mi estado operativo</label>
              <select id="estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
                {ESTADOS.map(s => <option key={s.v} value={s.v}>{s.t}</option>)}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="incidente">Incidente al que respondo</label>
              <select id="incidente" value={incidenteId} onChange={(e) => setIncidenteId(e.target.value)}>
                <option value="">Sin asignar</option>
                {incidentes.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.titulo}</option>)}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="nota">Nota para el centro de monitoreo</label>
              <input id="nota" value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)}
                placeholder="Acceso bloqueado por escombros" />
            </div>

            <button className="btn btn-primario btn-bloque" onClick={transmitir}>
              Enviar posición ahora
            </button>

            <button
              className={`btn btn-bloque ${automatico ? 'btn-peligro' : ''}`}
              style={{ marginTop: 10 }}
              onClick={alternarAutomatico}
            >
              {automatico ? 'Detener transmisión en tiempo real' : 'Transmitir en tiempo real'}
            </button>
            {automatico && (
              <div style={{ fontSize: 12, color: 'var(--texto-tenue)', marginTop: 8 }}>
                Tu posición se actualiza en el mapa apenas te mueves.
              </div>
            )}

            {estado === 'emergencia' && (
              <div className="aviso aviso-error" style={{ marginTop: 14, marginBottom: 0 }}>
                Al enviar con estado <b>emergencia</b>, tu posición se destaca en el tablero del
                centro de monitoreo y se notifica de inmediato al turno de operaciones.
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-cabecera"><h3>Mis últimos envíos</h3></div>
            {historial.length === 0
              ? <div className="vacio">Todavía no has transmitido tu posición.</div>
              : <div className="tabla-marco">
                  <table>
                    <thead><tr><th>Hora</th><th>Coordenadas</th><th>Estado</th></tr></thead>
                    <tbody>
                      {historial.slice(0, 12).map((h, i) => (
                        <tr key={h.id || i}>
                          <td className="dato">{new Date(h.reportado_en).toLocaleTimeString('es-PE')}</td>
                          <td className="coord">{Number(h.lat).toFixed(5)}, {Number(h.lng).toFixed(5)}</td>
                          <td style={{ textTransform: 'capitalize' }}>{String(h.estado).replace(/_/g, ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
          </div>
        </div>

        <div className="panel" style={{ padding: 0, overflow: 'hidden', minHeight: 460 }}>
          <div style={{ height: '100%', minHeight: 460 }}>
            <MapaOperativo
              centro={
                posicion ? [posicion.lat, posicion.lng]
                  : historial[0] ? [Number(historial[0].lat), Number(historial[0].lng)]
                  : undefined
              }
              zoom={posicion ? 16 : 12}
              incidentes={incidentes}
              posiciones={historial.map(h => ({
                ...h,
                usuario_id: usuario?.id,
                nombres: usuario?.nombres,
                apellidos: usuario?.apellidos,
                rol: usuario?.rol
              }))}
              puntoSeleccionado={posicion}
              mostrarLeyenda={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
