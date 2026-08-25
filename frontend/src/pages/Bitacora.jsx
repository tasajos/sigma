import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Bitacora() {
  const [lista, setLista] = useState([]);
  useEffect(() => { api.get('/bitacora').then(setLista).catch(() => {}); }, []);

  return (
    <div className="vista">
      <div className="panel" style={{ padding: 0 }}>
        {lista.length === 0
          ? <div className="vacio">Sin movimientos registrados.</div>
          : <div className="tabla-marco" style={{ border: 'none' }}>
              <table>
                <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr></thead>
                <tbody>
                  {lista.map(b => (
                    <tr key={b.id}>
                      <td className="dato">{new Date(b.creado_en).toLocaleString('es-PE')}</td>
                      <td>{b.usuario || 'Sistema'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{b.accion.replace(/_/g, ' ')}</td>
                      <td className="dato">{b.entidad}{b.entidad_id ? ` #${b.entidad_id}` : ''}</td>
                      <td style={{ color: 'var(--texto-suave)' }}>{b.detalle || '—'}</td>
                      <td className="dato">{b.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </div>
  );
}
