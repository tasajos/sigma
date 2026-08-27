import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { obtenerSocket } from '../api/socket';
import MapaOperativo from '../components/MapaOperativo';
import PanelWhatsapp from '../components/PanelWhatsapp';
import PanelEnlaceUbicacion from '../components/PanelEnlaceUbicacion';
import { IconoUbicacionVivo, IconoWhatsapp, IconoPersona, IconoEnlace, IconoEliminar } from '../components/Iconos';

const ETIQUETA_ESTADO = { pendiente: 'Pendiente', activo: 'En vivo', rechazado: 'Rechazado' };

export default function Mapa() {
  const [posiciones, setPosiciones] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [compartir, setCompartir] = useState(null);
  const [avisoVivo, setAvisoVivo] = useState(null);
  const [dispositivos, setDispositivos] = useState([]);
  const [solicitando, setSolicitando] = useState(null);
  const [avisoSolicitud, setAvisoSolicitud] = useState(null);
  const [enlaces, setEnlaces] = useState([]);
  const [panelEnlace, setPanelEnlace] = useState(false);

  const cargar = async () => {
    const [p, i, u] = await Promise.all([
      api.get('/ubicaciones/actuales').catch(() => []),
      api.get('/incidentes?estado=activo').catch(() => []),
      api.get('/unidades').catch(() => [])
    ]);
    setPosiciones(p || []); setIncidentes(i || []); setUnidades(u || []);
  };

  const cargarEnlaces = () => {
    api.get('/enlaces').then(datos => setEnlaces(prev => (datos || []).map(e => {
      const existente = prev.find(p => p.token === e.token);
      return {
        id: e.id, token: e.token, etiqueta: e.etiqueta, estado: e.estado,
        lat: e.lat, lng: e.lng, incidente_id: e.incidente_id, reportado_en: e.ultima_actividad,
        trail: existente?.trail?.length ? existente.trail : (e.lat && e.lng ? [[Number(e.lat), Number(e.lng)]] : [])
      };
    }))).catch(() => {});
  };

  useEffect(() => {
    cargar();
    cargarEnlaces();
    api.get('/ubicaciones/conectados').then(setDispositivos).catch(() => {});
    const s = obtenerSocket();
    if (!s) return;

    const nueva = (u) => {
      setPosiciones(prev => [u, ...prev.filter(p => p.usuario_id !== u.usuario_id)]);
    };
    const emergencia = (u) => {
      setAvisoVivo(`${u.nombres} ${u.apellidos} activó una señal de emergencia.`);
      setTimeout(() => setAvisoVivo(null), 15000);
    };
    const respuesta = (r) => {
      setSolicitando(prev => (prev === r.usuarioId ? null : prev));
      setAvisoSolicitud(
        r.aceptada
          ? `${r.nombres} ${r.apellidos} aceptó transmitir su ubicación en tiempo real.`
          : `${r.nombres} ${r.apellidos} rechazó la solicitud de ubicación.`
      );
      setTimeout(() => setAvisoSolicitud(null), 8000);
    };
    const alRecibirEnlace = (carga) => {
      setEnlaces(prev => {
        const punto = [carga.lat, carga.lng];
        const existe = prev.find(e => e.token === carga.token);
        if (existe) {
          return prev.map(e => e.token === carga.token
            ? { ...e, lat: carga.lat, lng: carga.lng, reportado_en: carga.reportado_en, estado: 'activo',
                trail: [...e.trail, punto].slice(-200) }
            : e);
        }
        return [...prev, {
          token: carga.token, etiqueta: carga.etiqueta, estado: 'activo', lat: carga.lat, lng: carga.lng,
          incidente_id: carga.incidente_id, reportado_en: carga.reportado_en, trail: [punto]
        }];
      });
    };
    const alFinalizarEnlace = ({ token }) => setEnlaces(prev => prev.filter(e => e.token !== token));

    s.on('ubicacion:nueva', nueva);
    s.on('ubicacion:emergencia', emergencia);
    s.on('ubicacion:dispositivos', setDispositivos);
    s.on('ubicacion:solicitud:respuesta', respuesta);
    s.on('ubicacion:enlace', alRecibirEnlace);
    s.on('ubicacion:enlace:finalizado', alFinalizarEnlace);
    s.on('incidente:nuevo', cargar);
    s.on('incidente:actualizado', cargar);

    return () => {
      s.off('ubicacion:nueva', nueva);
      s.off('ubicacion:emergencia', emergencia);
      s.off('ubicacion:dispositivos', setDispositivos);
      s.off('ubicacion:solicitud:respuesta', respuesta);
      s.off('ubicacion:enlace', alRecibirEnlace);
      s.off('ubicacion:enlace:finalizado', alFinalizarEnlace);
      s.off('incidente:nuevo', cargar);
      s.off('incidente:actualizado', cargar);
    };
  }, []);

  const solicitarUbicacion = (usuarioId) => {
    const s = obtenerSocket();
    if (!s) return;
    s.emit('ubicacion:solicitar', { usuarioId });
    setSolicitando(usuarioId);
    setTimeout(() => setSolicitando(prev => (prev === usuarioId ? null : prev)), 20000);
  };

  const cancelarEnlace = async (id) => {
    setEnlaces(prev => prev.filter(e => e.id !== id));
    try { await api.post(`/enlaces/${id}/cancelar`); } catch { cargarEnlaces(); }
  };

  return (
    <div className="vista-plena">
      {avisoVivo && (
        <div className="aviso aviso-error" style={{ margin: 12, marginBottom: 0 }}>{avisoVivo}</div>
      )}
      {avisoSolicitud && (
        <div className="aviso aviso-info" style={{ margin: 12, marginBottom: 0 }}>{avisoSolicitud}</div>
      )}
      <div className="panel-dispositivos">
        <div className="rotulo"><IconoUbicacionVivo size={15} />Solicitar ubicación en vivo</div>
        <button className="btn btn-whatsapp btn-menudo btn-bloque" style={{ marginTop: 8 }} onClick={() => setPanelEnlace(true)}>
          <IconoWhatsapp size={14} />Nuevo enlace por WhatsApp
        </button>
        <div style={{ fontSize: 11.5, color: 'var(--texto-tenue)', marginTop: 4 }}>
          Para cualquier dispositivo, esté o no registrado.
        </div>

        {enlaces.length > 0 && (
          <>
            <div className="rotulo" style={{ marginTop: 14 }}><IconoEnlace size={13} />Enlaces activos</div>
            {enlaces.map(e => (
              <div key={e.token} className="fila-enlace">
                <span className="nombre">
                  <span className={`estado-punto ${e.estado || 'pendiente'}`} title={ETIQUETA_ESTADO[e.estado] || 'Pendiente'} />
                  {e.etiqueta}
                </span>
                {e.id != null && (
                  <button className="btn-icono" title="Eliminar enlace" onClick={() => cancelarEnlace(e.id)}>
                    <IconoEliminar size={13} />
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {dispositivos.length > 0 && (
          <>
            <div className="rotulo" style={{ marginTop: 14 }}><IconoPersona size={13} />Personal conectado</div>
            {dispositivos.map(d => (
              <div key={d.usuario_id} className="fila-dispositivo">
                <span className="nombre"><IconoPersona size={13} />{d.nombres} {d.apellidos}</span>
                <button
                  className="btn-solicitar"
                  disabled={solicitando === d.usuario_id}
                  onClick={() => solicitarUbicacion(d.usuario_id)}
                >
                  <IconoUbicacionVivo size={12} />{solicitando === d.usuario_id ? 'Solicitado…' : 'Solicitar'}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      <MapaOperativo
        posiciones={posiciones}
        incidentes={incidentes}
        unidades={unidades}
        enlaces={enlaces}
        alCompartirWhatsapp={setCompartir}
      />
      <PanelWhatsapp datos={compartir} onCerrar={() => setCompartir(null)} />
      <PanelEnlaceUbicacion
        abierto={panelEnlace}
        incidentes={incidentes}
        onCerrar={() => setPanelEnlace(false)}
        onCreado={cargarEnlaces}
      />
    </div>
  );
}
