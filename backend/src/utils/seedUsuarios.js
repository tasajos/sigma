/**
 * Crea los cinco usuarios de demostración (uno por perfil).
 * Uso:  npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const PASSWORD = 'Sigma2026*';

const DEMO = [
  { nombres: 'Elena',  apellidos: 'Prado',    email: 'admin@sigma.gob',          rol: 'administrador'  },
  { nombres: 'Marco',  apellidos: 'Salazar',  email: 'rescatista@sigma.gob',     rol: 'rescatista'     },
  { nombres: 'Iván',   apellidos: 'Camacho',  email: 'operaciones@sigma.gob',    rol: 'operaciones'    },
  { nombres: 'Rosa',   apellidos: 'Nieto',    email: 'logistica@sigma.gob',      rol: 'logistica'      },
  { nombres: 'Carla',  apellidos: 'Montoya',  email: 'comunicaciones@sigma.gob', rol: 'comunicaciones' }
];

(async () => {
  try {
    const hash = await bcrypt.hash(PASSWORD, 10);
    for (const u of DEMO) {
      const [[rol]] = await pool.query('SELECT id FROM roles WHERE nombre=?', [u.rol]);
      if (!rol) { console.error(`Falta el rol ${u.rol}. Ejecuta primero seed.sql`); continue; }
      await pool.query(
        `INSERT INTO usuarios (nombres, apellidos, email, password_hash, telefono, rol_id, estado)
         VALUES (?,?,?,?,?,?,'activo')
         ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), estado='activo'`,
        [u.nombres, u.apellidos, u.email, hash, '+51999000' + Math.floor(100 + Math.random() * 899), rol.id]
      );
      console.log(`  ✓ ${u.email.padEnd(30)} (${u.rol})`);
    }
    // Vincula al rescatista demo con su ficha de personal
    await pool.query(
      `UPDATE personal_emergencia p
       JOIN usuarios u ON u.email='rescatista@sigma.gob'
       SET p.usuario_id = u.id WHERE p.codigo='P-0001'`);

    console.log(`\n  Contraseña para todos los usuarios demo: ${PASSWORD}\n`);
    process.exit(0);
  } catch (e) {
    console.error('Error al sembrar usuarios:', e.message);
    process.exit(1);
  }
})();
