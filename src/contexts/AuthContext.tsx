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
    // Unir todas las claves AV por si hay alias duplicados con acciones distintas.
    let merged: ProyectoAccesoConfig | null = null
    for (const [key, value] of Object.entries(accesos)) {
      if (!isAudiovisualProjectId(key)) continue
      if (!merged) {
        merged = value
        continue
      }
      if (merged.nivel === 'manage' || value.nivel === 'manage') {
        merged = { nivel: 'manage', acciones: [], visualizar: [] }
        continue
      }
      if (merged.nivel === 'view' || value.nivel === 'view') {
        merged = { nivel: 'view', acciones: [], visualizar: [] }
        continue
      }
      const acciones = Array.from(
        new Set([...(merged.acciones || []), ...(value.acciones || [])]),
      )
      const visualizar = Array.from(
        new Set([...(merged.visualizar || []), ...(value.visualizar || [])]),
      ).filter((item) => !acciones.includes(item))
      merged = { nivel: 'custom', acciones, visualizar }
    }
    return merged
  }
  return null
}

function isForbiddenAccount(error: unknown) {
  return error instanceof ApiError && error.status === 403
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

function isRetryableProfileError(error: unknown) {
  if (!(error instanceof ApiError)) {
    // fetch falló (cold start Render, red, CORS, etc.)
    return true
  }
  return error.status === 401 || error.status === 408 || error.status === 429 || error.status >= 500
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function fetchAdminProfile(
  firebaseUser: User,
  options: { forceRefresh?: boolean } = {},
): Promise<Administrador> {
  const token = await firebaseUser.getIdToken(Boolean(options.forceRefresh))
  return getMe(token)
}

/**
 * Reintenta getMe ante 401/503/red: el login de Firebase puede ser correcto
 * y fallar solo la carga del perfil (cuota, cold start, token recién emitido).
 */
async function fetchAdminProfileWithRetry(firebaseUser: User): Promise<Administrador> {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await fetchAdminProfile(firebaseUser, { forceRefresh: attempt > 0 })
    } catch (error) {
      lastError = error
      if (isForbiddenAccount(error)) throw error
      if (!isRetryableProfileError(error) || attempt === 3) throw error
      await sleep(400 * (attempt + 1))
    }
  }
  throw lastError
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [administrador, setAdministrador] = useState<Administrador | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const profileSeq = useRef(0)
  const loginInFlight = useRef(false)
  const loginPromiseRef = useRef<Promise<void> | null>(null)
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

    // El login en curso es dueño de la carga del perfil (evita carrera que descarta el éxito).
    if (loginInFlight.current) return

    if (profileLoadedForUid.current === user.uid) {
      setLoading(false)
      return
    }

    const seq = ++profileSeq.current
    const firebaseUser = user

    async function loadProfile() {
      setLoading(true)
      try {
        const profile = await fetchAdminProfileWithRetry(firebaseUser)
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
          profileLoadedForUid.current = null
          setAdministrador(null)
          await signOut(auth)
          return
        }

        // Red / 503: mantener Firebase Auth para poder reintentar.
        setAdministrador(null)
      } finally {
        if (profileSeq.current === seq) setLoading(false)
      }
    }

    void loadProfile()
  }, [user?.uid])

  async function login(email: string, password: string) {
    // Reutilizar el mismo intento si el usuario hace doble clic.
    if (loginPromiseRef.current) {
      return loginPromiseRef.current
    }

    const run = (async () => {
      loginInFlight.current = true
      setProfileError('')
      setLoading(true)
      // Invalidar cargas en vuelo del effect para no pisar el resultado del login.
      profileSeq.current += 1

      try {
        const credential = await signInWithEmailAndPassword(auth, email, password)
        const signedIn = credential.user
        setUser(signedIn)

        const profile = await fetchAdminProfileWithRetry(signedIn)

        // Aplicar si seguimos con la misma cuenta (no exigir seq exacto:
        // un effect concurrente no debe descartar un login exitoso).
        if (auth.currentUser?.uid !== signedIn.uid) return

        profileSeq.current += 1
        setAdministrador(profile)
        setProfileError('')
        profileLoadedForUid.current = signedIn.uid
      } catch (error) {
        if (isForbiddenAccount(error)) {
          profileLoadedForUid.current = null
          setAdministrador(null)
          await signOut(auth).catch(() => undefined)
        } else if (!(error instanceof Error && 'code' in error)) {
          // Perfil/API falló; Firebase puede haber autenticado bien.
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
        loginPromiseRef.current = null
      }
    })()

    loginPromiseRef.current = run
    return run
  }

  async function retryProfile() {
    if (!user || loginInFlight.current) return
    const seq = ++profileSeq.current
    setLoading(true)
    setProfileError('')
    try {
      const profile = await fetchAdminProfileWithRetry(user)
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

  // Si el owner cambia permisos mientras la sesión sigue abierta, refrescar el
  // perfil al volver a la pestaña (sin spinner completo).
  useEffect(() => {
    let lastAt = 0
    async function softRefresh() {
      if (!auth.currentUser || loginInFlight.current) return
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastAt < 8_000) return
      lastAt = now
      const firebaseUser = auth.currentUser
      const seq = ++profileSeq.current
      try {
        const profile = await fetchAdminProfile(firebaseUser, { forceRefresh: false })
        if (profileSeq.current !== seq) return
        if (auth.currentUser?.uid !== firebaseUser.uid) return
        setAdministrador(profile)
        setProfileError('')
        profileLoadedForUid.current = firebaseUser.uid
      } catch {
        // Silencioso: no tumbar la sesión por un fallo puntual de red.
      }
    }

    function onVisible() {
      void softRefresh()
    }

    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  async function logout() {
    profileSeq.current += 1
    profileLoadedForUid.current = null
    loginPromiseRef.current = null
    loginInFlight.current = false
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
          if (access.nivel === 'view') return false
          if (access.nivel === 'custom') {
            const acciones = Array.isArray(access.acciones) ? access.acciones : []
            const visualizar = Array.isArray(access.visualizar) ? access.visualizar : []
            return acciones.includes(action) || visualizar.includes(action)
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
