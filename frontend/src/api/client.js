const BASE = import.meta.env.VITE_API_URL || '/api';

function token() { return localStorage.getItem('sigma_token'); }

async function pedir(ruta, opciones = {}) {
  const cabeceras = { ...(opciones.headers || {}) };
  if (!(opciones.body instanceof FormData)) cabeceras['Content-Type'] = 'application/json';
  const t = token();
  if (t) cabeceras.Authorization = `Bearer ${t}`;

  const respuesta = await fetch(`${BASE}${ruta}`, { ...opciones, headers: cabeceras });

  if (respuesta.status === 401) {
    localStorage.removeItem('sigma_token');
    localStorage.removeItem('sigma_usuario');
    if (!location.pathname.startsWith('/acceso')) location.href = '/acceso';
    throw new Error('La sesión expiró. Vuelve a iniciar sesión.');
  }

  const tipo = respuesta.headers.get('content-type') || '';
  if (tipo.includes('application/pdf')) return respuesta.blob();

  const datos = tipo.includes('application/json') ? await respuesta.json() : null;
  if (!respuesta.ok) throw new Error(datos?.error || 'No se pudo completar la operación.');
  return datos;
}

export const api = {
  get:    (r)     => pedir(r),
  post:   (r, d)  => pedir(r, { method: 'POST',   body: JSON.stringify(d ?? {}) }),
  put:    (r, d)  => pedir(r, { method: 'PUT',    body: JSON.stringify(d ?? {}) }),
  patch:  (r, d)  => pedir(r, { method: 'PATCH',  body: JSON.stringify(d ?? {}) }),
  delete: (r)     => pedir(r, { method: 'DELETE' })
};

/** Descarga un PDF y dispara la ventana de guardado del navegador */
export async function descargarPdf(ruta, nombreArchivo) {
  const blob = await pedir(ruta);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
