import { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../api/client';

/**
 * Compone y envía coordenadas por WhatsApp.
 * En modo "enlace" abre WhatsApp con el mensaje ya redactado;
 * en modo "api" el backend lo despacha directamente.
 */
export default function PanelWhatsapp({ datos, onCerrar }) {
  const [destino, setDestino] = useState('');
  const [titulo, setTitulo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (datos) {
      setTitulo(datos.titulo || 'Reporte de posición');
      setReferencia(datos.referencia || '');
      setResultado(null); setError('');
    }
  }, [datos]);

  if (!datos) return null;

  const enviar = async () => {
    setEnviando(true); setError('');
    try {
      const r = await api.post('/whatsapp/coordenadas', {
        destino, lat: datos.lat, lng: datos.lng, titulo, referencia,
        nivel: datos.nivel, incidente_id: datos.incidente_id
      });
      setResultado(r);
      if (r.enlace) window.open(r.enlace, '_blank', 'noopener');
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto titulo="Enviar coordenadas por WhatsApp" onCerrar={onCerrar}
      pie={<>
        <button className="btn" onClick={onCerrar}>Cerrar</button>
        <button className="btn btn-whatsapp" onClick={enviar} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar por WhatsApp'}
        </button>
      </>}>

      {error && <div className="aviso aviso-error">{error}</div>}
      {resultado && (
        <div className="aviso aviso-ok">
          {resultado.modo === 'api'
            ? 'Mensaje entregado a WhatsApp.'
            : 'Se abrió WhatsApp con el mensaje listo. Si el navegador bloqueó la ventana, usa el enlace de abajo.'}
          {resultado.enlace && <> <a href={resultado.enlace} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></>}
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16, background: 'var(--tinta)' }}>
        <div className="rotulo">Coordenadas a compartir</div>
        <div className="coord" style={{ fontSize: 16, marginTop: 6 }}>
          {Number(datos.lat).toFixed(6)}, {Number(datos.lng).toFixed(6)}
        </div>
      </div>

      <div className="campo">
        <label htmlFor="wa-destino">Número de destino</label>
        <input id="wa-destino" className="dato" value={destino} placeholder="+51999888777"
          onChange={(e) => setDestino(e.target.value)} />
        <div className="pista">Incluye el código de país. Si lo dejas en blanco, WhatsApp te pedirá elegir el contacto.</div>
      </div>

      <div className="campo">
        <label htmlFor="wa-titulo">Asunto del mensaje</label>
        <input id="wa-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>

      <div className="campo">
        <label htmlFor="wa-ref">Referencia en terreno</label>
        <input id="wa-ref" value={referencia} placeholder="Frente al colegio, portón azul"
          onChange={(e) => setReferencia(e.target.value)} />
      </div>

      {resultado?.mensaje && (
        <div className="campo">
          <label>Mensaje generado</label>
          <textarea readOnly value={resultado.mensaje} style={{ minHeight: 140, fontFamily: 'var(--dato)', fontSize: 12 }} />
        </div>
      )}
    </Modal>
  );
}
