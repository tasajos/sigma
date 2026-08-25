import { useEffect, useState } from 'react';
import { api, descargarPdf } from '../api/client';

export default function Reportes() {
  const [incidentes, setIncidentes] = useState([]);
  const [seleccion, setSeleccion] = useState('');
  const [desde, setDesde] = useState(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));
  const [ocupado, setOcupado] = useState('');

  useEffect(() => { api.get('/incidentes').then(setIncidentes).catch(() => {}); }, []);

  const bajar = async (ruta, nombre, clave) => {
    setOcupado(clave);
    try { await descargarPdf(ruta, nombre); }
    catch (e) { alert(e.message); }
    finally { setOcupado(''); }
  };

  const incidenteElegido = incidentes.find(i => String(i.id) === seleccion);

  return (
    <div className="vista">
      <div className="rejilla rejilla-2">
        <div className="panel">
          <div className="panel-cabecera">
            <div>
              <h3>Informe situacional de incidente</h3>
              <p style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
                Ficha del evento, unidades desplegadas, posiciones y alertas.
              </p>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="inc">Incidente</label>
            <select id="inc" value={seleccion} onChange={(e) => setSeleccion(e.target.value)}>
              <option value="">Seleccionar incidente…</option>
              {incidentes.map(i => (
                <option key={i.id} value={i.id}>{i.codigo} · {i.titulo}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primario" disabled={!seleccion || ocupado === 'inc'}
              onClick={() => bajar(`/reportes/incidente/${seleccion}`, `informe-${incidenteElegido?.codigo}.pdf`, 'inc')}>
              {ocupado === 'inc' ? 'Generando…' : 'Descargar informe'}
            </button>
            <button className="btn" disabled={!seleccion || ocupado === 'sci'}
              onClick={() => bajar(`/reportes/sci/${seleccion}`, `sci-${incidenteElegido?.codigo}.pdf`, 'sci')}>
              {ocupado === 'sci' ? 'Generando…' : 'Descargar estructura SCI'}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-cabecera">
            <div>
              <h3>Consolidado del periodo</h3>
              <p style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
                Estadística de eventos, distribución por tipo y actividad de notificación.
              </p>
            </div>
          </div>
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="desde">Desde</label>
              <input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="hasta">Hasta</label>
              <input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primario" disabled={ocupado === 'con'}
            onClick={() => bajar(`/reportes/consolidado?desde=${desde}&hasta=${hasta}`, `consolidado-${desde}-${hasta}.pdf`, 'con')}>
            {ocupado === 'con' ? 'Generando…' : 'Descargar consolidado'}
          </button>
        </div>

        <div className="panel">
          <div className="panel-cabecera">
            <div>
              <h3>Nómina de personal</h3>
              <p style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
                Registro completo del personal acreditado con su estado y certificación.
              </p>
            </div>
          </div>
          <button className="btn btn-primario" disabled={ocupado === 'per'}
            onClick={() => bajar('/reportes/personal', 'nomina-personal.pdf', 'per')}>
            {ocupado === 'per' ? 'Generando…' : 'Descargar nómina'}
          </button>
        </div>

        <div className="panel">
          <div className="panel-cabecera">
            <div>
              <h3>Inventario de unidades</h3>
              <p style={{ fontSize: 12, color: 'var(--texto-tenue)' }}>
                Vehículos y equipos con su base, responsable y disponibilidad.
              </p>
            </div>
          </div>
          <button className="btn btn-primario" disabled={ocupado === 'uni'}
            onClick={() => bajar('/reportes/unidades', 'inventario-unidades.pdf', 'uni')}>
            {ocupado === 'uni' ? 'Generando…' : 'Descargar inventario'}
          </button>
        </div>
      </div>
    </div>
  );
}
