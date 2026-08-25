import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, descargarPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { obtenerSocket } from '../api/socket';
import Modal from '../components/Modal';
import MapaOperativo from '../components/MapaOperativo';
import { InsigniaNivel, InsigniaEstado } from '../components/Insignia';

const TIPOS = ['incendio', 'inundacion', 'sismo', 'deslizamiento', 'accidente_vehicular',
  'materiales_peligrosos', 'busqueda_rescate', 'estructural', 'sanitario', 'otro'];
const NIVELES = ['verde', 'amarillo', 'naranja', 'rojo'];

const VACIO = {
  titulo: '', descripcion: '', tipo: 'incendio', nivel_alerta: 'amarillo',
  direccion: '', afectados: 0, lat: '', lng: ''
};

export default function Incidentes() {
  const { puede } = useAuth();
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [modal, setModal] = useState(false);
  const [f, setF] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get(`/incidentes${filtro ? `?estado=${filtro}` : ''}`).then(setLista).catch(() => {});

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [filtro]);

  useEffect(() => {
    const s = obtenerSocket();
    if (!s) return;
    s.on('incidente:nuevo', cargar);
    s.on('incidente:actualizado', cargar);
    return () => { s.off('incidente:nuevo', cargar); s.off('incidente:actualizado', cargar); };
    // eslint-disable-next-line
  }, [filtro]);

  const abrirNuevo = () => { setF(VACIO); setEditando(null); setError(''); setModal(true); };
  const abrirEdicion = (i) => {
    setF({ ...i, lat: i.lat, lng: i.lng }); setEditando(i.id); setError(''); setModal(true);
  };

  const guardar = async () => {
    setError('');
    if (!f.titulo || f.lat === '' || f.lng === '') {
      return setError('Indica la denominación del evento y marca su posición en el mapa.');
    }
    try {
      const carga = { ...f, lat: Number(f.lat), lng: Number(f.lng), afectados: Number(f.afectados || 0) };
      editando ? await api.put(`/incidentes/${editando}`, carga) : await api.post('/incidentes', carga);
      setModal(false); cargar();
    } catch (e) { setError(e.message); }
  };

  const elevarNivel = async (id, nivel_alerta) => {
    try { await api.patch(`/incidentes/${id}/nivel`, { nivel_alerta }); cargar(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="vista">
      <div className="panel-cabecera">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['', 'Todos'], ['activo', 'Activos'], ['controlado', 'Controlados'], ['cerrado', 'Cerrados']]
            .map(([v, t]) => (
              <button key={t} className={`btn btn-menudo ${filtro === v ? 'btn-primario' : ''}`}
                onClick={() => setFiltro(v)}>{t}</button>
            ))}
        </div>
        {puede('incidentes.editar') && (
          <button className="btn btn-primario" onClick={abrirNuevo}>Abrir incidente</button>
        )}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {lista.length === 0
          ? <div className="vacio"><h3>Sin incidentes</h3><p>No hay eventos que coincidan con el filtro seleccionado.</p></div>
          : <div className="tabla-marco" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Código</th><th>Denominación</th><th>Tipo</th><th>Nivel</th>
                    <th>Estado</th><th>SCI</th><th>Unid.</th><th>Inicio</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(i => (
                    <tr key={i.id}>
                      <td className="dato">{i.codigo}</td>
                      <td><Link to={`/incidentes/${i.id}`}>{i.titulo}</Link></td>
                      <td style={{ textTransform: 'capitalize' }}>{i.tipo.replace(/_/g, ' ')}</td>
                      <td>
                        {puede('alertas.emitir')
                          ? <select className="dato" value={i.nivel_alerta}
                              style={{ background: 'var(--tinta)', border: '1px solid var(--linea)', color: 'var(--texto)', padding: '3px 6px', borderRadius: 4 }}
                              onChange={(e) => elevarNivel(i.id, e.target.value)}>
                              {NIVELES.map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
                            </select>
                          : <InsigniaNivel nivel={i.nivel_alerta} />}
                      </td>
                      <td><InsigniaEstado estado={i.estado} /></td>
                      <td>{i.sci_activado ? <span className="insignia insignia-acento">Activo</span> : '—'}</td>
                      <td className="dato">{i.unidades_asignadas}</td>
                      <td className="dato">{new Date(i.fecha_inicio).toLocaleString('es-PE')}</td>
                      <td className="acciones">
                        {puede('reportes.generar') && (
                          <button className="btn btn-menudo"
                            onClick={() => descargarPdf(`/reportes/incidente/${i.id}`, `informe-${i.codigo}.pdf`)}>
                            PDF
                          </button>
                        )}
                        {puede('incidentes.editar') && (
                          <button className="btn btn-menudo" style={{ marginLeft: 6 }}
                            onClick={() => abrirEdicion(i)}>Editar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>

      <Modal
        abierto={modal}
        titulo={editando ? 'Editar incidente' : 'Abrir nuevo incidente'}
        onCerrar={() => setModal(false)}
        ancho={760}
        pie={<>
          <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar}>
            {editando ? 'Guardar cambios' : 'Abrir incidente'}
          </button>
        </>}>

        {error && <div className="aviso aviso-error">{error}</div>}

        <div className="campo">
          <label htmlFor="titulo">Denominación del evento</label>
          <input id="titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })}
            placeholder="Incendio estructural en mercado central" />
        </div>

        <div className="fila-campos-3">
          <div className="campo">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              {TIPOS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="nivel">Nivel de alerta</label>
            <select id="nivel" value={f.nivel_alerta} onChange={(e) => setF({ ...f, nivel_alerta: e.target.value })}>
              {NIVELES.map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="afectados">Personas afectadas</label>
            <input id="afectados" type="number" min="0" className="dato" value={f.afectados}
              onChange={(e) => setF({ ...f, afectados: e.target.value })} />
          </div>
        </div>

        {editando && (
          <div className="campo">
            <label htmlFor="estado">Estado del incidente</label>
            <select id="estado" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
              <option value="activo">Activo</option>
              <option value="controlado">Controlado</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
        )}

        <div className="campo">
          <label htmlFor="direccion">Dirección o referencia</label>
          <input id="direccion" value={f.direccion || ''} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
        </div>

        <div className="campo">
          <label htmlFor="descripcion">Descripción de la situación</label>
          <textarea id="descripcion" value={f.descripcion || ''}
            onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </div>

        <div className="campo">
          <label>Posición del evento</label>
          <div className="pista" style={{ marginBottom: 8 }}>Haz clic en el mapa para marcar el punto exacto.</div>
          <div style={{ height: 260, border: '1px solid var(--linea)', borderRadius: 4, overflow: 'hidden' }}>
            <MapaOperativo
              centro={f.lat && f.lng ? [Number(f.lat), Number(f.lng)] : undefined}
              zoom={f.lat ? 15 : 12}
              puntoSeleccionado={f.lat && f.lng ? { lat: Number(f.lat), lng: Number(f.lng) } : null}
              alHacerClic={({ lat, lng }) => setF({ ...f, lat, lng })}
              mostrarLeyenda={false}
            />
          </div>
          <div className="fila-campos" style={{ marginTop: 10 }}>
            <div className="campo campo-mono">
              <label htmlFor="lat">Latitud</label>
              <input id="lat" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} />
            </div>
            <div className="campo campo-mono">
              <label htmlFor="lng">Longitud</label>
              <input id="lng" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
