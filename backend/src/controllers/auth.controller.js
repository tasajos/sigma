const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { ROLES } = require('../config/roles');

function firmarToken(u) {
  return jwt.sign(
    { id: u.id, email: u.email, rol: u.rol, nombres: u.nombres, apellidos: u.apellidos },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '8h' }
  );
}

/** POST /api/auth/login */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Ingresa tu correo y contraseña.' });
  }

  const [filas] = await pool.query(
    `SELECT u.*, r.nombre AS rol FROM usuarios u
     JOIN roles r ON r.id = u.rol_id WHERE u.email = ? LIMIT 1`,
    [email.toLowerCase().trim()]
  );
  const usuario = filas[0];
  if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  if (usuario.estado === 'pendiente') {
    return res.status(403).json({ error: 'Tu registro está en revisión. Un administrador debe aprobarlo.' });
  }
  if (usuario.estado === 'suspendido') {
    return res.status(403).json({ error: 'Esta cuenta está suspendida. Contacta al administrador.' });
  }

  await pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [usuario.id]);

  res.json({
    token: firmarToken(usuario),
    usuario: {
      id: usuario.id, nombres: usuario.nombres, apellidos: usuario.apellidos,
      email: usuario.email, telefono: usuario.telefono, rol: usuario.rol
    }
  });
}

/** POST /api/auth/registro  — autorregistro público de rescatistas */
async function registroRescatista(req, res) {
  const {
    nombres, apellidos, email, password, telefono,
    documento, tipo_sangre, institucion, especialidad,
    nivel_certificacion, contacto_emergencia, telefono_emergencia
  } = req.body;

  if (!nombres || !apellidos || !email || !password || !documento) {
    return res.status(400).json({ error: 'Nombres, apellidos, correo, contraseña y documento son obligatorios.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[rol]] = await conn.query('SELECT id FROM roles WHERE nombre = ?', [ROLES.RESCATE]);
    const hash = await bcrypt.hash(password, 10);

    const [resUsuario] = await conn.query(
      `INSERT INTO usuarios (nombres, apellidos, email, password_hash, telefono, rol_id, estado)
       VALUES (?,?,?,?,?,?, 'pendiente')`,
      [nombres.trim(), apellidos.trim(), email.toLowerCase().trim(), hash, telefono || null, rol.id]
    );

    const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM personal_emergencia');
    const codigo = 'P-' + String(total + 1).padStart(4, '0');

    await conn.query(
      `INSERT INTO personal_emergencia
        (usuario_id, codigo, nombres, apellidos, documento, tipo_sangre, telefono,
         contacto_emergencia, telefono_emergencia, institucion, especialidad, nivel_certificacion, estado)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'activo')`,
      [resUsuario.insertId, codigo, nombres.trim(), apellidos.trim(), documento, tipo_sangre || null,
       telefono || null, contacto_emergencia || null, telefono_emergencia || null,
       institucion || null, especialidad || null, nivel_certificacion || 'basico']
    );

    await conn.commit();
    res.status(201).json({
      mensaje: 'Registro recibido. Un administrador revisará tu solicitud antes de habilitar el acceso.',
      codigo
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** GET /api/auth/perfil */
async function perfil(req, res) {
  const [filas] = await pool.query(
    `SELECT u.id, u.nombres, u.apellidos, u.email, u.telefono, u.estado, u.ultimo_acceso,
            r.nombre AS rol, p.codigo AS codigo_personal, p.especialidad, p.tipo_sangre
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     LEFT JOIN personal_emergencia p ON p.usuario_id = u.id
     WHERE u.id = ?`, [req.usuario.id]
  );
  if (!filas.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json(filas[0]);
}

/** PUT /api/auth/password */
async function cambiarPassword(req, res) {
  const { actual, nueva } = req.body;
  if (!actual || !nueva || nueva.length < 8) {
    return res.status(400).json({ error: 'Indica tu contraseña actual y una nueva de al menos 8 caracteres.' });
  }
  const [[u]] = await pool.query('SELECT password_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
  if (!(await bcrypt.compare(actual, u.password_hash))) {
    return res.status(401).json({ error: 'La contraseña actual no coincide.' });
  }
  await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?',
    [await bcrypt.hash(nueva, 10), req.usuario.id]);
  res.json({ mensaje: 'Contraseña actualizada.' });
}

module.exports = { login, registroRescatista, perfil, cambiarPassword };
