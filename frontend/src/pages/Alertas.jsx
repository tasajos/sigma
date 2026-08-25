import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { obtenerSocket } from '../api/socket';
import Modal from '../components/Modal';
import { InsigniaNivel } from '../components/Insignia';

const COLOR = { verde: '#1F9D63', amarillo: '#E0A50B', naranja: '#E2601C', rojo: '#C42B2B' };

const GUIA = {
  verde:    'Vigilancia. Sin despliegue de recursos.',
  amarillo: 'Preparación. Unidades en alistamiento y personal notificado.',
  naranja:  'Respuesta. Despliegue en terreno y activación del SCI.',
  rojo:     'Emergencia mayor. Notificación a prensa y autoridades.'
};

export default function Alertas() {
  const { puede } = useAuth();
  const [lista, setLista] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ nivel: 'amarillo', titulo: '', mensaje: '', canal: 'interno', incidente_id: '' });
  const [error, setError] = useState('');

  const cargar = () => api.get('/alertas').then(setLista).catch(() => {});

  useEffect(() => {
    cargar();
    api.get('/incidentes').then(setIncidentes).catch(() => {});
    const s = obtenerSocket();
    if (!s) return;
    s.on('alerta:nueva', cargar); s.on('alerta:nivel', cargar);
    return () => { s.off('alerta:nueva', cargar); s.off('alerta:nivel', cargar); };
  }, []);

  const emitir = async () => {
    setError('');
    if (!f.titulo || !f.mensaje) return setError('Indica el título y el mensaje de la alerta.');
    try {
      await api.post('/alertas', { ...f, incidente_id: f.incidente_id || null });
      setModal(false);
      setF({ nivel: 'amarillo', titulo: '', mensaje: '', canal: 'interno', incidente_id: '' });
      cargar();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="vista">
      <div className="rejilla rejilla-4" style={{ marginBottom: 18 }}>
        {Object.entries(GUIA).map(([nivel, texto]) => (
          <div key={nivel} className="indicador" style={{ '--color-indicador': COLOR[nivel] }}>
            <div className="indicador-valor" style={{ fontSize: 20, color: COLOR[nivel] }}>{nivel.toUpperCase()}</div>
            <div style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 6 }}>{texto}</div>
          </div>
        ))}
      </div>

      <div className="panel-cabecera">
        <h3>Historial de alertas</h3>
        {puede('alertas.emitir') && (
          <button className="btn btn-primario" onClick={() => setModal(true)}>Emitir alerta</button>
        )}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {lista.length === 0
          ? <div className="vacio"><h3>Sin alertas</h3><p>No se ha emitido ninguna alerta todavía.</p></div>
          : <div className="tabla-marco" style={{ border: 'none' }}>
              <table>
                <thead><tr><th>Emitida</th><th>Nivel</th><th>Título</th><th>Mensaje</th><th>Canal</th><th>Incidente</th><th>Por</th></tr></thead>
                <tbody>
                  {lista.map(a => (
                    <tr key={a.id}>
                      <td className="dato">{new Date(a.emitida_en).toLocaleString('es-PE')}</td>
                      <td><InsigniaNivel nivel={a.nivel} /></td>
                      <td>{a.titulo}</td>
                      <td style={{ color: 'var(--texto-suave)', maxWidth: 320 }}>{a.mensaje?.slice(0, 120)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{a.canal}</td>
                      <td className="dato">{a.incidente_codigo || '—'}</td>
                      <td>{a.emisor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>

      <Modal abierto={modal} titulo="Emitir alerta" onCerrar={() => setModal(false)}
        pie={<>
          <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primario" onClick={emitir}>Emitir</button>
        </>}>
        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="fila-campos">
          <div className="campo">
            <label htmlFor="nivel">Nivel</label>
            <select id="nivel" value={f.nivel} onChange={(e) => setF({ ...f, nivel: e.target.value })}>
              {Object.keys(GUIA).map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
            </select>
            <div className="pista">{GUIA[f.nivel]}</div>
          </div>
          <div className="campo">
            <label htmlFor="canal">Canal de difusión</label>
            <select id="canal" value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>
              <option value="interno">Interno</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="prensa">Prensa</option>
              <option value="todos">Todos los canales</option>
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="inc">Incidente relacionado</label>
          <select id="inc" value={f.incidente_id} onChange={(e) => setF({ ...f, incidente_id: e.target.value })}>
            <option value="">Sin incidente asociado</option>
            {incidentes.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.titulo}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="tit">Título</label>
          <input id="tit" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="msg">Mensaje</label>
          <textarea id="msg" value={f.mensaje} onChange={(e) => setF({ ...f, mensaje: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
