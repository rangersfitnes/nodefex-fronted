import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Landing } from './Landing'
import { Dashboard } from './admin/Dashboard'
import { Login } from './admin/Login'
import { ProjectDetail } from './admin/ProjectDetail'
import { ProtectedRoute } from './admin/ProtectedRoute'
import { OwnerRoute } from './admin/OwnerRoute'
import { Administradores } from './admin/Administradores'
import { AdministradorDetail } from './admin/AdministradorDetail'
import { SitioContactoPage } from './admin/SitioContacto'
import { RegistroAdmin } from './admin/RegistroAdmin'
import { VelixPublic } from './velix/VelixPublic'
import { SistecontactPublic } from './sistecontact/SistecontactPublic'
import { FexmenuPublic } from './fexmenu/FexmenuPublic'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/velix" element={<VelixPublic />} />
        <Route path="/Velix" element={<Navigate to="/velix" replace />} />
        <Route path="/sistecontact" element={<SistecontactPublic />} />
        <Route path="/Sistecontact" element={<Navigate to="/sistecontact" replace />} />
        <Route path="/fexmenu" element={<FexmenuPublic />} />
        <Route path="/Fexmenu" element={<Navigate to="/fexmenu" replace />} />
        <Route path="/registroadmin" element={<RegistroAdmin />} />
        <Route path="/RegistroAdmin" element={<Navigate to="/registroadmin" replace />} />
        <Route path="/admin" element={<Login />} />
        <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/proyectos/:proyectoId" element={<ProjectDetail />} />
          <Route element={<OwnerRoute />}>
            <Route path="/admin/administradores" element={<Administradores />} />
            <Route path="/admin/administradores/:uid" element={<AdministradorDetail />} />
            <Route path="/admin/sitio-contacto" element={<SitioContactoPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
