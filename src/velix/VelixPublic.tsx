import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  bootstrapVelixUser,
  confirmarPagoVelix,
  getVelixMe,
  iniciarPagoVelix,
  listLicenciasPublicas,
  openWompiWebCheckout,
  type VelixLicencia,
  type VelixUsuario,
} from '../api/velix'
import {
  getVelixIdToken,
  loginVelixClient,
  logoutVelixClient,
  mapVelixAuthError,
  registroVelixClient,
  subscribeVelixAuth,
} from '../velixFirebase'
import {
  AlertCircle,
  Hexagon,
  LoaderCircle,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Plus,
  Shield,
} from '../icons'

const STORAGE_KEY = 'velix_session'
const PENDING_PAYMENT_KEY = 'velix_pending_payment'

type StoredSession = {
  idToken: string
  usuario: VelixUsuario
}

type PendingPayment = {
  reference: string
  dias: number
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function writeSession(session: StoredSession | null) {
  if (!session) {
    sessionStorage.removeItem(STORAGE_KEY)
    return
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function readPendingPayment(): PendingPayment | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY)
    return raw ? (JSON.parse(raw) as PendingPayment) : null
  } catch {
    return null
  }
}

function writePendingPayment(pending: PendingPayment | null) {
  if (!pending) {
    sessionStorage.removeItem(PENDING_PAYMENT_KEY)
    return
  }
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pending))
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function VelixPublic() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'registro'>('registro')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [session, setSession] = useState<StoredSession | null>(() => readSession())
  const [licencias, setLicencias] = useState<VelixLicencia[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState('')
  const [payError, setPayError] = useState('')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [confirmingPayment, setConfirmingPayment] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadPlans() {
      setPlansLoading(true)
      setPlansError('')
      try {
        const data = await listLicenciasPublicas()
        if (!cancelled) setLicencias(data)
      } catch (err) {
        if (!cancelled) {
          setPlansError(err instanceof Error ? err.message : 'No se pudieron cargar los planes')
        }
      } finally {
        if (!cancelled) setPlansLoading(false)
      }
    }

    void loadPlans()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let unsubscribe = () => {}

    try {
      unsubscribe = subscribeVelixAuth((user) => {
        void (async () => {
          if (!user) {
            setSession(null)
            writeSession(null)
            return
          }

          try {
            const idToken = await user.getIdToken()
            const usuario = await bootstrapVelixUser(idToken)
            const next = { idToken, usuario }
            setSession(next)
            writeSession(next)
          } catch (err) {
            console.error(err)
          }
        })()
      })
    } catch (err) {
      setAuthError(mapVelixAuthError(err))
    }

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const transactionId = searchParams.get('id')
    if (!transactionId) return

    const pending = readPendingPayment()
    if (!pending) {
      setPayError(
        'Volviste de Wompi, pero no hay un pago pendiente en esta sesión. Inicia sesión y usa “Ya pagué”.',
      )
      return
    }

    void (async () => {
      setConfirmingPayment(true)
      setPayError('')
      try {
        const token = (await getVelixIdToken(true)) || readSession()?.idToken
        if (!token) {
          setPayError('Inicia sesión para confirmar el pago')
          return
        }

        const confirmation = await confirmarPagoVelix(token, {
          reference: pending.reference,
          transactionId,
        })

        if (confirmation.membresia) {
          const next = {
            idToken: token,
            usuario: {
              uid: confirmation.membresia.uid,
              email: confirmation.membresia.email,
              diasRestantes: confirmation.membresia.diasRestantes,
              licenseExpiresAt: confirmation.membresia.licenseExpiresAt,
              activa: confirmation.membresia.activa,
            },
          }
          setSession(next)
          writeSession(next)
        } else {
          const usuario = await getVelixMe(token)
          setSession({ idToken: token, usuario })
          writeSession({ idToken: token, usuario })
        }

        writePendingPayment(null)
        setStatusMessage(
          confirmation.activated
            ? `Pago aprobado. Se activaron ${pending.dias} días de licencia.`
            : 'Pago procesado. Si ya estaba aprobado, tu licencia ya figura activa.',
        )
        setSearchParams({}, { replace: true })
      } catch (err) {
        setPayError(err instanceof Error ? err.message : 'No se pudo confirmar el pago')
      } finally {
        setConfirmingPayment(false)
      }
    })()
  }, [searchParams, setSearchParams])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    try {
      if (mode === 'registro') {
        await registroVelixClient(email.trim(), password)
        setStatusMessage('Cuenta creada. Ya puedes comprar una licencia.')
      } else {
        await loginVelixClient(email.trim(), password)
        setStatusMessage('Sesión iniciada.')
      }
      setPassword('')
    } catch (err) {
      setAuthError(mapVelixAuthError(err))
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await logoutVelixClient()
    } catch {
      // ignore
    }
    setSession(null)
    writeSession(null)
    setStatusMessage('')
  }

  async function handleBuy(licencia: VelixLicencia) {
    const idToken = (await getVelixIdToken()) || session?.idToken
    if (!idToken) {
      setPayError('Inicia sesión o crea una cuenta para comprar')
      return
    }

    setPayError('')
    setPayingId(licencia.id)

    try {
      const result = await iniciarPagoVelix(idToken, licencia.id)

      if (result.mock && result.membresia) {
        const next = {
          idToken,
          usuario: {
            uid: result.membresia.uid,
            email: result.membresia.email,
            diasRestantes: result.membresia.diasRestantes,
            licenseExpiresAt: result.membresia.licenseExpiresAt,
            activa: result.membresia.activa,
          },
        }
        setSession(next)
        writeSession(next)
        setStatusMessage(
          result.mensaje ||
            `Pago simulado: se activaron ${licencia.dias} días. (CloudFront bloquea Wompi en tu red)`,
        )
        return
      }

      if (!result.checkout) {
        throw new Error('No se recibió información de checkout de Wompi')
      }

      writePendingPayment({
        reference: result.checkout.reference,
        dias: licencia.dias,
      })

      openWompiWebCheckout({
        ...result.checkout,
        customerEmail: session?.usuario.email,
      })

      setStatusMessage(
        'Se abrió Wompi en una nueva pestaña. Al terminar el pago volverás aquí y se activará la licencia.',
      )
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'No se pudo iniciar el pago')
    } finally {
      setPayingId(null)
    }
  }

  async function handleConfirmManual() {
    const pending = readPendingPayment()
    const transactionId = window.prompt(
      'Pega el ID de la transacción de Wompi (aparece en el recibo o en la URL al volver):',
    )
    if (!pending || !transactionId?.trim()) return

    setConfirmingPayment(true)
    setPayError('')
    try {
      const token = (await getVelixIdToken(true)) || session?.idToken
      if (!token) {
        setPayError('Inicia sesión para confirmar el pago')
        return
      }
      const confirmation = await confirmarPagoVelix(token, {
        reference: pending.reference,
        transactionId: transactionId.trim(),
      })
      if (confirmation.membresia) {
        const next = {
          idToken: token,
          usuario: {
            uid: confirmation.membresia.uid,
            email: confirmation.membresia.email,
            diasRestantes: confirmation.membresia.diasRestantes,
            licenseExpiresAt: confirmation.membresia.licenseExpiresAt,
            activa: confirmation.membresia.activa,
          },
        }
        setSession(next)
        writeSession(next)
      }
      writePendingPayment(null)
      setStatusMessage(
        confirmation.activated
          ? `Pago aprobado. Se activaron ${pending.dias} días de licencia.`
          : 'Pago procesado.',
      )
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'No se pudo confirmar el pago')
    } finally {
      setConfirmingPayment(false)
    }
  }

  return (
    <div className="velix-page">
      <div className="velix-backdrop" aria-hidden />
      <header className="velix-header">
        <div className="velix-brand">
          <span className="login-mark" aria-hidden>
            <Hexagon size={20} strokeWidth={2.25} />
          </span>
          <div>
            <p className="login-brand-name">Velix</p>
            <p className="login-brand-subtitle">Licencias del programa</p>
          </div>
        </div>
        <Link to="/admin/login" className="back-link">
          Admin Nodefex
        </Link>
      </header>

      <main className="velix-main">
        <section className="velix-hero">
          <h1>Tu cuenta Velix</h1>
          <p>
            Crea tu cuenta, elige un plan y paga con Wompi. Al aprobarse el pago se activan los
            días de licencia automáticamente.
          </p>
        </section>

        <div className="velix-grid">
          <section className="velix-panel">
            {session ? (
              <div className="velix-account">
                <div className="section-heading">
                  <Shield size={18} strokeWidth={2} aria-hidden />
                  <h2>Tu licencia</h2>
                </div>
                <p className="velix-email">{session.usuario.email}</p>
                <div
                  className={`membership-badge ${session.usuario.activa ? 'is-active' : 'is-expired'}`}
                >
                  <strong>{session.usuario.diasRestantes}</strong>
                  <span>días</span>
                </div>
                <button type="button" className="btn-secondary" onClick={() => void handleLogout()}>
                  <LogOut size={16} strokeWidth={2} aria-hidden />
                  Cerrar sesión
                </button>
                {readPendingPayment() ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void handleConfirmManual()}
                    disabled={confirmingPayment}
                  >
                    {confirmingPayment ? 'Confirmando...' : 'Ya pagué'}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="velix-tabs">
                  <button
                    type="button"
                    className={mode === 'registro' ? 'is-active' : ''}
                    onClick={() => setMode('registro')}
                  >
                    Crear cuenta
                  </button>
                  <button
                    type="button"
                    className={mode === 'login' ? 'is-active' : ''}
                    onClick={() => setMode('login')}
                  >
                    Iniciar sesión
                  </button>
                </div>

                <form className="modal-form" onSubmit={handleAuth} noValidate>
                  <label className="login-field" htmlFor="velix-email">
                    Correo
                    <span className="login-input-wrap">
                      <Mail className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
                      <input
                        id="velix-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={authLoading}
                      />
                    </span>
                  </label>
                  <label className="login-field" htmlFor="velix-password">
                    Contraseña
                    <span className="login-input-wrap">
                      <Lock className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
                      <input
                        id="velix-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        disabled={authLoading}
                      />
                    </span>
                  </label>

                  {authError ? (
                    <p className="login-error" role="alert">
                      <AlertCircle size={16} strokeWidth={2} aria-hidden />
                      {authError}
                    </p>
                  ) : null}

                  <button type="submit" className="btn-primary" disabled={authLoading}>
                    {authLoading ? (
                      <>
                        <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                        Procesando...
                      </>
                    ) : mode === 'registro' ? (
                      <>
                        <Plus size={16} strokeWidth={2} aria-hidden />
                        Crear cuenta
                      </>
                    ) : (
                      <>
                        <LogIn size={16} strokeWidth={2} aria-hidden />
                        Entrar
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {statusMessage ? <p className="velix-status">{statusMessage}</p> : null}
            {confirmingPayment ? (
              <p className="velix-status">Confirmando pago con Wompi...</p>
            ) : null}
          </section>

          <section className="velix-panel">
            <div className="section-heading">
              <Shield size={18} strokeWidth={2} aria-hidden />
              <h2>Planes disponibles</h2>
            </div>

            {plansLoading ? (
              <div className="proyectos-status">
                <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                Cargando planes...
              </div>
            ) : null}

            {!plansLoading && plansError ? (
              <div className="proyectos-status proyectos-status-error" role="alert">
                <AlertCircle size={18} strokeWidth={2} aria-hidden />
                {plansError}
              </div>
            ) : null}

            {!plansLoading && !plansError && licencias.length === 0 ? (
              <div className="proyectos-empty">
                <p>Aún no hay planes publicados. Créalos desde el panel admin de Velix.</p>
              </div>
            ) : null}

            {!plansLoading && !plansError && licencias.length > 0 ? (
              <div className="plan-list">
                {licencias.map((plan) => (
                  <article key={plan.id} className="plan-card">
                    <div>
                      <h3>{plan.nombre}</h3>
                      <p>{plan.descripcion || `${plan.dias} días de licencia`}</p>
                      <p className="plan-meta">
                        {plan.dias} días · {formatCop(plan.precio)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={payingId === plan.id}
                      onClick={() => void handleBuy(plan)}
                    >
                      {payingId === plan.id ? (
                        <>
                          <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                          Abriendo Wompi...
                        </>
                      ) : (
                        <>Comprar</>
                      )}
                    </button>
                  </article>
                ))}
              </div>
            ) : null}

            {payError ? (
              <p className="login-error" role="alert">
                <AlertCircle size={16} strokeWidth={2} aria-hidden />
                {payError}
              </p>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  )
}
