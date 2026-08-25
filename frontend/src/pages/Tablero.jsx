import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api/client';
import { obtenerSocket } from '../api/socket';
import { useAuth } from '../context/AuthContext';
import { InsigniaNivel, InsigniaEstado } from '../components/Insignia';
import MapaOperativo from '../components/MapaOperativo';

const COLOR = { verde: '#1F9D63', amarillo: '#E0A50B', naranja: '#E2601C', rojo: '#C42B2B' };

export default function Tablero() {
  const { puede } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [incidentes, setIncidentes] = useState([]);
  const [posiciones, setPosiciones] = useState([]);
  const [alertas, setAlertas] = useState([]);

  const cargar = async () => {
    const tareas = [api.get('/alertas/resumen'), api.get('/incidentes?estado=activo'), api.get('/alertas')];
    if (puede('ubicacion.monitorear')) tareas.push(api.get('/ubicaciones/actuales'));
    const [r, i, a, u] = await Promise.all(tareas.map(p => p.catch(() => null)));
    if (r) setResumen(r);
    if (i) setIncidentes(i);
    if (a) setAlertas(a.slice(0, 8));
    if (u) setPosiciones(u);
  };

  useEffect(() => {
    cargar();
    const s = obtenerSocket();
    if (!s) return;
    const refrescar = () => cargar();
    ['incidente:nuevo', 'incidente:actualizado', 'alerta:nueva', 'alerta:nivel', 'ubicacion:nueva']
      .forEach(ev => s.on(ev, refrescar));
    return () => ['incidente:nuevo', 'incidente:actualizado', 'alerta:nueva', 'alerta:nivel', 'ubicacion:nueva']
      .forEach(ev => s.off(ev, refrescar));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!resumen) return <div className="vista"><div className="panel vacio">Cargando el estado de la operación…</div></div>;

  const datosGrafico = (resumen.porTipo || []).map(t => ({
    tipo: t.tipo.replace(/_/g, ' '), total: Number(t.total)
  }));

  return (
    <div className="vista">
      <div className="rejilla rejilla-4" style={{ marginBottom: 18 }}>
        <Indicador valor={resumen.incidentes.activos || 0} rotulo="Incidentes activos" color="var(--rojo)" />
        <Indicador valor={resumen.campo.en_campo || 0} rotulo="Personal en campo (1 h)" color="var(--acento)" />
        <Indicador valor={resumen.unidades.disponibles || 0} rotulo="Unidades disponibles" color="var(--verde)" />
        <Indicador valor={resumen.incidentes.sci_activos || 0} rotulo="SCI activados" color="var(--naranja)" />
      </div>

      <div className="rejilla rejilla-2" style={{ gridTemplateColumns: '1.4fr 1fr', marginBottom: 18 }}>
        <div className="panel" style={{ padding: 0, overflow: 'hidden', minHeight: 380 }}>
          <div className="panel-cabecera" style={{ padding: '14px 18px', marginBottom: 0, borderBottom: '1px solid var(--linea)' }}>
            <h3>Situación geográfica</h3>
            <Link className="btn btn-menudo" to="/mapa">Abrir mapa completo</Link>
          </div>
          <div style={{ height: 340 }}>
            <MapaOperativo incidentes={incidentes} posiciones={posiciones} mostrarLeyenda={false} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-cabecera"><h3>Últimas alertas</h3></div>
          {alertas.length === 0
            ? <div className="vacio">Sin alertas registradas.</div>
            : <div className="linea-tiempo">
                {alertas.map(a => (
                  <div className="evento" key={a.id} style={{ '--color-evento': COLOR[a.nivel] }}>
                    <div className="evento-hora">{new Date(a.emitida_en).toLocaleString('es-PE')}</div>
                    <div className="evento-titulo">{a.titulo}</div>
                    <div className="evento-texto">{a.mensaje?.slice(0, 130)}</div>
                  </div>
                ))}
              </div>}
        </div>
      </div>

      <div className="rejilla rejilla-2">
        <div className="panel">
          <div className="panel-cabecera"><h3>Incidentes en curso</h3></div>
          {incidentes.length === 0
            ? <div className="vacio">No hay incidentes activos. La operación está en vigilancia.</div>
            : <div className="tabla-marco">
                <table>
                  <thead>
                    <tr><th>Código</th><th>Denominación</th><th>Nivel</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {incidentes.slice(0, 8).map(i => (
                      <tr key={i.id}>
                        <td className="dato">{i.codigo}</td>
                        <td><Link to={`/incidentes/${i.id}`}>{i.titulo}</Link></td>
                        <td><InsigniaNivel nivel={i.nivel_alerta} /></td>
                        <td><InsigniaEstado estado={i.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </div>

        <div className="panel">
          <div className="panel-cabecera"><h3>Eventos por tipo</h3></div>
          {datosGrafico.length === 0
            ? <div className="vacio">Aún no hay datos históricos.</div>
            : <ResponsiveContainer width="100%" height={260}>
                <BarChart data={datosGrafico} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid stroke="#2A3B49" horizontal={false} />
                  <XAxis type="number" stroke="#5A7186" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="tipo" stroke="#5A7186" fontSize={11} width={110} />
                  <Tooltip contentStyle={{ background: '#16232E', border: '1px solid #2A3B49', borderRadius: 4, color: '#DCE6ED' }} />
                  <Bar dataKey="total" fill="#0FA3B1" radius={[0, 3, 3, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>}
        </div>
      </div>
    </div>
  );
}

function Indicador({ valor, rotulo, color }) {
  return (
    <div className="indicador" style={{ '--color-indicador': color }}>
      <div className="indicador-valor">{valor}</div>
      <div className="indicador-rotulo">{rotulo}</div>
    </div>
  );
}
