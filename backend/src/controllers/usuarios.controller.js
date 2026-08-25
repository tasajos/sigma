const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { registrar } = require('../utils/bitacora');

async function listar(req, res) {
  const [filas] = await pool.query(
    `SELECT u.id, u.nombres, u.apellidos, u.email, u.telefono, u.estado,
            u.ultimo_acceso, u.creado_en, r.nombre AS rol
     FROM usuarios u JOIN roles r ON r.id = u.rol_id
     ORDER BY FIELD(u.estado,'pendiente','activo','suspendido'), u.creado_en DESC`
  );
  res.json(filas);
}

async function listarRoles(req, res) {
  const [filas] = await pool.query('SELECT id, nombre, descripcion FROM roles ORDER BY id');
  res.json(filas);
}

async function crear(req, res) {
  const { nombres, apellidos, email, password, telefono, rol_id, estado } = req.body;
  if (!nombres || !apellidos || !email || !password || !rol_id) {
    return res.status(400).json({ error: 'Completa nombres, apellidos, correo, contraseña y perfil.' });
  }
  const hash = await bcrypt.hash(password, 10);
  const [r] = await pool.query(
    `INSERT INTO usuarios (nombres, apellidos, email, password_hash, telefono, rol_id, estado)
     VALUES (?,?,?,?,?,?,?)`,
    [nombres, apellidos, email.toLowerCase(), hash, telefono || null, rol_id, estado || 'activo']
  );
  await registrar(req, 'crear', 'usuarios', r.insertId, email);
  res.status(201).json({ id: r.insertId, mensaje: 'Usuario creado.' });
}

async function actualizar(req, res) {
  const { nombres, apellidos, telefono, rol_id, estado } = req.body;
  await pool.query(
    `UPDATE usuarios SET nombres=COALESCE(?,nombres), apellidos=COALESCE(?,apellidos),
     telefono=COALESCE(?,telefono), rol_id=COALESCE(?,rol_id), estado=COALESCE(?,estado)
     WHERE id=?`,
    [nombres, apellidos, telefono, rol_id, estado, req.params.id]
  );
  await registrar(req, 'actualizar', 'usuarios', req.params.id);
  res.json({ mensaje: 'Usuario actualizado.' });
}

async function cambiarEstado(req, res) {
  const { estado } = req.body;
  if (!['pendiente', 'activo', 'suspendido'].includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido.' });
  }
  await pool.query('UPDATE usuarios SET estado=? WHERE id=?', [estado, req.params.id]);
  await registrar(req, 'cambiar_estado', 'usuarios', req.params.id, estado);
  res.json({ mensaje: `Usuario marcado como ${estado}.` });
}

async function reiniciarPassword(req, res) {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }
  await pool.query('UPDATE usuarios SET password_hash=? WHERE id=?',
    [await bcrypt.hash(password, 10), req.params.id]);
  await registrar(req, 'reiniciar_password', 'usuarios', req.params.id);
  res.json({ mensaje: 'Contraseña restablecida.' });
}

async function eliminar(req, res) {
  await pool.query('DELETE FROM usuarios WHERE id=?', [req.params.id]);
  await registrar(req, 'eliminar', 'usuarios', req.params.id);
  res.json({ mensaje: 'Usuario eliminado.' });
}

async function bitacora(req, res) {
  const [filas] = await pool.query(
    `SELECT b.*, CONCAT(u.nombres,' ',u.apellidos) AS usuario
     FROM bitacora b LEFT JOIN usuarios u ON u.id=b.usuario_id
     ORDER BY b.creado_en DESC LIMIT 300`
  );
  res.json(filas);
}

module.exports = { listar, listarRoles, crear, actualizar, cambiarEstado, reiniciarPassword, eliminar, bitacora };
