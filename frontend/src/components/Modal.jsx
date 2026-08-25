import { useEffect } from 'react';

export default function Modal({ abierto, titulo, onCerrar, children, pie, ancho }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar?.();
    if (abierto) document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div className="modal" style={ancho ? { maxWidth: ancho } : undefined} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cabecera">
          <h3>{titulo}</h3>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">&times;</button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  );
}
