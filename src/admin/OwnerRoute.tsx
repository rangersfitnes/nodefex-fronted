import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function OwnerRoute() {
  const { loading, isOwner } = useAuth()

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" aria-hidden />
        <p>Cargando...</p>
      </div>
    )
  }

  if (!isOwner) {
    return <Navigate to="/admin/dashboard" replace />
  }

  return <Outlet />
}
