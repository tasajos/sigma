import { useEffect, useState } from 'react';
import { api, descargarPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { InsigniaNivel, InsigniaEstado } from '../components/Insignia';

const VACIO = { nivel: 'naranja', titulo: '', cuerpo: '', vocero: '', incidente_id: '' };

export default function Prensa() {
  const { puede } = useAuth();
  const [lista, setLista] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = () => api.get('/prensa').then(setLista).catch(() => {});
  useEffect(() => { cargar(); api.get('/incidentes').then(setIncidentes).catch(() => {}); }, []);

  const guardar = async () => {
    setError('');
    if (!f.titulo || !f.cuerpo) return setError('Escribe el titular y el cuerpo del boletín.');
    try {
      const carga = { ...f, incidente_id: f.incidente_id || null };
      editando ? await api.put(`/prensa/${editando}`, carga) : await api.post('/prensa', carga);
      setModal(false); cargar();
    } catch (e) { setError(e.message); }
  };

  const publicar = async (b) => {
    try {
      await api.post(`/prensa/${b.id}/publicar`, {});
      setAviso('Boletín publicado.'); cargar();
      setTimeout(() => setAviso(''), 4000);
    } catch (e) {
      if (confirm(`${e.message}\n\n¿Publicar de todas formas?`)) {
        await api.post(`/prensa/${b.id}/publicar`, { forzar: true });
        cargar();
      }
    }
  };

  return (
    <div className="vista">
      {aviso && <div className="aviso aviso-ok">{aviso}</div>}

      <div className="panel-cabecera">
        <div>
          <h3>Boletines oficiales</h3>
          <p style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
            La difusión a prensa se habilita en niveles naranja y rojo.
          </p>
        </div>
        {puede('prensa.gestionar') && (
          <button className="btn btn-primario" onClick={() => { setF(VACIO); setEditando(null); setModal(true); }}>
            Redactar boletín
          </button>
        )}
      </div>

      {lista.length === 0
        ? <div className="panel vacio"><h3>Sin boletines</h3><p>Redacta el primer comunicado oficial del evento.</p></div>
        : <div className="rejilla rejilla-2">
            {lista.map(b => (
              <article className="panel" key={b.id}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <InsigniaNivel nivel={b.nivel} />
                  <InsigniaEstado estado={b.estado} />
                  {b.incidente_codigo && <span className="dato" style={{ color: 'var(--texto-tenue)' }}>{b.incidente_codigo}</span>}
                </div>
                <h3>{b.titulo}</h3>
                <p style={{ color: 'var(--texto-suave)', marginTop: 8, fontSize: 13 }}>
                  {b.cuerpo.slice(0, 260)}{b.cuerpo.length > 260 ? '…' : ''}
                </p>
                <div className="dato" style={{ color: 'var(--texto-tenue)', marginTop: 10, fontSize: 11 }}>
                  {b.vocero || 'Sin vocero asignado'} · {new Date(b.creado_en).toLocaleString('es-PE')}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {puede('reportes.generar') && (
                    <button className="btn btn-menudo" onClick={() => descargarPdf(`/reportes/prensa/${b.id}`, `boletin-${b.id}.pdf`)}>
                      Exportar PDF
                    </button>
                  )}
                  {puede('prensa.gestionar') && (
                    <>
                      <button className="btn btn-menudo" onClick={() => { setF({ ...VACIO, ...b, incidente_id: b.incidente_id || '' }); setEditando(b.id); setModal(true); }}>
                        Editar
                      </button>
                      {b.estado !== 'publicado' && (
                        <button className="btn btn-menudo btn-primario" onClick={() => publicar(b)}>Publicar</button>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>}

      <Modal abierto={modal} titulo={editando ? 'Editar boletín' : 'Redactar boletín de prensa'}
        onCerrar={() => setModal(false)} ancho={720}
        pie={<>
          <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar}>Guardar borrador</button>
        </>}>
        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="fila-campos">
          <div className="campo">
            <label htmlFor="nivel">Nivel del evento</label>
            <select id="nivel" value={f.nivel} onChange={(e) => setF({ ...f, nivel: e.target.value })}>
              <option value="verde">Verde</option><option value="amarillo">Amarillo</option>
              <option value="naranja">Naranja</option><option value="rojo">Rojo</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="vocero">Vocero autorizado</label>
            <input id="vocero" value={f.vocero || ''} onChange={(e) => setF({ ...f, vocero: e.target.value })} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="inc">Incidente</label>
          <select id="inc" value={f.incidente_id} onChange={(e) => setF({ ...f, incidente_id: e.target.value })}>
            <option value="">Sin incidente asociado</option>
            {incidentes.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.titulo}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="tit">Titular</label>
          <input id="tit" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="cuerpo">Cuerpo del comunicado</label>
          <textarea id="cuerpo" style={{ minHeight: 200 }} value={f.cuerpo}
            onChange={(e) => setF({ ...f, cuerpo: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
