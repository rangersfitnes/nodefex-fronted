import { useEffect, useState, type FormEvent } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  bootstrapSistecontactUser,
  confirmarPagoSistecontact,
  getSistecontactMe,
  iniciarPagoSistecontact,
  listSistecontactPlanes,
  openWompiWebCheckout,
  type SistecontactPlan,
  type SistecontactUsuario,
} from '../api/sistecontact'
import { getSistecontactAuth } from '../sistecontactFirebase'

const STORAGE_KEY = 'sistecontact_session'
const PENDING_PAYMENT_KEY = 'sistecontact_pending_payment'
const APP_URL = 'https://sistecontact.nodefex.com'

type Session = {
  token: string
  usuario: SistecontactUsuario
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function readPendingPayment(): { reference: string } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { reference: string }
  } catch {
    return null
  }
}

function writePendingPayment(reference: string) {
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ reference }))
}

function clearPendingPayment() {
  sessionStorage.removeItem(PENDING_PAYMENT_KEY)
}

export function SistecontactPublic() {
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [formBusy, setFormBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [planes, setPlanes] = useState<SistecontactPlan[]>([])
  const [planesLoading, setPlanesLoading] = useState(true)
  const [planesError, setPlanesError] = useState('')
  const [payingId, setPayingId] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const auth = getSistecontactAuth()
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user)
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadPlanes() {
      setPlanesLoading(true)
      setPlanesError('')
      try {
        const data = await listSistecontactPlanes()
        if (!cancelled) setPlanes(data)
      } catch (err) {
        if (!cancelled) {
          setPlanesError(err instanceof Error ? err.message : 'No se pudieron cargar los planes')
        }
      } finally {
        if (!cancelled) setPlanesLoading(false)
      }
    }

    void loadPlanes()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function syncSession() {
      if (!authUser) {
        setSession(null)
        return
      }

      try {
        const token = await authUser.getIdToken()
        const usuario = await bootstrapSistecontactUser(token)
        if (!cancelled) {
          const next = { token, usuario }
          setSession(next)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        }
      } catch (err) {
        if (!cancelled) {
          setFormError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
          setSession(null)
        }
      }
    }

    void syncSession()
    return () => {
      cancelled = true
    }
  }, [authUser])

  useEffect(() => {
    if (!session?.token) return

    const params = new URLSearchParams(window.location.search)
    const transactionId =
      params.get('id') || params.get('transaction_id') || params.get('transactionId')
    const pending = readPendingPayment()

    if (!transactionId || !pending?.reference) return

    let cancelled = false

    async function confirm() {
      setConfirming(true)
      setStatusMessage('Confirmando pago con Wompi...')
      try {
        const result = await confirmarPagoSistecontact(session!.token, {
          reference: pending!.reference,
          transactionId: transactionId!,
        })
        if (cancelled) return
        if (result.membresia) {
          setSession((current) =>
            current
              ? {
                  ...current,
                  usuario: result.membresia!,
                }
              : current,
          )
        }
        clearPendingPayment()
        setStatusMessage(
          result.activated || result.alreadyActivated
            ? `Membresía activa. Te quedan ${result.membresia?.diasRestantes ?? 0} días.`
            : 'Pago recibido. Si no se activó, usa “Ya pagué”.',
        )
        window.history.replaceState({}, '', '/sistecontact')
      } catch (err) {
        if (!cancelled) {
          setStatusMessage(
            err instanceof Error ? err.message : 'No se pudo confirmar el pago automáticamente',
          )
        }
      } finally {
        if (!cancelled) setConfirming(false)
      }
    }

    void confirm()
    return () => {
      cancelled = true
    }
  }, [session?.token])

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setFormBusy(true)

    try {
      const auth = getSistecontactAuth()
      await signInWithEmailAndPassword(auth, email.trim(), password)
      setPassword('')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message.includes('invalid-credential') ||
              err.message.includes('wrong-password') ||
              err.message.includes('user-not-found')
            ? 'Correo o contraseña incorrectos'
            : err.message
          : 'No se pudo iniciar sesión'
      setFormError(message)
    } finally {
      setFormBusy(false)
    }
  }

  async function handleLogout() {
    clearPendingPayment()
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
    setStatusMessage('')
    await signOut(getSistecontactAuth())
  }

  async function handlePay(plan: SistecontactPlan) {
    if (!session) return
    setPayingId(plan.id)
    setStatusMessage('')
    setFormError('')

    try {
      const token = await authUser!.getIdToken(true)
      const result = await iniciarPagoSistecontact(token, plan.id)

      if (result.mock) {
        if (result.membresia) {
          setSession({ token, usuario: result.membresia })
        }
        setStatusMessage(
          result.mensaje ||
            `Pago simulado: se activaron ${result.licencia.dias} días de membresía.`,
        )
        return
      }

      if (!result.checkout) {
        throw new Error('No se recibió información de checkout de Wompi')
      }

      writePendingPayment(result.checkout.reference)
      openWompiWebCheckout({
        ...result.checkout,
        customerEmail: session.usuario.email,
      })
      setStatusMessage(
        'Se abrió Wompi en una nueva pestaña. Al terminar el pago volverás aquí y se activará la membresía.',
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo iniciar el pago')
    } finally {
      setPayingId('')
    }
  }

  async function handleConfirmManual() {
    if (!session) return
    const pending = readPendingPayment()
    if (!pending?.reference) {
      setStatusMessage(
        'No hay un pago pendiente en esta sesión. Compra un plan primero o vuelve desde Wompi.',
      )
      return
    }

    const transactionId = window.prompt(
      'Pega el ID de la transacción de Wompi (aparece en el recibo o en la URL al volver):',
    )
    if (!transactionId?.trim()) return

    setConfirming(true)
    try {
      const token = await authUser!.getIdToken(true)
      const result = await confirmarPagoSistecontact(token, {
        reference: pending.reference,
        transactionId: transactionId.trim(),
      })
      if (result.membresia) {
        setSession({ token, usuario: result.membresia })
      }
      clearPendingPayment()
      setStatusMessage(
        `Membresía actualizada. Acceso ${result.membresia?.access ? 'activo' : 'inactivo'} · ${result.membresia?.diasRestantes ?? 0} días.`,
      )
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'No se pudo confirmar el pago')
    } finally {
      setConfirming(false)
    }
  }

  async function refreshMe() {
    if (!authUser) return
    try {
      const token = await authUser.getIdToken(true)
      const usuario = await getSistecontactMe(token)
      setSession({ token, usuario })
      setStatusMessage('Estado de membresía actualizado.')
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'No se pudo actualizar el estado')
    }
  }

  return (
    <div className="sc-page">
      <div className="sc-backdrop" aria-hidden />
      <header className="sc-header">
        <div className="sc-brand">
          <span className="sc-brand-mark" aria-hidden />
          <strong>Sistecontact</strong>
        </div>
        <div className="sc-header-actions">
          <a className="btn-primary" href={APP_URL} target="_blank" rel="noreferrer">
            Abrir Sistecontact
          </a>
          {session ? (
            <button type="button" className="btn-secondary" onClick={() => void handleLogout()}>
              Cerrar sesión
            </button>
          ) : null}
        </div>
      </header>

      <main className="sc-main">
        <section className="sc-hero">
          <h1>Sistecontact</h1>
          <p>Inicia sesión con tu cuenta, elige un plan y activa tu membresía.</p>
        </section>

        {!authReady ? (
          <p className="sc-status">Cargando...</p>
        ) : !session ? (
          <section className="sc-panel">
            <h2>Iniciar sesión</h2>
            <p className="sc-panel-copy">
              Las cuentas las crea el administrador. Si aún no tienes acceso, solicítalo al
              equipo.
            </p>

            <form className="modal-form" onSubmit={handleAuthSubmit} noValidate>
              <label className="login-field" htmlFor="sc-email">
                Correo
                <input
                  id="sc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={formBusy}
                  autoComplete="email"
                />
              </label>
              <label className="login-field" htmlFor="sc-password">
                Contraseña
                <input
                  id="sc-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={formBusy}
                  autoComplete="current-password"
                />
              </label>

              {formError ? (
                <p className="login-error" role="alert">
                  {formError}
                </p>
              ) : null}

              <button type="submit" className="btn-primary" disabled={formBusy}>
                {formBusy ? 'Espera...' : 'Entrar'}
              </button>
            </form>
          </section>
        ) : (
          <div className="sc-grid">
            <section className="sc-panel">
              <div className="sc-account">
                <p className="sc-eyebrow">Tu cuenta</p>
                <p className="sc-email">{session.usuario.email}</p>
                <p className={`sc-access ${session.usuario.access ? 'is-on' : 'is-off'}`}>
                  Membresía: {session.usuario.access ? 'Activa' : 'Inactiva'}
                  {session.usuario.diasRestantes > 0
                    ? ` · ${session.usuario.diasRestantes} días`
                    : ''}
                </p>
              </div>

              <div className="sc-account-actions">
                <a
                  className="btn-primary"
                  href={APP_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir Sistecontact
                </a>
                <button type="button" className="btn-secondary" onClick={() => void refreshMe()}>
                  Actualizar estado
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void handleConfirmManual()}
                  disabled={confirming}
                >
                  Ya pagué
                </button>
              </div>

              {statusMessage ? <p className="sc-status">{statusMessage}</p> : null}
              {formError ? (
                <p className="login-error" role="alert">
                  {formError}
                </p>
              ) : null}
            </section>

            <section className="sc-panel">
              <h2>Planes de membresía</h2>
              <p className="sc-panel-copy">
                El pago activa tu acceso en Sistecontact por la vigencia del plan.
              </p>

              {planesLoading ? <p className="sc-status">Cargando planes...</p> : null}
              {planesError ? (
                <p className="login-error" role="alert">
                  {planesError}
                </p>
              ) : null}
              {!planesLoading && !planesError && planes.length === 0 ? (
                <p className="sc-status">Aún no hay planes publicados.</p>
              ) : null}

              <div className="sc-plans">
                {planes.map((plan) => (
                  <article key={plan.id} className="sc-plan">
                    <div>
                      <h3>{plan.nombre}</h3>
                      <p>{plan.descripcion || `${plan.dias} días de acceso`}</p>
                      <p className="sc-plan-meta">
                        {plan.dias} días · {formatCop(plan.precio)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={Boolean(payingId) || confirming}
                      onClick={() => void handlePay(plan)}
                    >
                      {payingId === plan.id ? 'Procesando...' : 'Pagar'}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {!session && !planesLoading && planes.length > 0 ? (
          <section className="sc-panel sc-plans-preview" aria-label="Planes disponibles">
            <h2>Planes disponibles</h2>
            <div className="sc-plans">
              {planes.map((plan) => (
                <article key={plan.id} className="sc-plan">
                  <div>
                    <h3>{plan.nombre}</h3>
                    <p>{plan.descripcion || `${plan.dias} días de acceso`}</p>
                    <p className="sc-plan-meta">
                      {plan.dias} días · {formatCop(plan.precio)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <p className="sc-status">Inicia sesión para pagar un plan.</p>
          </section>
        ) : null}
      </main>
    </div>
  )
}
