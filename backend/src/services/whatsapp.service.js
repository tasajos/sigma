/**
 * Envío de coordenadas por WhatsApp.
 *
 * Modo "enlace" (por defecto): construye un enlace wa.me con el mensaje ya
 * redactado. No requiere credenciales ni costo; el operador confirma el envío
 * desde su propio WhatsApp. Es el modo recomendado para despliegues pequeños.
 *
 * Modo "api": usa la WhatsApp Cloud API de Meta para enviar sin intervención
 * humana. Requiere WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.
 */

function normalizarTelefono(numero) {
  return String(numero || '').replace(/[^\d]/g, '');
}

function formatearCoordenada(valor) {
  return Number(valor).toFixed(6);
}

/** Arma el texto operativo estándar que acompaña a una coordenada */
function componerMensaje({ titulo, lat, lng, referencia, nivel, incidente, reportadoPor, hora }) {
  const enlaceMapa = `https://www.openstreetmap.org/?mlat=${formatearCoordenada(lat)}&mlon=${formatearCoordenada(lng)}#map=17/${formatearCoordenada(lat)}/${formatearCoordenada(lng)}`;
  const lineas = [
    `*${titulo || 'REPORTE DE POSICIÓN'}*`,
    incidente ? `Incidente: ${incidente}` : null,
    nivel ? `Nivel de alerta: ${String(nivel).toUpperCase()}` : null,
    reportadoPor ? `Reportado por: ${reportadoPor}` : null,
    '',
    `Coordenadas: ${formatearCoordenada(lat)}, ${formatearCoordenada(lng)}`,
    referencia ? `Referencia: ${referencia}` : null,
    hora ? `Hora: ${hora}` : null,
    '',
    `Ver en el mapa: ${enlaceMapa}`
  ];
  return lineas.filter(Boolean).join('\n');
}

/** Genera el enlace wa.me listo para abrir */
function construirEnlace(destino, mensaje) {
  const numero = normalizarTelefono(destino);
  const texto = encodeURIComponent(mensaje);
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

/** Envío real vía WhatsApp Cloud API */
async function enviarPorApi(destino, mensaje) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw Object.assign(new Error('Faltan las credenciales de WhatsApp Cloud API en el archivo .env'), { status: 500 });
  }
  const respuesta = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizarTelefono(destino),
      type: 'text',
      text: { preview_url: true, body: mensaje }
    })
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw Object.assign(new Error(datos?.error?.message || 'WhatsApp rechazó el envío.'), { status: 502 });
  }
  return datos;
}

/** Envío de la ubicación como mensaje nativo de tipo location */
async function enviarUbicacionPorApi(destino, { lat, lng, nombre, direccion }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const respuesta = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizarTelefono(destino),
      type: 'location',
      location: { latitude: Number(lat), longitude: Number(lng), name: nombre || 'Posición reportada', address: direccion || '' }
    })
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw Object.assign(new Error(datos?.error?.message || 'Error al enviar la ubicación.'), { status: 502 });
  return datos;
}

module.exports = { componerMensaje, construirEnlace, enviarPorApi, enviarUbicacionPorApi, normalizarTelefono };
