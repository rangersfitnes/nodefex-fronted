import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '../firebase'
import { getMe, type AdminAccion, type Administrador, type ProyectoAccesoConfig } from '../api/administradores'

type AuthContextValue = {
  user: User | null
  administrador: Administrador | null
  loading: boolean
  isOwner: boolean
  isAdmin: boolean
  getProjectAccess: (proyectoId: string) => ProyectoAccesoConfig | null
  canProjectAction: (proyectoId: string, action: AdminAccion) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [administrador, setAdministrador] = useState<Administrador | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      if (!user) {
        setAdministrador(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const token = await user.getIdToken()
        const profile = await getMe(token)
        if (!cancelled) setAdministrador(profile)
      } catch {
        if (!cancelled) {
          setAdministrador(null)
          await signOut(auth)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [user])

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    setAdministrador(null)
    await signOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        administrador,
        loading,
        isOwner: administrador?.rol === 'owner',
        isAdmin: administrador?.rol === 'admin',
        getProjectAccess: (proyectoId: string) => {
          if (!administrador) return null
          if (administrador.rol === 'owner') {
            return { nivel: 'manage', acciones: [] }
          }
          return administrador.accesos?.[proyectoId] ?? null
        },
        canProjectAction: (proyectoId: string, action: AdminAccion) => {
          if (!administrador) return false
          if (administrador.rol === 'owner') return true
          const access = administrador.accesos?.[proyectoId]
          if (!access) return false
          if (access.nivel === 'manage') return true
          if (access.nivel === 'custom') return access.acciones.includes(action)
          return false
        },
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
