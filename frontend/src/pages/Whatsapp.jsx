import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Whatsapp() {
  const [historial, setHistorial] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [f, setF] = useState({ destino: '', lat: '', lng: '', titulo: 'Reporte de posición', referencia: '' });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get('/whatsapp/historial').then(setHistorial).catch(() => {});
  useEffect(() => {
    cargar();
    api.get('/ubicaciones/actuales').then(setPosiciones).catch(() => {});
  }, []);

  const enviar = async () => {
    setError(''); setResultado(null);
    if (f.lat === '' || f.lng === '') return setError('Indica las coordenadas que quieres compartir.');
    try {
      const r = await api.post('/whatsapp/coordenadas', { ...f, lat: Number(f.lat), lng: Number(f.lng) });
      setResultado(r);
      if (r.enlace) window.open(r.enlace, '_blank', 'noopener');
      cargar();
    } catch (e) { setError(e.message); }
  };

  const tomarDe = (p) => setF({
    ...f, lat: p.lat, lng: p.lng,
    titulo: `Posición de ${p.nombres} ${p.apellidos}`,
    referencia: p.nota || ''
  });

  return (
    <div className="vista">
      <div className="rejilla rejilla-2" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
        <div className="panel">
          <div className="panel-cabecera"><h3>Enviar coordenadas</h3></div>

          {error && <div className="aviso aviso-error">{error}</div>}
          {resultado && (
            <div className="aviso aviso-ok">
              {resultado.modo === 'api'
                ? 'Mensaje entregado por la API de WhatsApp.'
                : <>Mensaje listo. {resultado.enlace && <a href={resultado.enlace} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}</>}
            </div>
          )}

          <div className="campo campo-mono">
            <label htmlFor="destino">Número de destino</label>
            <input id="destino" value={f.destino} placeholder="+51999888777"
              onChange={(e) => setF({ ...f, destino: e.target.value })} />
            <div className="pista">Con código de país. En blanco, WhatsApp pedirá elegir el contacto.</div>
          </div>

          <div className="fila-campos">
            <div className="campo campo-mono">
              <label htmlFor="lat">Latitud</label>
              <input id="lat" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} />
            </div>
            <div className="campo campo-mono">
              <label htmlFor="lng">Longitud</label>
              <input id="lng" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} />
            </div>
          </div>

          <div className="campo">
            <label htmlFor="tit">Asunto</label>
            <input id="tit" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
          </div>

          <div className="campo">
            <label htmlFor="ref">Referencia en terreno</label>
            <input id="ref" value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} />
          </div>

          <button className="btn btn-whatsapp btn-bloque" onClick={enviar}>Enviar por WhatsApp</button>

          {posiciones.length > 0 && (
            <div style={{ marginTop: 20, borderTop: '1px solid var(--linea)', paddingTop: 14 }}>
              <div className="rotulo" style={{ marginBottom: 8 }}>Tomar de una posición reportada</div>
              {posiciones.slice(0, 6).map(p => (
                <button key={p.usuario_id} className="btn btn-menudo btn-bloque" style={{ marginBottom: 6, justifyContent: 'space-between' }}
                  onClick={() => tomarDe(p)}>
                  <span>{p.nombres} {p.apellidos}</span>
                  <span className="dato" style={{ fontSize: 10 }}>{Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-cabecera" style={{ padding: '14px 18px', marginBottom: 0, borderBottom: '1px solid var(--linea)' }}>
            <h3>Historial de envíos</h3>
          </div>
          {historial.length === 0
            ? <div className="vacio">Aún no se han enviado coordenadas.</div>
            : <div className="tabla-marco" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>Fecha</th><th>Destino</th><th>Coordenadas</th><th>Modo</th><th>Estado</th><th>Emisor</th></tr></thead>
                  <tbody>
                    {historial.map(h => (
                      <tr key={h.id}>
                        <td className="dato">{new Date(h.enviado_en).toLocaleString('es-PE')}</td>
                        <td className="dato">{h.destino || '—'}</td>
                        <td className="coord">
                          {h.lat ? `${Number(h.lat).toFixed(5)}, ${Number(h.lng).toFixed(5)}` : '—'}
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{h.modo}</td>
                        <td style={{ textTransform: 'capitalize' }}>{h.estado}</td>
                        <td>{h.emisor || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </div>
      </div>
    </div>
  );
}
