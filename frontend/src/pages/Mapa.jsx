import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { obtenerSocket } from '../api/socket';
import MapaOperativo from '../components/MapaOperativo';
import PanelWhatsapp from '../components/PanelWhatsapp';

export default function Mapa() {
  const [posiciones, setPosiciones] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [compartir, setCompartir] = useState(null);
  const [avisoVivo, setAvisoVivo] = useState(null);

  const cargar = async () => {
    const [p, i, u] = await Promise.all([
      api.get('/ubicaciones/actuales').catch(() => []),
      api.get('/incidentes?estado=activo').catch(() => []),
      api.get('/unidades').catch(() => [])
    ]);
    setPosiciones(p || []); setIncidentes(i || []); setUnidades(u || []);
  };

  useEffect(() => {
    cargar();
    const s = obtenerSocket();
    if (!s) return;

    const nueva = (u) => {
      setPosiciones(prev => [u, ...prev.filter(p => p.usuario_id !== u.usuario_id)]);
    };
    const emergencia = (u) => {
      setAvisoVivo(`${u.nombres} ${u.apellidos} activó una señal de emergencia.`);
      setTimeout(() => setAvisoVivo(null), 15000);
    };

    s.on('ubicacion:nueva', nueva);
    s.on('ubicacion:emergencia', emergencia);
    s.on('incidente:nuevo', cargar);
    s.on('incidente:actualizado', cargar);

    return () => {
      s.off('ubicacion:nueva', nueva);
      s.off('ubicacion:emergencia', emergencia);
      s.off('incidente:nuevo', cargar);
      s.off('incidente:actualizado', cargar);
    };
  }, []);

  return (
    <div className="vista-plena">
      {avisoVivo && (
        <div className="aviso aviso-error" style={{ margin: 12, marginBottom: 0 }}>{avisoVivo}</div>
      )}
      <MapaOperativo
        posiciones={posiciones}
        incidentes={incidentes}
        unidades={unidades}
        alCompartirWhatsapp={setCompartir}
      />
      <PanelWhatsapp datos={compartir} onCerrar={() => setCompartir(null)} />
    </div>
  );
}
