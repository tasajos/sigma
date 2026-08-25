import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import MapaOperativo from '../components/MapaOperativo';

const ESTADOS = [
  { v: 'disponible',    t: 'Disponible' },
  { v: 'en_movimiento', t: 'En movimiento' },
  { v: 'en_escena',     t: 'En escena' },
  { v: 'emergencia',    t: 'Emergencia' }
];

export default function Campo() {
  const [posicion, setPosicion] = useState(null);
  const [estado, setEstado] = useState('disponible');
  const [nota, setNota] = useState('');
  const [incidenteId, setIncidenteId] = useState('');
  const [incidentes, setIncidentes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState('');
  const [automatico, setAutomatico] = useState(false);
  const vigilante = useRef(null);
  const cronometro = useRef(null);

  useEffect(() => {
    api.get('/incidentes?estado=activo').then(setIncidentes).catch(() => {});
    api.get('/ubicaciones/mias').then(setHistorial).catch(() => {});
    return () => {
      if (vigilante.current) navigator.geolocation.clearWatch(vigilante.current);
      if (cronometro.current) clearInterval(cronometro.current);
    };
  }, []);

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

  const transmitir = async (auto = false) => {
    setError(''); setMensaje(null);
    try {
      const p = posicion && auto === false ? posicion : await leerPosicion();
      setPosicion(p);
      const bateria = navigator.getBattery
        ? Math.round((await navigator.getBattery()).level * 100)
        : null;

      const r = await api.post('/ubicaciones', {
        ...p, estado, nota: nota || null,
        incidente_id: incidenteId || null, bateria
      });
      setMensaje(r.mensaje);
      setHistorial(h => [r.ubicacion, ...h].slice(0, 50));
      setTimeout(() => setMensaje(null), 4000);
    } catch (e) { setError(e.message); }
  };

  const alternarAutomatico = () => {
    if (automatico) {
      clearInterval(cronometro.current);
      cronometro.current = null;
      setAutomatico(false);
      return;
    }
    transmitir(true);
    cronometro.current = setInterval(() => transmitir(true), 60000);
    setAutomatico(true);
  };

  return (
    <div className="vista">
      <div className="rejilla rejilla-2" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-cabecera"><h3>Transmitir posición</h3></div>

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

            <button className="btn btn-primario btn-bloque" onClick={() => transmitir(false)}>
              Enviar posición ahora
            </button>

            <button
              className={`btn btn-bloque ${automatico ? 'btn-peligro' : ''}`}
              style={{ marginTop: 10 }}
              onClick={alternarAutomatico}
            >
              {automatico ? 'Detener envío automático' : 'Enviar cada minuto'}
            </button>

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
              centro={posicion ? [posicion.lat, posicion.lng] : undefined}
              zoom={posicion ? 16 : 12}
              incidentes={incidentes}
              puntoSeleccionado={posicion}
              mostrarLeyenda={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
