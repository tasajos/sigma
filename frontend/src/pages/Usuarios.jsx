import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Modal from '../components/Modal';
import { InsigniaEstado } from '../components/Insignia';

const VACIO = { nombres: '', apellidos: '', email: '', password: '', telefono: '', rol_id: '', estado: 'activo' };

export default function Usuarios() {
  const [lista, setLista] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState(false);
  const [f, setF] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => api.get('/usuarios').then(setLista).catch(() => {});
  useEffect(() => { cargar(); api.get('/roles').then(setRoles).catch(() => {}); }, []);

  const guardar = async () => {
    setError('');
    try {
      if (editando) await api.put(`/usuarios/${editando}`, f);
      else {
        if (!f.email || !f.password || !f.rol_id) return setError('Correo, contraseña y perfil son obligatorios.');
        await api.post('/usuarios', f);
      }
      setModal(false); cargar();
    } catch (e) { setError(e.message); }
  };

  const cambiarEstado = async (id, estado) => { await api.patch(`/usuarios/${id}/estado`, { estado }); cargar(); };

  const reiniciar = async (id) => {
    const nueva = prompt('Nueva contraseña (mínimo 8 caracteres):');
    if (!nueva) return;
    try { await api.patch(`/usuarios/${id}/password`, { password: nueva }); alert('Contraseña restablecida.'); }
    catch (e) { alert(e.message); }
  };

  const pendientes = lista.filter(u => u.estado === 'pendiente');

  return (
    <div className="vista">
      {pendientes.length > 0 && (
        <div className="aviso aviso-info">
          Hay {pendientes.length} solicitud(es) de registro esperando aprobación.
        </div>
      )}

      <div className="panel-cabecera">
        <h3>{lista.length} cuentas registradas</h3>
        <button className="btn btn-primario" onClick={() => { setF(VACIO); setEditando(null); setModal(true); }}>
          Crear usuario
        </button>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <div className="tabla-marco" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Perfil</th><th>Estado</th><th>Último acceso</th><th></th></tr>
            </thead>
            <tbody>
              {lista.map(u => (
                <tr key={u.id}>
                  <td>{u.nombres} {u.apellidos}</td>
                  <td className="dato">{u.email}</td>
                  <td><span className="insignia insignia-acento">{u.rol}</span></td>
                  <td><InsigniaEstado estado={u.estado} /></td>
                  <td className="dato">{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-PE') : 'Nunca'}</td>
                  <td className="acciones">
                    {u.estado === 'pendiente' && (
                      <button className="btn btn-menudo btn-primario" onClick={() => cambiarEstado(u.id, 'activo')}>Aprobar</button>
                    )}
                    {u.estado === 'activo' && (
                      <button className="btn btn-menudo" onClick={() => cambiarEstado(u.id, 'suspendido')}>Suspender</button>
                    )}
                    {u.estado === 'suspendido' && (
                      <button className="btn btn-menudo" onClick={() => cambiarEstado(u.id, 'activo')}>Reactivar</button>
                    )}
                    <button className="btn btn-menudo" style={{ marginLeft: 6 }}
                      onClick={() => { setF({ ...VACIO, ...u, rol_id: roles.find(r => r.nombre === u.rol)?.id || '' }); setEditando(u.id); setModal(true); }}>
                      Editar
                    </button>
                    <button className="btn btn-menudo" style={{ marginLeft: 6 }} onClick={() => reiniciar(u.id)}>Clave</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal abierto={modal} titulo={editando ? 'Editar usuario' : 'Crear usuario'} onCerrar={() => setModal(false)}
        pie={<>
          <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar}>Guardar</button>
        </>}>
        {error && <div className="aviso aviso-error">{error}</div>}
        <div className="fila-campos">
          <div className="campo">
            <label htmlFor="n">Nombres</label>
            <input id="n" value={f.nombres} onChange={(e) => setF({ ...f, nombres: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="a">Apellidos</label>
            <input id="a" value={f.apellidos} onChange={(e) => setF({ ...f, apellidos: e.target.value })} />
          </div>
        </div>
        {!editando && (
          <>
            <div className="campo">
              <label htmlFor="e">Correo</label>
              <input id="e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="p">Contraseña inicial</label>
              <input id="p" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            </div>
          </>
        )}
        <div className="fila-campos">
          <div className="campo">
            <label htmlFor="r">Perfil</label>
            <select id="r" value={f.rol_id} onChange={(e) => setF({ ...f, rol_id: e.target.value })}>
              <option value="">Seleccionar…</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="s">Estado</label>
            <select id="s" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>
              <option value="activo">Activo</option>
              <option value="pendiente">Pendiente</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>
        </div>
        <div className="campo campo-mono">
          <label htmlFor="t">Teléfono</label>
          <input id="t" value={f.telefono || ''} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
