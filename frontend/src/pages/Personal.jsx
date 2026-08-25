import { useEffect, useState } from 'react';
import { api, descargarPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { InsigniaEstado } from '../components/Insignia';

const SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const VACIO = {
  nombres: '', apellidos: '', documento: '', tipo_sangre: '', telefono: '',
  contacto_emergencia: '', telefono_emergencia: '', institucion: '',
  especialidad: '', nivel_certificacion: 'basico', vence_certificacion: '', estado: 'activo'
};

export default function Personal() {
  const { puede } = useAuth();
  const [lista, setLista] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [f, setF] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get(`/personal${busqueda ? `?q=${encodeURIComponent(busqueda)}` : ''}`)
    .then(setLista).catch(() => {});

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [busqueda]);

  const guardar = async () => {
    setError('');
    if (!f.nombres || !f.apellidos || !f.documento) {
      return setError('Nombres, apellidos y documento son obligatorios.');
    }
    try {
      editando ? await api.put(`/personal/${editando}`, f) : await api.post('/personal', f);
      setModal(false); cargar();
    } catch (e) { setError(e.message); }
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este registro de personal?')) return;
    await api.delete(`/personal/${id}`); cargar();
  };

  return (
    <div className="vista">
      <div className="panel-cabecera">
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, documento o código"
          style={{ maxWidth: 320, padding: '9px 11px', background: 'var(--panel)', border: '1px solid var(--linea)', borderRadius: 4, color: 'var(--texto)' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {puede('reportes.generar') && (
            <button className="btn" onClick={() => descargarPdf('/reportes/personal', 'nomina-personal.pdf')}>
              Exportar PDF
            </button>
          )}
          {puede('personal.editar') && (
            <button className="btn btn-primario" onClick={() => { setF(VACIO); setEditando(null); setModal(true); }}>
              Registrar personal
            </button>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {lista.length === 0
          ? <div className="vacio"><h3>Sin registros</h3><p>No hay personal que coincida con la búsqueda.</p></div>
          : <div className="tabla-marco" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr><th>Código</th><th>Apellidos y nombres</th><th>Documento</th><th>Sangre</th>
                    <th>Institución</th><th>Especialidad</th><th>Nivel</th><th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {lista.map(p => (
                    <tr key={p.id}>
                      <td className="dato">{p.codigo}</td>
                      <td>{p.apellidos}, {p.nombres}</td>
                      <td className="dato">{p.documento}</td>
                      <td className="dato">{p.tipo_sangre || '—'}</td>
                      <td>{p.institucion || '—'}</td>
                      <td>{p.especialidad || '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{p.nivel_certificacion}</td>
                      <td><InsigniaEstado estado={p.estado} /></td>
                      <td className="acciones">
                        {puede('personal.editar') && (
                          <>
                            <button className="btn btn-menudo" onClick={() => { setF({ ...VACIO, ...p }); setEditando(p.id); setModal(true); }}>Editar</button>
                            <button className="btn btn-menudo" style={{ marginLeft: 6 }} onClick={() => eliminar(p.id)}>Quitar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>

      <Modal abierto={modal} titulo={editando ? 'Editar personal' : 'Registrar personal de emergencias'}
        onCerrar={() => setModal(false)}
        pie={<>
          <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar}>Guardar</button>
        </>}>
        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="fila-campos">
          <Campo id="nombres" r="Nombres *" v={f.nombres} on={(v) => setF({ ...f, nombres: v })} />
          <Campo id="apellidos" r="Apellidos *" v={f.apellidos} on={(v) => setF({ ...f, apellidos: v })} />
        </div>
        <div className="fila-campos-3">
          <Campo id="documento" r="Documento *" v={f.documento} mono on={(v) => setF({ ...f, documento: v })} />
          <div className="campo">
            <label htmlFor="sangre">Tipo de sangre</label>
            <select id="sangre" value={f.tipo_sangre || ''} onChange={(e) => setF({ ...f, tipo_sangre: e.target.value })}>
              <option value="">—</option>
              {SANGRE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Campo id="telefono" r="Teléfono" v={f.telefono} mono on={(v) => setF({ ...f, telefono: v })} />
        </div>
        <div className="fila-campos">
          <Campo id="institucion" r="Institución" v={f.institucion} on={(v) => setF({ ...f, institucion: v })} />
          <Campo id="especialidad" r="Especialidad" v={f.especialidad} on={(v) => setF({ ...f, especialidad: v })} />
        </div>
        <div className="fila-campos-3">
          <div className="campo">
            <label htmlFor="nivel">Certificación</label>
            <select id="nivel" value={f.nivel_certificacion} onChange={(e) => setF({ ...f, nivel_certificacion: e.target.value })}>
              <option value="basico">Básico</option><option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option><option value="instructor">Instructor</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="vence">Vence el</label>
            <input id="vence" type="date" value={f.vence_certificacion || ''}
              onChange={(e) => setF({ ...f, vence_certificacion: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="estado">Estado</label>
            <select id="estado" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
              <option value="activo">Activo</option><option value="descanso">En descanso</option>
              <option value="baja">De baja</option>
            </select>
          </div>
        </div>
        <div className="fila-campos">
          <Campo id="ce" r="Contacto de emergencia" v={f.contacto_emergencia} on={(v) => setF({ ...f, contacto_emergencia: v })} />
          <Campo id="te" r="Teléfono del contacto" v={f.telefono_emergencia} mono on={(v) => setF({ ...f, telefono_emergencia: v })} />
        </div>
      </Modal>
    </div>
  );
}

function Campo({ id, r, v, on, mono }) {
  return (
    <div className={`campo ${mono ? 'campo-mono' : ''}`}>
      <label htmlFor={id}>{r}</label>
      <input id={id} value={v || ''} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
