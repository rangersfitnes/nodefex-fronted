import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ChangePasswordModal } from './ChangePasswordModal'

export function ProtectedRoute() {
  const { user, administrador, loading } = useAuth()

  // Si ya hay sesión + perfil, entrar al panel aunque loading parpadee
  // (evita rebote /admin ↔ /dashboard tras el login).
  if (user && administrador) {
    return (
      <>
        <Outlet />
        {administrador.mustChangePassword ? <ChangePasswordModal /> : null}
      </>
    )
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" aria-hidden />
        <p>Cargando...</p>
      </div>
    )
  }

  return <Navigate to="/admin" replace />
}
