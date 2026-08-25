import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NIVELES = [
  ['var(--verde)',    'Verde — vigilancia, sin despliegue'],
  ['var(--amarillo)', 'Amarillo — preparación y alistamiento'],
  ['var(--naranja)',  'Naranja — respuesta y activación del SCI'],
  ['var(--rojo)',     'Rojo — emergencia mayor, aviso a prensa']
];

export default function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    try {
      const u = await entrar(email, password);
      navegar(u.rol === 'rescatista' ? '/campo' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="acceso">
      <section className="acceso-relato">
        <div className="rotulo">Centro de Operaciones de Emergencia</div>
        <h1>Monitoreo de<br />eventos adversos</h1>
        <p>
          Ubicación en vivo del personal en campo, comando de incidentes, alarma
          escalonada y notificación a prensa desde un solo tablero.
        </p>
        <div className="acceso-niveles">
          <div className="rotulo" style={{ marginBottom: 4 }}>Niveles de alerta</div>
          {NIVELES.map(([color, texto]) => (
            <div className="acceso-nivel" key={texto}>
              <i style={{ background: color }} />{texto}
            </div>
          ))}
        </div>
      </section>

      <section className="acceso-panel">
        <form className="acceso-formulario" onSubmit={enviar}>
          <h2>Iniciar sesión</h2>
          <p className="subtitulo">Acceso restringido a personal autorizado.</p>

          {error && <div className="aviso aviso-error">{error}</div>}

          <div className="campo">
            <label htmlFor="email">Correo institucional</label>
            <input id="email" type="email" value={email} required autoComplete="username"
              onChange={(e) => setEmail(e.target.value)} placeholder="usuario@sigma.gob" />
          </div>

          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" value={password} required autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button className="btn btn-primario btn-bloque" disabled={cargando}>
            {cargando ? 'Verificando…' : 'Entrar'}
          </button>

          <p style={{ marginTop: 18, fontSize: 13, color: 'var(--texto-tenue)' }}>
            ¿Eres rescatista y aún no tienes cuenta?{' '}
            <Link to="/registro">Solicita tu registro</Link>
          </p>

          <div className="credenciales-demo">
            <div className="rotulo">Cuentas de demostración</div>
            <span className="dato">admin@sigma.gob · rescatista@sigma.gob</span>
            <span className="dato">operaciones@sigma.gob · logistica@sigma.gob</span>
            <span className="dato">comunicaciones@sigma.gob</span>
            <span className="dato" style={{ marginTop: 6, color: 'var(--acento)' }}>Contraseña: Sigma2026*</span>
          </div>
        </form>
      </section>
    </div>
  );
}
