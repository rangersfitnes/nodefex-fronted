import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  bootstrapVelixUser,
  confirmarPagoVelix,
  getLinkDescargaPublico,
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
} from '../velixFirebase'
import {
  AlertCircle,
  Download,
  Hexagon,
  LoaderCircle,
  LogOut,
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

function reloadVelix() {
  window.location.replace('/velix')
}

function VelixShell({ children }: { children: ReactNode }) {
  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloadLoading, setDownloadLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getLinkDescargaPublico()
        if (!cancelled) setDownloadUrl((data.url || '').trim())
      } catch {
        if (!cancelled) setDownloadUrl('')
      } finally {
        if (!cancelled) setDownloadLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
        {children}

        <section className="velix-download" aria-label="Descargar Velix">
          <p>Instala Velix en tu PC con Windows para usar tu licencia.</p>
          {downloadLoading ? (
            <div className="proyectos-status">
              <LoaderCircle className="spin" size={18} strokeWidth={2} aria-hidden />
              Cargando descarga...
            </div>
          ) : downloadUrl ? (
            <a
              className="btn-primary velix-download-btn"
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={16} strokeWidth={2} aria-hidden />
              Descargar Velix para Windows
            </a>
          ) : (
            <p className="velix-status">El instalador aún no está publicado. Vuelve pronto.</p>
          )}
        </section>
      </main>
    </div>
  )
}

function PlansPanel({
  sessionEmail,
  idToken,
  onSessionUpdate,
}: {
  sessionEmail?: string | null
  idToken: string | null
  onSessionUpdate: (session: StoredSession) => void
}) {
  const [licencias, setLicencias] = useState<VelixLicencia[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState('')
  const [payError, setPayError] = useState('')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
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
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleBuy(licencia: VelixLicencia) {
    const token = (await getVelixIdToken()) || idToken
    if (!token) {
      setPayError('Inicia sesión o crea una cuenta para comprar')
      return
    }

    setPayError('')
    setPayingId(licencia.id)

    try {
      const result = await iniciarPagoVelix(token, licencia.id)

      if (result.mock && result.membresia) {
        const next = {
          idToken: token,
          usuario: {
            uid: result.membresia.uid,
            email: result.membresia.email,
            diasRestantes: result.membresia.diasRestantes,
            licenseExpiresAt: result.membresia.licenseExpiresAt,
            activa: result.membresia.activa,
          },
        }
        writeSession(next)
        onSessionUpdate(next)
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
        customerEmail: sessionEmail,
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

  return (
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

      {statusMessage ? <p className="velix-status">{statusMessage}</p> : null}
      {payError ? (
        <p className="login-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden />
          {payError}
        </p>
      ) : null}
    </section>
  )
}

/** Solo se monta sin sesión. Tras login hace reload completo (evita insertBefore). */
function VelixGuest() {
  const modeRef = useRef<'login' | 'registro'>('registro')

  function selectMode(mode: 'login' | 'registro') {
    modeRef.current = mode
    // Cambiar tabs sin setState: evita reconciliar el form con el DOM alterado.
    const buttons = document.querySelectorAll<HTMLButtonElement>('.velix-auth-tabs button')
    buttons[0]?.classList.toggle('is-active', mode === 'registro')
    buttons[1]?.classList.toggle('is-active', mode === 'login')
    const password = document.getElementById('velix-password') as HTMLInputElement | null
    if (password) {
      password.autocomplete = mode === 'login' ? 'current-password' : 'new-password'
    }
    const submitBtn = document.querySelector('.velix-panel .modal-form button[type="submit"]')
    if (submitBtn) {
      submitBtn.textContent = mode === 'registro' ? 'Crear cuenta' : 'Entrar'
    }
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') || '').trim()
    const password = String(data.get('password') || '')
    const mode = modeRef.current
    const submitBtn = form.querySelector('button[type="submit"]')

    for (const el of form.querySelectorAll('input, button')) {
      ;(el as HTMLInputElement | HTMLButtonElement).disabled = true
    }
    if (submitBtn) submitBtn.textContent = 'Entrando...'

    try {
      const user =
        mode === 'registro'
          ? await registroVelixClient(email, password)
          : await loginVelixClient(email, password)

      const idToken = await user.getIdToken()
      const usuario = await bootstrapVelixUser(idToken)
      writeSession({ idToken, usuario })
      reloadVelix()
    } catch (err) {
      for (const el of form.querySelectorAll('input, button')) {
        ;(el as HTMLInputElement | HTMLButtonElement).disabled = false
      }
      if (submitBtn) {
        submitBtn.textContent = mode === 'registro' ? 'Crear cuenta' : 'Entrar'
      }
      window.alert(mapVelixAuthError(err))
    }
  }

  return (
    <VelixShell>
      <div className="velix-grid">
        <section className="velix-panel">
          <div className="velix-tabs velix-auth-tabs">
            <button type="button" className="is-active" onClick={() => selectMode('registro')}>
              Crear cuenta
            </button>
            <button type="button" onClick={() => selectMode('login')}>
              Iniciar sesión
            </button>
          </div>

          <form className="modal-form" onSubmit={(e) => void handleAuth(e)} noValidate>
            <label className="login-field" htmlFor="velix-email">
              Correo
              <input
                id="velix-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                defaultValue=""
              />
            </label>
            <label className="login-field" htmlFor="velix-password">
              Contraseña
              <input
                id="velix-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                defaultValue=""
              />
            </label>

            <button type="submit" className="btn-primary">
              Crear cuenta
            </button>
          </form>
        </section>

        <PlansPanel sessionEmail={null} idToken={null} onSessionUpdate={() => undefined} />
      </div>
    </VelixShell>
  )
}

function VelixMember({ initial }: { initial: StoredSession }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [session, setSession] = useState(initial)
  const [hasPendingPayment, setHasPendingPayment] = useState(() => Boolean(readPendingPayment()))
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [payError, setPayError] = useState('')

  useEffect(() => {
    const transactionId = searchParams.get('id')
    if (!transactionId) return

    const pending = readPendingPayment()
    if (!pending) {
      setPayError(
        'Volviste de Wompi, pero no hay un pago pendiente en esta sesión. Usa “Ya pagué”.',
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
          const next = { idToken: token, usuario }
          setSession(next)
          writeSession(next)
        }

        writePendingPayment(null)
        setHasPendingPayment(false)
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

  async function handleLogout() {
    try {
      await logoutVelixClient()
    } catch {
      // ignore
    }
    writeSession(null)
    reloadVelix()
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
      const token = (await getVelixIdToken(true)) || session.idToken
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
      setHasPendingPayment(false)
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
    <VelixShell>
      <div className="velix-grid">
        <section className="velix-panel">
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
            {hasPendingPayment ? (
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

          {statusMessage ? <p className="velix-status">{statusMessage}</p> : null}
          {confirmingPayment ? (
            <p className="velix-status">Confirmando pago con Wompi...</p>
          ) : null}
          {payError ? (
            <p className="login-error" role="alert">
              <AlertCircle size={16} strokeWidth={2} aria-hidden />
              {payError}
            </p>
          ) : null}
        </section>

        <PlansPanel
          sessionEmail={session.usuario.email}
          idToken={session.idToken}
          onSessionUpdate={setSession}
        />
      </div>
    </VelixShell>
  )
}

export function VelixPublic() {
  // Árboles separados: nunca se monta el form y la cuenta en la misma vida del árbol.
  const session = readSession()
  if (session) return <VelixMember initial={session} />
  return <VelixGuest />
}
