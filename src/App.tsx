import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Dashboard } from './admin/Dashboard'
import { Login } from './admin/Login'
import { ProjectDetail } from './admin/ProjectDetail'
import { ProtectedRoute } from './admin/ProtectedRoute'
import { VelixPublic } from './velix/VelixPublic'
import { SistecontactPublic } from './sistecontact/SistecontactPublic'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/velix" element={<VelixPublic />} />
        <Route path="/Velix" element={<Navigate to="/velix" replace />} />
        <Route path="/sistecontact" element={<SistecontactPublic />} />
        <Route path="/Sistecontact" element={<Navigate to="/sistecontact" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/proyectos/:proyectoId" element={<ProjectDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
