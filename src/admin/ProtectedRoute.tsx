import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ChangePasswordModal } from './ChangePasswordModal'

export function ProtectedRoute() {
  const { user, administrador, loading } = useAuth()

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" aria-hidden />
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user || !administrador) {
    return <Navigate to="/admin" replace />
  }

  return (
    <>
      <Outlet />
      {administrador.mustChangePassword ? <ChangePasswordModal /> : null}
    </>
  )
}
