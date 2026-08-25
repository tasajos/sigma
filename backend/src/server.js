require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const rutas = require('./routes');
const { probarConexion } = require('./config/db');
const { inicializar } = require('./sockets');
const { noEncontrado, manejadorErrores } = require('./middleware/errores');

const app = express();
const PUERTO = Number(process.env.PORT || 4000);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','), credentials: true }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Protección de fuerza bruta en el acceso
app.use('/api/auth/login', rateLimit({
  windowMs: 10 * 60 * 1000, max: 20,
  message: { error: 'Demasiados intentos. Espera 10 minutos antes de volver a intentarlo.' }
}));

app.get('/api/salud', (req, res) => res.json({ estado: 'operativo', hora: new Date().toISOString() }));
app.use('/api', rutas);
app.use(noEncontrado);
app.use(manejadorErrores);

const servidor = http.createServer(app);
inicializar(servidor);

(async () => {
  try {
    await probarConexion();
    console.log('[db] conexión establecida con MySQL');
  } catch (e) {
    console.error('[db] no se pudo conectar a MySQL:', e.message);
  }
  servidor.listen(PUERTO, () => {
    console.log(`\n  SIGMA-SCI · API operativa en http://localhost:${PUERTO}`);
    console.log(`  Canal en tiempo real activo (Socket.IO)\n`);
  });
})();
