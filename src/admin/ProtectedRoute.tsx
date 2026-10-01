import { Outlet } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ChangePasswordModal } from './ChangePasswordModal'
import { CompleteProfileModal, profileNeedsCompletion } from './CompleteProfileModal'

export function ProtectedRoute() {
  const { user, administrador, loading } = useAuth()

  // Si ya hay sesión + perfil, entrar al panel aunque loading parpadee
  // (evita rebote /admin ↔ /dashboard tras el login).
  if (user && administrador) {
    const needsPassword = Boolean(administrador.mustChangePassword)
    const needsProfile = !needsPassword && profileNeedsCompletion(administrador)
    return (
      <>
        <Outlet />
        {needsPassword ? <ChangePasswordModal /> : null}
        {needsProfile ? <CompleteProfileModal /> : null}
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
