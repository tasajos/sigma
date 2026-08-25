import { useEffect, useState } from 'react';
import { api, descargarPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import MapaOperativo from '../components/MapaOperativo';
import { InsigniaEstado } from '../components/Insignia';

const TIPOS = ['ambulancia', 'autobomba', 'rescate', 'cisterna', 'vehiculo_ligero', 'embarcacion', 'dron', 'moto'];
const ESTADOS = ['disponible', 'en_ruta', 'en_escena', 'mantenimiento', 'fuera_servicio'];
const VACIO = { codigo: '', tipo: 'ambulancia', placa: '', descripcion: '', capacidad: 0, base: '', estado: 'disponible', lat: '', lng: '' };

export default function Unidades() {
  const { puede } = useAuth();
  const [lista, setLista] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get('/unidades').then(setLista).catch(() => {});
  useEffect(() => {
    cargar();
    if (puede('personal.ver')) api.get('/personal?estado=activo').then(setPersonal).catch(() => {});
  }, [puede]);

  const guardar = async () => {
    setError('');
    if (!f.codigo) return setError('El código de la unidad es obligatorio.');
    try {
      const carga = { ...f, lat: f.lat === '' ? null : Number(f.lat), lng: f.lng === '' ? null : Number(f.lng) };
      editando ? await api.put(`/unidades/${editando}`, carga) : await api.post('/unidades', carga);
      setModal(false); cargar();
    } catch (e) { setError(e.message); }
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
            <button className="btn btn-primario" onClick={() => { setF(VACIO); setEditando(null); setModal(true); }}>
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
                        <td style={{ textTransform: 'capitalize' }}>{u.tipo.replace(/_/g, ' ')}</td>
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
            <label htmlFor="codigo">Código *</label>
            <input id="codigo" value={f.codigo} placeholder="AMB-01" onChange={(e) => setF({ ...f, codigo: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              {TIPOS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="campo campo-mono">
            <label htmlFor="placa">Placa</label>
            <input id="placa" value={f.placa || ''} onChange={(e) => setF({ ...f, placa: e.target.value })} />
          </div>
        </div>
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
        <div className="fila-campos">
          <div className="campo campo-mono">
            <label htmlFor="lat">Latitud de base</label>
            <input id="lat" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} />
          </div>
          <div className="campo campo-mono">
            <label htmlFor="lng">Longitud de base</label>
            <input id="lng" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
