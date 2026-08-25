# SIGMA-SCI · Sistema de monitoreo ante eventos adversos, alarma y notificación

Plataforma web para centros de operaciones de emergencia. Permite que los actores en
campo transmitan su ubicación al centro de monitoreo, marcarla en un mapa con tres capas,
activar el Sistema de Comando de Incidentes (SCI), escalar niveles de alerta, notificar a
la prensa, enviar coordenadas por WhatsApp y exportar informes en PDF con estilos.

**No se utiliza Google Maps.** La cartografía se basa en Leaflet con proveedores de teselas
gratuitos y sin clave de API.

---

## 1. Requisitos solicitados y dónde se cumplen

| # | Requisito | Implementación |
|---|-----------|----------------|
| 1 | Frontend en React + Vite | `frontend/` — React 18, Vite 5, React Router 6 |
| 2 | Backend en Node.js | `backend/` — Express 4, Socket.IO, JWT |
| 3 | Motor de base de datos MySQL | `backend/db/schema.sql` — MySQL 8, InnoDB, utf8mb4 |
| 4 | División clara en carpetas frontend y backend | Carpetas independientes con su propio `package.json` y `.env` |
| 5 | Actores en campo envían su ubicación al monitoreo | `POST /api/ubicaciones` desde la pantalla **Enviar mi posición** (`pages/Campo.jsx`), con envío puntual o automático cada minuto |
| 6 | Marcado en un mapa que no sea Google Maps y sea gratuito | Leaflet + react-leaflet (`components/MapaOperativo.jsx`) |
| 7 | Mapa con 3 capas: satélite, roadmap y street | Satélite (Esri World Imagery), Roadmap (CARTO Voyager) y Calles (OpenStreetMap), conmutables desde el selector superior derecho |
| 8 | 5 perfiles independientes entre sí | `administrador`, `rescatista`, `operaciones`, `logistica`, `comunicaciones` — matriz de permisos en `backend/src/config/roles.js` |
| 9 | Acceso mediante login | JWT con bcrypt; `pages/Login.jsx` + `POST /api/auth/login` |
| 10 | Registro de personal de emergencias | Tabla `personal_emergencia`, módulo **Personal** con alta, edición y baja |
| 11 | Registro de unidades operativas | Tabla `unidades_operativas`, módulo **Unidades operativas** con mapa de bases |
| 12 | Habilitar un SCI | Activación por incidente, 8 puestos del organigrama y objetivos del periodo operacional (`pages/IncidenteDetalle.jsx`) |
| 13 | Generar informes y exportarlos en PDF con estilos | 6 reportes con PDFKit (`services/pdf.service.js`): encabezado institucional, franja de nivel, tarjetas de indicadores, tablas con filas alternadas y pie numerado |
| 14 | Responsive | Puntos de corte en 1100 / 820 / 480 px; menú lateral deslizable en móvil |
| 15 | El personal rescatista debe poder registrarse | Autorregistro público en `/registro`; la cuenta queda **pendiente** hasta que un administrador la apruebe |
| 16 | Niveles de alerta para enviar informes a la prensa | Verde / Amarillo / Naranja / Rojo; la publicación a prensa se habilita en naranja y rojo |
| 17 | Marcar en el mapa las posiciones enviadas por los rescatistas | Marcadores en vivo por Socket.IO, con color según estado y pulso en emergencia |
| 18 | Enviar esas coordenadas por WhatsApp | Modo enlace (`wa.me`, sin credenciales) o modo API (WhatsApp Cloud API de Meta) |
| 19 | README con todas las solicitudes | Este documento |

---

## 2. Estructura del proyecto

```
sci-monitoreo/
├── README.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── db/
│   │   ├── schema.sql          Estructura completa de la base de datos
│   │   └── seed.sql            Roles y catálogo inicial
│   └── src/
│       ├── server.js           Arranque de Express + Socket.IO
│       ├── config/
│       │   ├── db.js           Pool de conexiones MySQL
│       │   └── roles.js        Perfiles y matriz de permisos
│       ├── middleware/
│       │   ├── auth.js         Verificación JWT y control por permiso
│       │   └── errores.js      404 y manejador central de errores
│       ├── controllers/        auth, usuarios, personal, unidades,
│       │                       incidentes, sci, ubicaciones, alertas,
│       │                       prensa, whatsapp, reportes
│       ├── services/
│       │   ├── pdf.service.js  Motor de maquetación de los PDF
│       │   └── whatsapp.service.js
│       ├── sockets/            Canal en tiempo real autenticado
│       ├── routes/             Definición de todos los endpoints
│       └── utils/
│           ├── bitacora.js     Auditoría de acciones
│           └── seedUsuarios.js Usuarios demo con contraseña hasheada
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx             Rutas y protección por permiso
        ├── api/
        │   ├── client.js       Cliente HTTP + descarga de PDF
        │   └── socket.js       Cliente Socket.IO
        ├── context/
        │   └── AuthContext.jsx Sesión y permisos
        ├── components/
        │   ├── Layout.jsx      Navegación por perfil y franja de nivel
        │   ├── MapaOperativo.jsx
        │   ├── PanelWhatsapp.jsx
        │   ├── RutaProtegida.jsx
        │   ├── Modal.jsx
        │   └── Insignia.jsx
        ├── pages/              Login, Registro, Tablero, Mapa, Campo,
        │                       Incidentes, IncidenteDetalle, Personal,
        │                       Unidades, Alertas, Prensa, Whatsapp,
        │                       Reportes, Usuarios, Bitacora
        └── styles/
            └── global.css      Sistema de diseño
```

---

## 3. Instalación

### Requisitos previos

- Node.js 18 o superior
- MySQL 8.0 o superior

### Paso 1 — Base de datos

```bash
cd backend/db
mysql -u root -p < schema.sql
mysql -u root -p sigma_sci < seed.sql
```

### Paso 2 — Backend

```bash
cd backend
cp .env.example .env       # edita DB_PASSWORD y JWT_SECRET
npm install
npm run seed               # crea los 5 usuarios de demostración
npm run dev                # http://localhost:4000
```

### Paso 3 — Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:5173
```

### Usuarios de demostración

Contraseña para todos: `Sigma2026*`

| Correo | Perfil |
|--------|--------|
| `admin@sigma.gob` | administrador |
| `rescatista@sigma.gob` | rescatista |
| `operaciones@sigma.gob` | operaciones |
| `logistica@sigma.gob` | logística |
| `comunicaciones@sigma.gob` | comunicaciones |

> Cambia estas credenciales antes de cualquier despliegue real.

---

## 4. Perfiles y permisos

Cada perfil es independiente: no hay herencia entre roles. La matriz vive en
`backend/src/config/roles.js` y se replica en `frontend/src/context/AuthContext.jsx`
para ocultar del menú lo que el usuario no puede usar. El backend siempre vuelve a
validar, de modo que ocultar un botón nunca es la única defensa.

| Módulo | Admin | Rescatista | Operaciones | Logística | Comunicaciones |
|--------|:-----:|:----------:|:-----------:|:---------:|:--------------:|
| Tablero | ✔ | ✔ | ✔ | ✔ | ✔ |
| Mapa operativo | ✔ | — | ✔ | ✔ | ✔ |
| Enviar posición | ✔ | ✔ | ✔ | — | — |
| Ver incidentes | ✔ | ✔ | ✔ | ✔ | ✔ |
| Crear y editar incidentes | ✔ | — | ✔ | — | — |
| Gestionar SCI | ✔ | — | ✔ | — | — |
| Personal (ver / editar) | ✔ / ✔ | — | ✔ / — | ✔ / ✔ | — |
| Unidades (ver / editar) | ✔ / ✔ | — | ✔ / — | ✔ / ✔ | — |
| Emitir alertas | ✔ | — | ✔ | — | ✔ |
| Boletines de prensa | ✔ | — | — | — | ✔ |
| WhatsApp | ✔ | — | ✔ | — | ✔ |
| Reportes PDF | ✔ | — | ✔ | ✔ | ✔ |
| Usuarios y bitácora | ✔ | — | — | — | — |

---

## 5. Mapa y capas

`components/MapaOperativo.jsx` expone tres capas base conmutables:

| Capa | Proveedor | Uso |
|------|-----------|-----|
| **Satélite** | Esri World Imagery + capa de etiquetas | Reconocimiento del terreno y daños |
| **Roadmap** | CARTO Voyager | Vista general de la ciudad |
| **Calles** | OpenStreetMap estándar | Detalle de vías y accesos |

Elementos representados:

- **Incidentes** — rombo con el color del nivel de alerta y un círculo de influencia cuyo
  radio crece con la gravedad (250 m verde/amarillo, 500 m naranja, 800 m rojo).
- **Personal en campo** — marcador con la inicial del perfil, coloreado por estado
  (disponible, en movimiento, en escena, emergencia). El estado de emergencia pulsa.
- **Unidades operativas** — marcador rectangular en la base o posición registrada.
- **Punto seleccionado** — al hacer clic en el mapa durante el alta de un incidente.

Cada popup incluye las coordenadas en formato decimal y, para quien tenga el permiso,
un botón para compartirlas por WhatsApp.

---

## 6. Envío de ubicación desde campo

La pantalla **Enviar mi posición** usa la API de geolocalización del navegador con
`enableHighAccuracy`. El rescatista puede:

- leer su ubicación y verla en el mapa antes de enviarla;
- declarar su estado operativo y una nota corta para el centro;
- asociar el envío a un incidente activo;
- transmitir una sola vez o activar el envío automático cada minuto;
- marcar estado **emergencia**, que dispara el evento `ubicacion:emergencia` y destaca su
  marcador en el mapa del centro de monitoreo.

Los eventos en tiempo real que viajan por Socket.IO son: `ubicacion:nueva`,
`ubicacion:emergencia`, `incidente:nuevo`, `incidente:actualizado`, `alerta:nueva`,
`alerta:nivel`, `sci:activado`, `sci:actualizado`, `unidad:asignada` y `prensa:publicado`.

---

## 7. Niveles de alerta

| Nivel | Significado operativo |
|-------|----------------------|
| **Verde** | Vigilancia. Sin despliegue de recursos. |
| **Amarillo** | Preparación. Unidades en alistamiento y personal notificado. |
| **Naranja** | Respuesta. Despliegue en terreno y activación del SCI. |
| **Rojo** | Emergencia mayor. Notificación a prensa y autoridades. |

El nivel más alto entre los incidentes activos se convierte en el **nivel global**, que
pinta la franja diagonal presente en la parte superior de toda la sesión. Cada cambio de
nivel genera automáticamente una entrada en el historial de alertas.

La publicación de boletines a prensa se habilita en **naranja** y **rojo**; en niveles
inferiores el sistema pide una confirmación explícita antes de difundir.

---

## 8. Sistema de Comando de Incidentes

Se activa por incidente desde su ficha de detalle. Organigrama en tres secciones:

- **Comando** — Comandante del Incidente
- **Staff de Comando** — Oficial de Seguridad, Oficial de Información Pública, Oficial de Enlace
- **Staff General** — Jefes de Operaciones, Planificación, Logística y Administración/Finanzas

Cada puesto se asigna a personal acreditado del registro y admite observaciones (frecuencia
de radio, turno, relevo previsto). La ficha incluye además los objetivos del periodo
operacional con prioridad y seguimiento de cumplimiento, y todo puede exportarse en PDF.

---

## 9. Reportes en PDF

Generados con PDFKit en el servidor. Todos comparten la identidad visual del sistema:
banda superior con la marca institucional, franja del nivel de alerta, sello del nivel,
tarjetas de indicadores, tablas con encabezado sólido y filas alternadas, y pie con
numeración de páginas.

| Reporte | Endpoint |
|---------|----------|
| Informe situacional de incidente | `GET /api/reportes/incidente/:id` |
| Estructura SCI del incidente | `GET /api/reportes/sci/:id` |
| Boletín oficial de prensa | `GET /api/reportes/prensa/:id` |
| Nómina de personal de emergencias | `GET /api/reportes/personal` |
| Inventario de unidades operativas | `GET /api/reportes/unidades` |
| Consolidado del periodo | `GET /api/reportes/consolidado?desde=&hasta=` |

---

## 10. Envío de coordenadas por WhatsApp

Dos modos, configurables con `WHATSAPP_MODO` en el `.env` del backend:

**Modo `enlace` (por defecto).** El servidor redacta el mensaje operativo y devuelve un
enlace `wa.me`; el navegador lo abre y el operador confirma el envío desde su propia
cuenta. No requiere credenciales ni costo.

**Modo `api`.** Usa la WhatsApp Cloud API de Meta y envía sin intervención humana: primero
el mensaje de texto y después la ubicación como mensaje nativo de tipo `location`.
Requiere `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`.

El mensaje generado incluye asunto, incidente asociado, nivel de alerta, quién reporta,
las coordenadas con seis decimales, la referencia en terreno, la hora y un enlace a
OpenStreetMap. Todos los envíos quedan registrados en `notificaciones_whatsapp`.

Puntos desde donde se puede compartir: popup de un incidente en el mapa, popup de una
posición reportada, ficha de detalle del incidente y el módulo **Avisos por WhatsApp**,
que además ofrece difusión a varios destinos.

---

## 11. API

Todas las rutas cuelgan de `/api` y, salvo login y registro, exigen la cabecera
`Authorization: Bearer <token>`.

**Autenticación**
```
POST   /auth/login              Iniciar sesión
POST   /auth/registro           Autorregistro de rescatista (público)
GET    /auth/perfil             Datos del usuario en sesión
PUT    /auth/password           Cambio de contraseña propia
```

**Usuarios y auditoría** (administrador)
```
GET    /usuarios                POST   /usuarios
PUT    /usuarios/:id            PATCH  /usuarios/:id/estado
PATCH  /usuarios/:id/password   DELETE /usuarios/:id
GET    /roles                   GET    /bitacora
```

**Personal y unidades**
```
GET|POST     /personal          GET|PUT|DELETE /personal/:id
GET|POST     /unidades          PUT|DELETE     /unidades/:id
```

**Incidentes**
```
GET    /incidentes              POST   /incidentes
GET    /incidentes/:id          PUT    /incidentes/:id
PATCH  /incidentes/:id/nivel    DELETE /incidentes/:id
POST   /incidentes/:id/unidades
DELETE /incidentes/:id/unidades/:asignacionId
```

**SCI**
```
GET    /sci/puestos             GET    /sci/:incidenteId
POST   /sci/:incidenteId/activar
POST   /sci/:incidenteId/desactivar
PUT    /sci/:incidenteId/puesto
DELETE /sci/:incidenteId/puesto/:puesto
POST   /sci/:incidenteId/objetivos
PATCH  /sci/:incidenteId/objetivos/:objetivoId
DELETE /sci/:incidenteId/objetivos/:objetivoId
```

**Ubicaciones, alertas, prensa y WhatsApp**
```
POST   /ubicaciones             GET    /ubicaciones/actuales
GET    /ubicaciones/mias        GET    /ubicaciones/historial/:usuarioId
GET    /alertas                 POST   /alertas
GET    /alertas/niveles         GET    /alertas/resumen
GET|POST /prensa                GET|PUT|DELETE /prensa/:id
POST   /prensa/:id/publicar
POST   /whatsapp/coordenadas    POST   /whatsapp/difusion
GET    /whatsapp/historial
```

---

## 12. Modelo de datos

| Tabla | Contenido |
|-------|-----------|
| `roles` | Los cinco perfiles del sistema |
| `usuarios` | Cuentas de acceso, con estado pendiente/activo/suspendido |
| `personal_emergencia` | Registro del personal acreditado |
| `unidades_operativas` | Inventario de vehículos y equipos |
| `incidentes` | Eventos adversos con posición y nivel de alerta |
| `sci_estructura` | Puestos SCI asignados por incidente |
| `sci_objetivos` | Objetivos del periodo operacional |
| `asignaciones_unidad` | Unidades desplegadas a cada incidente |
| `ubicaciones` | Historial de posiciones enviadas desde campo |
| `alertas` | Avisos emitidos con nivel y canal |
| `boletines_prensa` | Comunicados oficiales |
| `notificaciones_whatsapp` | Registro de coordenadas compartidas |
| `bitacora` | Auditoría de acciones |

La vista `v_ultima_ubicacion` resuelve en una consulta la última posición conocida de cada
actor, que es lo que alimenta el mapa operativo.

---

## 13. Diseño de la interfaz

Base azul petróleo propia de sala de operaciones, tipografía condensada de señalética
(Barlow Condensed) para rótulos y controles, IBM Plex Sans para lectura e IBM Plex Mono
para todo dato operativo: coordenadas, códigos, placas y marcas de tiempo.

El elemento identitario es la **franja de nivel**: una banda diagonal de peligro que corona
la aplicación y que cambia de color con el nivel de alerta global. Está siempre visible, de
modo que el estado de la operación se lee sin entrar a ninguna pantalla.

Responsive en tres cortes: en 1100 px las rejillas de cuatro columnas pasan a dos; en
820 px el menú lateral se vuelve deslizable y las rejillas quedan en una columna; en 480 px
se compactan indicadores y botones. Se respeta `prefers-reduced-motion` y el foco de
teclado es siempre visible.

---

## 14. Seguridad

- Contraseñas con bcrypt (10 rondas); nunca se devuelven al cliente.
- JWT firmado con expiración configurable (8 h por defecto).
- Limitador de intentos en `/auth/login`: 20 intentos por IP cada 10 minutos.
- Helmet, CORS restringido por origen y compresión de respuestas.
- Consultas siempre parametrizadas con `mysql2` — sin concatenación de SQL.
- Autorización doble: el menú oculta lo no permitido y el backend revalida cada petición.
- Socket.IO autentica el token en el handshake; sin token no hay canal.
- Bitácora con usuario, acción, entidad, detalle e IP.
- Las cuentas autorregistradas nacen **pendientes** y no pueden iniciar sesión hasta que un
  administrador las apruebe.

### Antes de producción

1. Sustituye `JWT_SECRET` por una cadena larga y aleatoria.
2. Cambia las contraseñas de los usuarios demo o elimínalos.
3. Sirve todo por HTTPS.
4. Crea un usuario MySQL con privilegios acotados a `sigma_sci`.
5. Ajusta `CORS_ORIGIN` al dominio real.
6. Programa respaldos de la base de datos.

---

## 15. Despliegue

**Backend**
```bash
cd backend
npm ci --omit=dev
NODE_ENV=production npm start        # o pm2 start src/server.js --name sigma-api
```

**Frontend**
```bash
cd frontend
npm ci && npm run build              # genera dist/
```

Publica `dist/` en Nginx, Apache o cualquier CDN, con reescritura a `index.html` para que
funcionen las rutas del enrutador. Ejemplo mínimo en Nginx:

```nginx
location / {
  root /var/www/sigma/dist;
  try_files $uri $uri/ /index.html;
}
location /api/ {
  proxy_pass http://127.0.0.1:4000;
}
location /socket.io/ {
  proxy_pass http://127.0.0.1:4000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

---

## 16. Solución de problemas

| Síntoma | Causa probable y solución |
|---------|---------------------------|
| `ER_ACCESS_DENIED_ERROR` al arrancar la API | Credenciales incorrectas en `backend/.env` |
| El login responde 403 «registro en revisión» | La cuenta está pendiente; apruébala desde **Usuarios y perfiles** |
| El mapa aparece en gris | Falta la hoja de estilos de Leaflet en `index.html` o no hay salida a internet para las teselas |
| No se obtiene la ubicación | La geolocalización exige HTTPS salvo en `localhost`; revisa también el permiso del navegador |
| Los marcadores no se actualizan solos | Verifica el indicador «Enlace activo» de la barra superior y que `VITE_SOCKET_URL` apunte al backend |
| El PDF se descarga vacío | Revisa la consola del backend: suele ser un incidente inexistente o sin permiso |
| WhatsApp no abre | El navegador bloqueó la ventana emergente; usa el enlace que aparece en el aviso |

---

## 17. Licencia y atribuciones

Cartografía: © colaboradores de OpenStreetMap, © CARTO, imágenes de Esri, Maxar y
Earthstar Geographics. Las atribuciones se muestran en el propio mapa, tal como exigen sus
condiciones de uso.

Software entregado para fines operativos y académicos. Adáptalo a los protocolos y la
normativa de tu institución antes de usarlo en una emergencia real.
