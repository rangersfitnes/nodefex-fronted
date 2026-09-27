import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '../firebase'
import {
  getMe,
  ApiError,
  type AdminAccion,
  type Administrador,
  type ProyectoAccesoConfig,
} from '../api/administradores'

type AuthContextValue = {
  user: User | null
  administrador: Administrador | null
  setAdministrador: Dispatch<SetStateAction<Administrador | null>>
  loading: boolean
  isOwner: boolean
  isAdmin: boolean
  isVendedor: boolean
  getProjectAccess: (proyectoId: string) => ProyectoAccesoConfig | null
  canProjectAction: (proyectoId: string, action: AdminAccion) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retryProfile: () => Promise<void>
  profileError: string
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function normalizeProjectKey(proyectoId: string): string {
  return proyectoId.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function isAudiovisualProjectId(proyectoId: string): boolean {
  const key = normalizeProjectKey(proyectoId)
  return (
    key === 'nodefex-audio-visual' ||
    key === 'nodefex-audiovisual' ||
    key.includes('audio-visual') ||
    key.includes('audiovisual')
  )
}

function resolveAccessFromMap(
  accesos: Record<string, ProyectoAccesoConfig> | undefined,
  proyectoId: string,
): ProyectoAccesoConfig | null {
  if (!accesos) return null
  if (accesos[proyectoId]) return accesos[proyectoId]
  const target = normalizeProjectKey(proyectoId)
  for (const [key, value] of Object.entries(accesos)) {
    if (normalizeProjectKey(key) === target) return value
  }
  if (isAudiovisualProjectId(proyectoId)) {
    for (const [key, value] of Object.entries(accesos)) {
      if (isAudiovisualProjectId(key)) return value
    }
  }
  return null
}

/** Solo cerrar sesión cuando la cuenta no es admin (403). Un 401 puntual se reintenta. */
function isForbiddenAccount(error: unknown) {
  return error instanceof ApiError && error.status === 403
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

async function fetchAdminProfile(
  firebaseUser: User,
  options: { forceRefresh?: boolean } = {},
): Promise<Administrador> {
  const token = await firebaseUser.getIdToken(Boolean(options.forceRefresh))
  return getMe(token)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [administrador, setAdministrador] = useState<Administrador | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const profileSeq = useRef(0)
  const loginInFlight = useRef(false)
  /** Evita que el effect vuelva a pedir perfil justo después de un login/retry exitoso. */
  const profileLoadedForUid = useRef<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (!currentUser) {
        profileSeq.current += 1
        profileLoadedForUid.current = null
        setAdministrador(null)
        setProfileError('')
        setLoading(false)
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user) return

    // Mismo uid ya resuelto (re-fire de auth, login previo o Strict Mode): no reiniciar.
    if (profileLoadedForUid.current === user.uid) {
      setLoading(false)
      return
    }

    const seq = ++profileSeq.current
    const firebaseUser = user

    async function loadProfile() {
      setLoading(true)
      try {
        let profile: Administrador
        try {
          profile = await fetchAdminProfile(firebaseUser)
        } catch (firstError) {
          // Token recién emitido a veces falla una vez: forzar refresh y reintentar.
          if (isUnauthorized(firstError)) {
            profile = await fetchAdminProfile(firebaseUser, { forceRefresh: true })
          } else {
            throw firstError
          }
        }

        if (profileSeq.current !== seq) return
        setAdministrador(profile)
        setProfileError('')
        profileLoadedForUid.current = firebaseUser.uid
      } catch (error) {
        if (profileSeq.current !== seq) return

        setProfileError(
          error instanceof Error
            ? error.message
            : 'No se pudo cargar el perfil de administrador',
        )

        if (isForbiddenAccount(error)) {
          profileLoadedForUid.current = null
          setAdministrador(null)
          await signOut(auth)
          return
        }

        if (isUnauthorized(error)) {
          // Tras reintento con token fresco sigue 401: sesión inválida.
          profileLoadedForUid.current = null
          setAdministrador(null)
          await signOut(auth)
          return
        }

        // Red / 503 / etc.: mantener Firebase Auth para poder reintentar sin salir del sitio.
        setAdministrador(null)
      } finally {
        if (profileSeq.current === seq) setLoading(false)
      }
    }

    void loadProfile()
  }, [user?.uid])

  async function login(email: string, password: string) {
    if (loginInFlight.current) {
      return
    }
    loginInFlight.current = true
    setProfileError('')
    setLoading(true)

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const signedIn = credential.user
      const seq = ++profileSeq.current

      let profile: Administrador
      try {
        profile = await fetchAdminProfile(signedIn, { forceRefresh: true })
      } catch (firstError) {
        if (isUnauthorized(firstError)) {
          profile = await fetchAdminProfile(signedIn, { forceRefresh: true })
        } else {
          throw firstError
        }
      }

      if (profileSeq.current !== seq) return

      setUser(signedIn)
      setAdministrador(profile)
      setProfileError('')
      profileLoadedForUid.current = signedIn.uid
    } catch (error) {
      if (isForbiddenAccount(error)) {
        profileLoadedForUid.current = null
        setAdministrador(null)
        await signOut(auth).catch(() => undefined)
      } else if (!(error instanceof Error && 'code' in error)) {
        // Error de perfil (API), no de Firebase Auth: sesión Firebase puede existir.
        setAdministrador(null)
        setProfileError(
          error instanceof Error
            ? error.message
            : 'No se pudo cargar el perfil de administrador',
        )
      }
      throw error
    } finally {
      setLoading(false)
      loginInFlight.current = false
    }
  }

  async function retryProfile() {
    if (!user || loginInFlight.current) return
    const seq = ++profileSeq.current
    setLoading(true)
    setProfileError('')
    try {
      const profile = await fetchAdminProfile(user, { forceRefresh: true })
      if (profileSeq.current !== seq) return
      setAdministrador(profile)
      setProfileError('')
      profileLoadedForUid.current = user.uid
    } catch (error) {
      if (profileSeq.current !== seq) return
      setAdministrador(null)
      setProfileError(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el perfil de administrador',
      )
      if (isForbiddenAccount(error) || isUnauthorized(error)) {
        profileLoadedForUid.current = null
        await signOut(auth)
      }
    } finally {
      if (profileSeq.current === seq) setLoading(false)
    }
  }

  async function logout() {
    profileSeq.current += 1
    profileLoadedForUid.current = null
    setAdministrador(null)
    await signOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        administrador,
        setAdministrador,
        loading,
        isOwner: administrador?.rol === 'owner',
        isAdmin: administrador?.rol === 'admin',
        isVendedor: administrador?.rol === 'vendedor',
        getProjectAccess: (proyectoId: string) => {
          if (!administrador) return null
          if (administrador.rol === 'owner') {
            return { nivel: 'manage', acciones: [], visualizar: [] }
          }
          return resolveAccessFromMap(administrador.accesos, proyectoId)
        },
        canProjectAction: (proyectoId: string, action: AdminAccion) => {
          if (!administrador) return false
          if (administrador.rol === 'owner') return true
          const access = resolveAccessFromMap(administrador.accesos, proyectoId)
          if (!access) return false
          if (access.nivel === 'manage') return true
          if (access.nivel === 'custom') {
            return (
              access.acciones.includes(action) ||
              (access.visualizar || []).includes(action)
            )
          }
          return false
        },
        login,
        logout,
        retryProfile,
        profileError,
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
