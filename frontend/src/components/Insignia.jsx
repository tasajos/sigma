const MAPA_NIVEL = { verde: 'verde', amarillo: 'amarillo', naranja: 'naranja', rojo: 'rojo' };

const MAPA_ESTADO = {
  activo: 'rojo', controlado: 'amarillo', cerrado: 'neutra',
  disponible: 'verde', en_ruta: 'naranja', en_escena: 'amarillo',
  mantenimiento: 'neutra', fuera_servicio: 'neutra',
  pendiente: 'amarillo', suspendido: 'rojo',
  descanso: 'amarillo', baja: 'neutra',
  borrador: 'neutra', aprobado: 'acento', publicado: 'verde',
  emergencia: 'rojo', en_movimiento: 'acento'
};

export function InsigniaNivel({ nivel }) {
  return <span className={`insignia insignia-${MAPA_NIVEL[nivel] || 'neutra'}`}>{String(nivel || '').toUpperCase()}</span>;
}

export function InsigniaEstado({ estado }) {
  const tono = MAPA_ESTADO[estado] || 'neutra';
  return <span className={`insignia insignia-${tono}`}>{String(estado || '').replace(/_/g, ' ')}</span>;
}

export default InsigniaEstado;
