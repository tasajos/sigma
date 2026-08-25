import { useEffect, useState } from 'react';
import { api, descargarPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import MapaOperativo from '../components/MapaOperativo';
import { InsigniaEstado } from '../components/Insignia';

const ESTADOS = ['disponible', 'en_ruta', 'en_escena', 'mantenimiento', 'fuera_servicio'];
const VACIO = { codigo: '', tipo: '', placa: '', descripcion: '', capacidad: 0, base: '', estado: 'disponible', lat: '', lng: '' };

export default function Unidades() {
  const { puede } = useAuth();
  const [lista, setLista] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState(false);
  const [catEtiqueta, setCatEtiqueta] = useState('');
  const [catPrefijo, setCatPrefijo] = useState('');
  const [errorCategoria, setErrorCategoria] = useState('');

  const cargar = () => api.get('/unidades').then(setLista).catch(() => {});
  const cargarTipos = () => api.get('/tipos-unidad').then(setTipos).catch(() => {});
  useEffect(() => {
    cargar();
    cargarTipos();
    if (puede('personal.ver')) api.get('/personal?estado=activo').then(setPersonal).catch(() => {});
  }, [puede]);

  // El código se autoincrementa a partir del prefijo de la categoría (AMB-01, AMB-02, ...)
  // para que nunca se repita dentro de una misma categoría. Solo aplica al registrar una
  // unidad nueva: al editar se conserva el código ya asignado.
  useEffect(() => {
    if (!modal || editando || !f.tipo) return;
    api.get(`/unidades/siguiente-codigo?tipo=${encodeURIComponent(f.tipo)}`)
      .then(r => setF(prev => ({ ...prev, codigo: r.codigo })))
      .catch(() => {});
  }, [modal, editando, f.tipo]);

  const guardar = async () => {
    setError('');
    if (!f.tipo) return setError('Selecciona el tipo de unidad.');
    try {
      const carga = { ...f, lat: f.lat === '' ? null : Number(f.lat), lng: f.lng === '' ? null : Number(f.lng) };
      editando ? await api.put(`/unidades/${editando}`, carga) : await api.post('/unidades', carga);
      setModal(false); cargar();
    } catch (e) { setError(e.message); }
  };

  const crearCategoria = async () => {
    setErrorCategoria('');
    if (!catEtiqueta.trim() || !catPrefijo.trim()) {
      return setErrorCategoria('Indica el nombre y el prefijo de la categoría.');
    }
    try {
      const r = await api.post('/tipos-unidad', { etiqueta: catEtiqueta.trim(), prefijo: catPrefijo.trim() });
      await cargarTipos();
      setF(prev => ({ ...prev, tipo: r.clave }));
      setCatEtiqueta(''); setCatPrefijo(''); setNuevaCategoria(false);
    } catch (e) { setErrorCategoria(e.message); }
  };

  return (
    <div className="vista">
      <div className="panel-cabecera">
        <h3>{lista.length} unidades registradas</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {puede('reportes.generar') && (
            <button className="btn" onClick={() => descargarPdf('/reportes/unidades', 'inventario-unidades.pdf')}>
              Exportar PDF
            </button>
          )}
          {puede('unidades.editar') && (
            <button className="btn btn-primario"
              onClick={() => { setF({ ...VACIO, tipo: tipos[0]?.clave || '' }); setEditando(null); setNuevaCategoria(false); setModal(true); }}>
              Registrar unidad
            </button>
          )}
        </div>
      </div>

      <div className="rejilla rejilla-2" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="panel" style={{ padding: 0 }}>
          {lista.length === 0
            ? <div className="vacio"><h3>Sin unidades</h3><p>Registra la primera unidad operativa del inventario.</p></div>
            : <div className="tabla-marco" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>Código</th><th>Tipo</th><th>Placa</th><th>Base</th><th>Responsable</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {lista.map(u => (
                      <tr key={u.id}>
                        <td className="dato">{u.codigo}</td>
                        <td>{tipos.find(t => t.clave === u.tipo)?.etiqueta || u.tipo.replace(/_/g, ' ')}</td>
                        <td className="dato">{u.placa || '—'}</td>
                        <td>{u.base || '—'}</td>
                        <td>{u.responsable || '—'}</td>
                        <td><InsigniaEstado estado={u.estado} /></td>
                        <td className="acciones">
                          {puede('unidades.editar') && (
                            <button className="btn btn-menudo"
                              onClick={() => { setF({ ...VACIO, ...u, lat: u.lat ?? '', lng: u.lng ?? '' }); setEditando(u.id); setModal(true); }}>
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </div>

        <div className="panel" style={{ padding: 0, overflow: 'hidden', minHeight: 420 }}>
          <div style={{ height: 420 }}>
            <MapaOperativo unidades={lista} mostrarLeyenda={false} />
          </div>
        </div>
      </div>

      <Modal abierto={modal} titulo={editando ? 'Editar unidad' : 'Registrar unidad operativa'}
        onCerrar={() => setModal(false)}
        pie={<>
          <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar}>Guardar</button>
        </>}>
        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="fila-campos-3">
          <div className="campo campo-mono">
            <label htmlFor="codigo">Código</label>
            <input id="codigo" value={f.codigo} readOnly={!editando}
              style={!editando ? { background: 'var(--tinta)', color: 'var(--texto-tenue)' } : undefined}
              placeholder="Se genera al elegir el tipo"
              onChange={(e) => setF({ ...f, codigo: e.target.value })} />
            {!editando && <div className="pista" style={{ marginTop: 4 }}>Se autoincrementa según el tipo.</div>}
          </div>
          <div className="campo">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label htmlFor="tipo">Tipo</label>
              <button type="button" className="btn btn-menudo" style={{ padding: '2px 8px' }}
                onClick={() => setNuevaCategoria(v => !v)}>
                {nuevaCategoria ? 'Cancelar' : '+ Nueva categoría'}
              </button>
            </div>
            <select id="tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              {tipos.length === 0 && <option value="">Sin categorías</option>}
              {tipos.map(t => <option key={t.clave} value={t.clave}>{t.etiqueta}</option>)}
            </select>
          </div>
          <div className="campo campo-mono">
            <label htmlFor="placa">Placa</label>
            <input id="placa" value={f.placa || ''} onChange={(e) => setF({ ...f, placa: e.target.value })} />
          </div>
        </div>

        {nuevaCategoria && (
          <div className="panel" style={{ background: 'var(--tinta)', marginBottom: 16 }}>
            {errorCategoria && <div className="aviso aviso-error">{errorCategoria}</div>}
            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="catEtiqueta">Nombre de la categoría</label>
                <input id="catEtiqueta" value={catEtiqueta} placeholder="Bote de rescate"
                  onChange={(e) => setCatEtiqueta(e.target.value)} />
              </div>
              <div className="campo campo-mono">
                <label htmlFor="catPrefijo">Prefijo de código</label>
                <input id="catPrefijo" value={catPrefijo} placeholder="BOT" maxLength={10}
                  onChange={(e) => setCatPrefijo(e.target.value.toUpperCase())} />
              </div>
            </div>
            <button className="btn btn-menudo" style={{ marginTop: 4 }} onClick={crearCategoria}>
              Agregar categoría
            </button>
          </div>
        )}
        <div className="fila-campos-3">
          <div className="campo">
            <label htmlFor="base">Base</label>
            <input id="base" value={f.base || ''} onChange={(e) => setF({ ...f, base: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="cap">Capacidad</label>
            <input id="cap" type="number" min="0" className="dato" value={f.capacidad}
              onChange={(e) => setF({ ...f, capacidad: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="est">Estado</label>
            <select id="est" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
              {ESTADOS.map(e2 => <option key={e2} value={e2}>{e2.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="resp">Responsable</label>
          <select id="resp" value={f.responsable_id || ''} onChange={(e) => setF({ ...f, responsable_id: e.target.value })}>
            <option value="">Sin asignar</option>
            {personal.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.apellidos}, {p.nombres}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="desc">Descripción</label>
          <input id="desc" value={f.descripcion || ''} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </div>
        <div className="campo">
          <label>Ubicación de la base</label>
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
              <label htmlFor="lat">Latitud de base</label>
              <input id="lat" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} />
            </div>
            <div className="campo campo-mono">
              <label htmlFor="lng">Longitud de base</label>
              <input id="lng" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
