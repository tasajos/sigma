import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RutaProtegida({ children, permiso, roles }) {
  const { usuario, cargando, puede } = useAuth();

  if (cargando) return <div className="vacio">Verificando sesión…</div>;
  if (!usuario) return <Navigate to="/acceso" replace />;

  const autorizado =
    (!permiso || puede(permiso)) &&
    (!roles || roles.includes(usuario.rol));

  if (!autorizado) {
    return (
      <div className="vista">
        <div className="panel vacio">
          <h3>Sin acceso a esta sección</h3>
          <p>Tu perfil <b>{usuario.rol}</b> no tiene permisos sobre este módulo.</p>
        </div>
      </div>
    );
  }
  return children;
}
