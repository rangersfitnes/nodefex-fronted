import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Dashboard } from './admin/Dashboard'
import { Login } from './admin/Login'
import { ProjectDetail } from './admin/ProjectDetail'
import { ProtectedRoute } from './admin/ProtectedRoute'
import { OwnerRoute } from './admin/OwnerRoute'
import { Administradores } from './admin/Administradores'
import { AdministradorDetail } from './admin/AdministradorDetail'
import { RegistroAdmin } from './admin/RegistroAdmin'
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
        <Route path="/registroadmin" element={<RegistroAdmin />} />
        <Route path="/RegistroAdmin" element={<Navigate to="/registroadmin" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/proyectos/:proyectoId" element={<ProjectDetail />} />
          <Route element={<OwnerRoute />}>
            <Route path="/admin/administradores" element={<Administradores />} />
            <Route path="/admin/administradores/:uid" element={<AdministradorDetail />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

