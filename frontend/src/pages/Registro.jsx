import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const SANGRE = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export default function Registro() {
  const navegar = useNavigate();
  const [f, setF] = useState({
    nombres: '', apellidos: '', email: '', password: '', confirmar: '',
    telefono: '', documento: '', tipo_sangre: '', institucion: '',
    especialidad: '', nivel_certificacion: 'basico',
    contacto_emergencia: '', telefono_emergencia: ''
  });
  const [error, setError] = useState('');
  const [ok, setOk] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cambiar = (e) => setF({ ...f, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirmar) return setError('Las contraseñas no coinciden.');
    if (f.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');

    setCargando(true);
    try {
      const r = await api.post('/auth/registro', f);
      setOk(r);
      setTimeout(() => navegar('/acceso'), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  if (ok) {
    return (
      <div className="acceso">
        <section className="acceso-relato">
          <div className="rotulo">Solicitud recibida</div>
          <h1>Registro en<br />revisión</h1>
          <p>{ok.mensaje}</p>
        </section>
        <section className="acceso-panel">
          <div className="acceso-formulario">
            <div className="aviso aviso-ok">
              Tu código de personal es <b className="dato">{ok.codigo}</b>. Consérvalo: lo usarás
              para identificarte en el terreno.
            </div>
            <Link className="btn btn-primario btn-bloque" to="/acceso">Volver al inicio de sesión</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="acceso">
      <section className="acceso-relato">
        <div className="rotulo">Personal de campo</div>
        <h1>Registro de<br />rescatistas</h1>
        <p>
          Completa tus datos operativos. Un administrador validará la solicitud antes de
          habilitar tu acceso al sistema de monitoreo.
        </p>
      </section>

      <section className="acceso-panel">
        <form className="acceso-formulario" style={{ maxWidth: 480 }} onSubmit={enviar}>
          <h2>Solicitar acceso</h2>
          <p className="subtitulo">Los campos marcados son obligatorios.</p>

          {error && <div className="aviso aviso-error">{error}</div>}

          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="nombres">Nombres *</label>
              <input id="nombres" name="nombres" value={f.nombres} onChange={cambiar} required />
            </div>
            <div className="campo">
              <label htmlFor="apellidos">Apellidos *</label>
              <input id="apellidos" name="apellidos" value={f.apellidos} onChange={cambiar} required />
            </div>
          </div>

          <div className="campo">
            <label htmlFor="email">Correo *</label>
            <input id="email" name="email" type="email" value={f.email} onChange={cambiar} required />
          </div>

          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="password">Contraseña *</label>
              <input id="password" name="password" type="password" value={f.password} onChange={cambiar} required />
            </div>
            <div className="campo">
              <label htmlFor="confirmar">Repetir *</label>
              <input id="confirmar" name="confirmar" type="password" value={f.confirmar} onChange={cambiar} required />
            </div>
          </div>

          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="documento">Documento *</label>
              <input id="documento" name="documento" className="dato" value={f.documento} onChange={cambiar} required />
            </div>
            <div className="campo">
              <label htmlFor="telefono">Teléfono</label>
              <input id="telefono" name="telefono" className="dato" value={f.telefono} onChange={cambiar} placeholder="+51999888777" />
            </div>
          </div>

          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="tipo_sangre">Tipo de sangre</label>
              <select id="tipo_sangre" name="tipo_sangre" value={f.tipo_sangre} onChange={cambiar}>
                <option value="">Seleccionar</option>
                {SANGRE.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="nivel_certificacion">Certificación</label>
              <select id="nivel_certificacion" name="nivel_certificacion" value={f.nivel_certificacion} onChange={cambiar}>
                <option value="basico">Básico</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
                <option value="instructor">Instructor</option>
              </select>
            </div>
          </div>

          <div className="campo">
            <label htmlFor="institucion">Institución</label>
            <input id="institucion" name="institucion" value={f.institucion} onChange={cambiar}
              placeholder="Cuerpo de Bomberos, Defensa Civil, Cruz Roja…" />
          </div>

          <div className="campo">
            <label htmlFor="especialidad">Especialidad</label>
            <input id="especialidad" name="especialidad" value={f.especialidad} onChange={cambiar}
              placeholder="Rescate vehicular, paramédico, búsqueda…" />
          </div>

          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="contacto_emergencia">Contacto de emergencia</label>
              <input id="contacto_emergencia" name="contacto_emergencia" value={f.contacto_emergencia} onChange={cambiar} />
            </div>
            <div className="campo">
              <label htmlFor="telefono_emergencia">Su teléfono</label>
              <input id="telefono_emergencia" name="telefono_emergencia" className="dato"
                value={f.telefono_emergencia} onChange={cambiar} />
            </div>
          </div>

          <button className="btn btn-primario btn-bloque" disabled={cargando}>
            {cargando ? 'Enviando solicitud…' : 'Enviar solicitud'}
          </button>

          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--texto-tenue)' }}>
            ¿Ya tienes cuenta? <Link to="/acceso">Iniciar sesión</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
