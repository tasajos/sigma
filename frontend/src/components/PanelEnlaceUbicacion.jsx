import { useState } from 'react';
import Modal from './Modal';
import { api } from '../api/client';
import { IconoWhatsapp, IconoEnlace } from './Iconos';

/**
 * Genera un enlace público de ubicación para pedirle la posición a
 * CUALQUIER dispositivo (esté o no registrado como personal), y lo
 * entrega listo para enviar por WhatsApp.
 */
export default function PanelEnlaceUbicacion({ abierto, incidentes = [], onCerrar, onCreado }) {
  const [etiqueta, setEtiqueta] = useState('');
  const [telefono, setTelefono] = useState('');
  const [incidenteId, setIncidenteId] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const limpiarYCerrar = () => {
    setEtiqueta(''); setTelefono(''); setIncidenteId(''); setResultado(null); setError('');
    onCerrar?.();
  };

  const otroEnlace = () => {
    setEtiqueta(''); setTelefono(''); setIncidenteId(''); setResultado(null); setError('');
  };

  const crear = async () => {
    if (!etiqueta.trim()) { setError('Indica a quién corresponde este enlace.'); return; }
    setEnviando(true); setError('');
    try {
      const r = await api.post('/enlaces', {
        etiqueta: etiqueta.trim(), telefono: telefono || null, incidente_id: incidenteId || null
      });
      setResultado(r);
      onCreado?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo="Solicitar ubicación por enlace" onCerrar={limpiarYCerrar}
      pie={<>
        <button className="btn" onClick={limpiarYCerrar}>Cerrar</button>
        {!resultado && (
          <button className="btn btn-primario" onClick={crear} disabled={enviando}>
            <IconoEnlace size={14} />{enviando ? 'Generando…' : 'Generar enlace'}
          </button>
        )}
      </>}>

      {error && <div className="aviso aviso-error">{error}</div>}

      {resultado ? (
        <>
          <div className="aviso aviso-ok">
            Enlace generado. El destinatario lo abre, autoriza y su ubicación aparece en el mapa
            mientras la sesión siga activa.
          </div>
          <div className="campo">
            <label htmlFor="enl-url">Enlace de seguimiento</label>
            <input id="enl-url" readOnly value={resultado.url} onFocus={(e) => e.target.select()} />
          </div>
          <button
            className="btn btn-whatsapp btn-bloque"
            style={{ marginTop: 10 }}
            onClick={() => window.open(resultado.enlace_whatsapp, '_blank', 'noopener')}
          >
            <IconoWhatsapp size={15} />Enviar por WhatsApp
          </button>
          <button className="btn btn-bloque" style={{ marginTop: 8 }} onClick={otroEnlace}>
            <IconoEnlace size={14} />Generar otro enlace
          </button>
        </>
      ) : (
        <>
          <div className="campo">
            <label htmlFor="enl-etiqueta">¿A quién pertenece? (nombre o referencia)</label>
            <input id="enl-etiqueta" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="Testigo en la escena · Juan Pérez" />
            <div className="pista">No necesita estar registrado como personal ni tener una sesión en el sistema.</div>
          </div>

          <div className="campo">
            <label htmlFor="enl-telefono">Número de WhatsApp (opcional)</label>
            <input id="enl-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)}
              placeholder="+591 700 00000" />
            <div className="pista">Si lo dejas en blanco, WhatsApp te pedirá elegir el contacto.</div>
          </div>

          <div className="campo">
            <label htmlFor="enl-incidente">Incidente relacionado (opcional)</label>
            <select id="enl-incidente" value={incidenteId} onChange={(e) => setIncidenteId(e.target.value)}>
              <option value="">Sin asignar</option>
              {incidentes.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.titulo}</option>)}
            </select>
          </div>
        </>
      )}
    </Modal>
  );
}
