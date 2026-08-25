import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, descargarPdf } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import MapaOperativo from '../components/MapaOperativo';
import PanelWhatsapp from '../components/PanelWhatsapp';
import { InsigniaNivel, InsigniaEstado } from '../components/Insignia';

const COLOR_SECCION = {
  'Comando': 'var(--rojo)',
  'Staff de Comando': 'var(--naranja)',
  'Staff General': 'var(--acento)'
};

export default function IncidenteDetalle() {
  const { id } = useParams();
  const { puede } = useAuth();
  const [inc, setInc] = useState(null);
  const [sci, setSci] = useState(null);
  const [personal, setPersonal] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [asignando, setAsignando] = useState(null);
  const [seleccion, setSeleccion] = useState({ personal_id: '', notas: '' });
  const [objetivo, setObjetivo] = useState({ descripcion: '', prioridad: 'media' });
  const [compartir, setCompartir] = useState(null);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    const [i, s] = await Promise.all([
      api.get(`/incidentes/${id}`).catch(() => null),
      api.get(`/sci/${id}`).catch(() => null)
    ]);
    setInc(i); setSci(s);
    if (puede('personal.ver')) api.get('/personal?estado=activo').then(setPersonal).catch(() => {});
    if (puede('unidades.ver')) api.get('/unidades?estado=disponible').then(setUnidades).catch(() => {});
  }, [id, puede]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!inc) return <div className="vista"><div className="panel vacio">Cargando incidente…</div></div>;

  const activarSci = async () => {
    await api.post(`/sci/${id}/activar`);
    setAviso('SCI activado. Asigna los puestos de la estructura de comando.');
    cargar();
  };

  const desactivarSci = async () => {
    if (!confirm('¿Desactivar el SCI de este incidente? Se liberarán todos los puestos.')) return;
    await api.post(`/sci/${id}/desactivar`);
    cargar();
  };

  const guardarPuesto = async () => {
    await api.put(`/sci/${id}/puesto`, {
      puesto: asignando.clave,
      personal_id: seleccion.personal_id || null,
      notas: seleccion.notas || null
    });
    setAsignando(null); setSeleccion({ personal_id: '', notas: '' });
    cargar();
  };

  const liberarPuesto = async (clave) => {
    await api.delete(`/sci/${id}/puesto/${clave}`);
    cargar();
  };

  const agregarObjetivo = async () => {
    if (!objetivo.descripcion.trim()) return;
    await api.post(`/sci/${id}/objetivos`, objetivo);
    setObjetivo({ descripcion: '', prioridad: 'media' });
    cargar();
  };

  const asignarUnidad = async (unidad_id) => {
    await api.post(`/incidentes/${id}/unidades`, { unidad_id: Number(unidad_id) });
    cargar();
  };

  const liberarUnidad = async (asignacionId) => {
    await api.delete(`/incidentes/${id}/unidades/${asignacionId}`);
    cargar();
  };

  const secciones = ['Comando', 'Staff de Comando', 'Staff General'];

  return (
    <div className="vista">
      {aviso && <div className="aviso aviso-ok">{aviso}</div>}

      <div className="panel-cabecera">
        <div>
          <Link to="/incidentes" style={{ fontSize: 12 }}>← Volver a incidentes</Link>
          <h1 style={{ marginTop: 4 }}>{inc.titulo}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <span className="dato">{inc.codigo}</span>
            <InsigniaNivel nivel={inc.nivel_alerta} />
            <InsigniaEstado estado={inc.estado} />
            {inc.sci_activado && <span className="insignia insignia-acento">SCI activado</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {puede('reportes.generar') && (
            <>
              <button className="btn" onClick={() => descargarPdf(`/reportes/incidente/${id}`, `informe-${inc.codigo}.pdf`)}>
                Informe PDF
              </button>
              {inc.sci_activado && (
                <button className="btn" onClick={() => descargarPdf(`/reportes/sci/${id}`, `sci-${inc.codigo}.pdf`)}>
                  SCI en PDF
                </button>
              )}
            </>
          )}
          {puede('whatsapp.enviar') && (
            <button className="btn btn-whatsapp" onClick={() => setCompartir({
              lat: inc.lat, lng: inc.lng, titulo: inc.titulo,
              referencia: inc.direccion, nivel: inc.nivel_alerta, incidente_id: inc.id
            })}>Compartir ubicación</button>
          )}
        </div>
      </div>

      <div className="rejilla rejilla-2" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 18 }}>
        <div className="panel">
          <div className="panel-cabecera"><h3>Ficha del evento</h3></div>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px' }}>
            <Dato r="Tipo" v={inc.tipo.replace(/_/g, ' ')} />
            <Dato r="Personas afectadas" v={inc.afectados} />
            <Dato r="Latitud" v={Number(inc.lat).toFixed(6)} mono />
            <Dato r="Longitud" v={Number(inc.lng).toFixed(6)} mono />
            <Dato r="Referencia" v={inc.direccion || '—'} />
            <Dato r="Reportado por" v={inc.reportante || '—'} />
            <Dato r="Inicio" v={new Date(inc.fecha_inicio).toLocaleString('es-PE')} />
            <Dato r="Cierre" v={inc.fecha_cierre ? new Date(inc.fecha_cierre).toLocaleString('es-PE') : 'En curso'} />
          </dl>
          {inc.descripcion && (
            <>
              <div className="rotulo" style={{ marginTop: 16 }}>Descripción</div>
              <p style={{ marginTop: 5, color: 'var(--texto-suave)' }}>{inc.descripcion}</p>
            </>
          )}
        </div>

        <div className="panel" style={{ padding: 0, overflow: 'hidden', minHeight: 320 }}>
          <div style={{ height: 320 }}>
            <MapaOperativo
              centro={[Number(inc.lat), Number(inc.lng)]}
              zoom={15}
              incidentes={[inc]}
              posiciones={inc.ubicaciones || []}
              unidades={inc.unidades || []}
              mostrarLeyenda={false}
              alCompartirWhatsapp={puede('whatsapp.enviar') ? setCompartir : null}
            />
          </div>
        </div>
      </div>

      {/* -------- Estructura SCI -------- */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-cabecera">
          <div>
            <h3>Sistema de Comando de Incidentes</h3>
            <p style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
              Estructura organizacional del periodo operacional
            </p>
          </div>
          {puede('sci.gestionar') && (
            inc.sci_activado
              ? <button className="btn btn-peligro" onClick={desactivarSci}>Desactivar SCI</button>
              : <button className="btn btn-primario" onClick={activarSci}>Activar SCI</button>
          )}
        </div>

        {!inc.sci_activado ? (
          <div className="vacio">
            <h3>SCI no activado</h3>
            <p>Activa el Sistema de Comando de Incidentes para organizar la respuesta por puestos y objetivos.</p>
          </div>
        ) : (
          <>
            {secciones.map((seccion, idx) => {
              const puestos = (sci?.organigrama || []).filter(p => p.seccion === seccion);
              if (!puestos.length) return null;
              return (
                <div key={seccion}>
                  {idx > 0 && <div className="sci-conector" />}
                  <div className="rotulo" style={{ textAlign: 'center', marginBottom: 8 }}>{seccion}</div>
                  <div className="sci-nivel">
                    {puestos.map(p => (
                      <div key={p.clave}
                        className={`sci-tarjeta ${p.asignacion ? '' : 'vacante'}`}
                        style={{ '--color-puesto': COLOR_SECCION[seccion] }}>
                        <div className="sci-puesto">{p.nombre}</div>
                        {p.asignacion ? (
                          <>
                            <div className="sci-persona">{p.asignacion.personal || p.asignacion.usuario || 'Asignado'}</div>
                            {p.asignacion.telefono && <div className="sci-contacto">{p.asignacion.telefono}</div>}
                            {p.asignacion.notas && (
                              <div style={{ fontSize: 12, color: 'var(--texto-tenue)', marginTop: 5 }}>{p.asignacion.notas}</div>
                            )}
                            {puede('sci.gestionar') && (
                              <button className="btn btn-menudo" style={{ marginTop: 9 }}
                                onClick={() => liberarPuesto(p.clave)}>Liberar</button>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="sci-persona" style={{ color: 'var(--texto-tenue)' }}>Vacante</div>
                            {puede('sci.gestionar') && (
                              <button className="btn btn-menudo" style={{ marginTop: 9 }}
                                onClick={() => { setAsignando(p); setSeleccion({ personal_id: '', notas: '' }); }}>
                                Asignar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Objetivos operacionales */}
            <div style={{ marginTop: 26, borderTop: '1px solid var(--linea)', paddingTop: 18 }}>
              <div className="rotulo" style={{ marginBottom: 10 }}>Objetivos del periodo operacional</div>

              {(sci?.objetivos || []).length === 0
                ? <p style={{ color: 'var(--texto-tenue)', fontSize: 13 }}>Aún no se han definido objetivos.</p>
                : (sci.objetivos.map(o => (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--linea-suave)' }}>
                      <input type="checkbox" checked={!!o.cumplido} disabled={!puede('sci.gestionar')}
                        onChange={() => api.patch(`/sci/${id}/objetivos/${o.id}`).then(cargar)} />
                      <span className={`insignia insignia-${o.prioridad === 'alta' ? 'rojo' : o.prioridad === 'media' ? 'amarillo' : 'neutra'}`}>
                        {o.prioridad}
                      </span>
                      <span style={{ flex: 1, textDecoration: o.cumplido ? 'line-through' : 'none', color: o.cumplido ? 'var(--texto-tenue)' : 'inherit' }}>
                        {o.descripcion}
                      </span>
                      {puede('sci.gestionar') && (
                        <button className="btn btn-menudo"
                          onClick={() => api.delete(`/sci/${id}/objetivos/${o.id}`).then(cargar)}>Quitar</button>
                      )}
                    </div>
                  )))}

              {puede('sci.gestionar') && (
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  <input style={{ flex: 1, minWidth: 200, padding: '9px 11px', background: 'var(--tinta)', border: '1px solid var(--linea)', borderRadius: 4, color: 'var(--texto)' }}
                    placeholder="Nuevo objetivo operacional" value={objetivo.descripcion}
                    onChange={(e) => setObjetivo({ ...objetivo, descripcion: e.target.value })} />
                  <select value={objetivo.prioridad} onChange={(e) => setObjetivo({ ...objetivo, prioridad: e.target.value })}
                    style={{ padding: '9px 11px', background: 'var(--tinta)', border: '1px solid var(--linea)', borderRadius: 4, color: 'var(--texto)' }}>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                  <button className="btn btn-primario" onClick={agregarObjetivo}>Agregar</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* -------- Unidades asignadas -------- */}
      <div className="panel">
        <div className="panel-cabecera">
          <h3>Unidades desplegadas</h3>
          {puede('incidentes.editar') && unidades.length > 0 && (
            <select defaultValue="" onChange={(e) => e.target.value && asignarUnidad(e.target.value)}
              style={{ padding: '7px 10px', background: 'var(--tinta)', border: '1px solid var(--linea)', borderRadius: 4, color: 'var(--texto)' }}>
              <option value="">Asignar unidad disponible…</option>
              {unidades.map(u => <option key={u.id} value={u.id}>{u.codigo} · {u.tipo.replace(/_/g, ' ')}</option>)}
            </select>
          )}
        </div>

        {(inc.unidades || []).length === 0
          ? <div className="vacio">No hay unidades asignadas a este incidente.</div>
          : <div className="tabla-marco">
              <table>
                <thead><tr><th>Código</th><th>Tipo</th><th>Placa</th><th>Base</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {inc.unidades.map(u => (
                    <tr key={u.asignacion_id}>
                      <td className="dato">{u.codigo}</td>
                      <td style={{ textTransform: 'capitalize' }}>{u.tipo.replace(/_/g, ' ')}</td>
                      <td className="dato">{u.placa || '—'}</td>
                      <td>{u.base || '—'}</td>
                      <td><InsigniaEstado estado={u.estado} /></td>
                      <td className="acciones">
                        {puede('incidentes.editar') && (
                          <button className="btn btn-menudo" onClick={() => liberarUnidad(u.asignacion_id)}>Liberar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>

      <Modal abierto={!!asignando} titulo={`Asignar: ${asignando?.nombre || ''}`}
        onCerrar={() => setAsignando(null)}
        pie={<>
          <button className="btn" onClick={() => setAsignando(null)}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardarPuesto}>Asignar puesto</button>
        </>}>
        <div className="campo">
          <label htmlFor="p-sel">Personal acreditado</label>
          <select id="p-sel" value={seleccion.personal_id}
            onChange={(e) => setSeleccion({ ...seleccion, personal_id: e.target.value })}>
            <option value="">Seleccionar…</option>
            {personal.map(p => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.apellidos}, {p.nombres} — {p.especialidad || 'sin especialidad'}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="p-notas">Observaciones</label>
          <input id="p-notas" value={seleccion.notas}
            onChange={(e) => setSeleccion({ ...seleccion, notas: e.target.value })}
            placeholder="Frecuencia de radio, turno, relevo previsto" />
        </div>
      </Modal>

      <PanelWhatsapp datos={compartir} onCerrar={() => setCompartir(null)} />
    </div>
  );
}

function Dato({ r, v, mono }) {
  return (
    <div>
      <dt className="rotulo">{r}</dt>
      <dd className={mono ? 'coord' : ''} style={{ marginTop: 3, textTransform: mono ? 'none' : 'capitalize' }}>{v}</dd>
    </div>
  );
}
