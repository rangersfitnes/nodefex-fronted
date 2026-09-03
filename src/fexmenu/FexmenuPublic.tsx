import { useEffect, useState, type FormEvent } from 'react'
import {
  confirmarPagoFexmenu,
  consultarMembresiaFexmenu,
  iniciarPagoFexmenu,
  listFexmenuPlanes,
  openWompiWebCheckout,
  type FexmenuPlan,
  type FexmenuUsuario,
} from '../api/fexmenu'

const EMAIL_KEY = 'fexmenu_checkout_email'
const PENDING_PAYMENT_KEY = 'fexmenu_pending_payment'
const APP_URL = 'https://fexmenu.nodefex.com'
const LOGO_SRC = '/fexmenu-logo.png'

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isPremiumActive(usuario: FexmenuUsuario | null) {
  return Boolean(usuario?.premium ?? usuario?.access)
}

function readPendingPayment(): { reference: string; email: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_PAYMENT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { reference: string; email: string }
  } catch {
    return null
  }
}

function writePendingPayment(reference: string, email: string) {
  localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ reference, email }))
}

function clearPendingPayment() {
  localStorage.removeItem(PENDING_PAYMENT_KEY)
}

export function FexmenuPublic() {
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || '')
  const [membresia, setMembresia] = useState<FexmenuUsuario | null>(null)
  const [formError, setFormError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [planes, setPlanes] = useState<FexmenuPlan[]>([])
  const [planesLoading, setPlanesLoading] = useState(true)
  const [planesError, setPlanesError] = useState('')
  const [payingId, setPayingId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadPlanes() {
      setPlanesLoading(true)
      setPlanesError('')
      try {
        const data = await listFexmenuPlanes()
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
    const pending = readPendingPayment()
    const params = new URLSearchParams(window.location.search)
    const transactionId =
      params.get('id') || params.get('transaction_id') || params.get('transactionId')

    if (!transactionId && !pending?.reference) return

    let cancelled = false

    async function confirm() {
      setConfirming(true)
      setStatusMessage('Confirmando pago con Wompi...')
      try {
        const result = await confirmarPagoFexmenu({
          email: pending?.email || email.trim().toLowerCase(),
          reference: pending?.reference,
          transactionId: transactionId || '',
        })
        if (cancelled) return
        if (result.membresia) setMembresia(result.membresia)
        if (pending?.email) {
          setEmail(pending.email)
          localStorage.setItem(EMAIL_KEY, pending.email)
        }
        clearPendingPayment()
        setStatusMessage(
          result.activated || result.alreadyActivated
            ? `Premium activo. Te quedan ${result.membresia?.diasRestantes ?? 0} días.`
            : 'Pago recibido. Si no se activó, usa “Ya pagué”.',
        )
        window.history.replaceState({}, '', '/fexmenu')
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
  }, [])

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = email.trim().toLowerCase()
    if (!isValidEmail(value)) {
      setFormError('Escribe un correo válido')
      return
    }
    setFormError('')
    setLookingUp(true)
    try {
      localStorage.setItem(EMAIL_KEY, value)
      const { usuario, registrado } = await consultarMembresiaFexmenu(value)
      setMembresia(usuario)
      if (!registrado || !usuario) {
        setStatusMessage(
          'Este correo no está registrado en Fexmenu. Crea tu cuenta primero y luego paga la membresía.',
        )
        return
      }
      setStatusMessage(
        isPremiumActive(usuario)
          ? `Cuenta encontrada · premium activo · ${usuario.diasRestantes} días`
          : 'Cuenta encontrada. Este correo aún no tiene premium activo.',
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo consultar la membresía')
    } finally {
      setLookingUp(false)
    }
  }

  async function handlePay(plan: FexmenuPlan) {
    const value = email.trim().toLowerCase()
    if (!isValidEmail(value)) {
      setFormError('Escribe el correo de tu cuenta registrada en Fexmenu')
      return
    }

    setPayingId(plan.id)
    setStatusMessage('')
    setFormError('')
    localStorage.setItem(EMAIL_KEY, value)

    try {
      const result = await iniciarPagoFexmenu(value, plan.id)

      if (result.mock) {
        if (result.membresia) setMembresia(result.membresia)
        setStatusMessage(
          result.mensaje ||
            `Pago simulado: se activaron ${result.licencia.dias} días de premium.`,
        )
        return
      }

      if (!result.checkout) {
        throw new Error('No se recibió información de checkout de Wompi')
      }

      writePendingPayment(result.checkout.reference, value)
      openWompiWebCheckout({
        ...result.checkout,
        customerEmail: result.checkout.customerEmail || value,
      })
      setStatusMessage(
        'Te redirigimos a Wompi. Al pagar, volverás aquí y se activará el premium.',
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo iniciar el pago')
    } finally {
      setPayingId('')
    }
  }

  async function handleConfirmManual() {
    const pending = readPendingPayment()
    const value = (pending?.email || email).trim().toLowerCase()
    const params = new URLSearchParams(window.location.search)
    let transactionId =
      params.get('id') || params.get('transaction_id') || params.get('transactionId') || ''
    let reference = pending?.reference || ''

    if (!reference && !transactionId) {
      const pasted = window.prompt(
        'Pega el ID de la transacción de Wompi o la referencia del pago (empieza por FM):',
      )
      if (!pasted?.trim()) return
      if (pasted.trim().startsWith('FM')) reference = pasted.trim()
      else transactionId = pasted.trim()
    }

    if (!value) {
      setFormError('Escribe el correo con el que pagaste')
      return
    }

    setConfirming(true)
    try {
      const result = await confirmarPagoFexmenu({
        email: value,
        reference: reference || undefined,
        transactionId: transactionId || undefined,
      })
      if (result.membresia) setMembresia(result.membresia)
      clearPendingPayment()
      setStatusMessage(
        `Premium actualizado. Estado ${isPremiumActive(result.membresia) ? 'activo' : 'inactivo'} · ${result.membresia?.diasRestantes ?? 0} días.`,
      )
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'No se pudo confirmar el pago')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="fm-page">
      <header className="fm-header">
        <div className="fm-brand">
          <img className="fm-logo" src={LOGO_SRC} alt="Fexmenu" width={48} height={48} />
          <div>
            <p className="fm-brand-name">Fexmenu</p>
            <p className="fm-brand-tag">Membresía premium</p>
          </div>
        </div>
        <a className="fm-btn fm-btn-outline" href={APP_URL} target="_blank" rel="noreferrer">
          Abrir app
        </a>
      </header>

      <main className="fm-main">
        <section className="fm-hero">
          <h1>Paga tu membresía</h1>
          <p>
            Usa el mismo correo con el que entras a Fexmenu.{' '}
            <a href={APP_URL} target="_blank" rel="noreferrer">
              Crear cuenta
            </a>
          </p>
        </section>

        <div className="fm-grid">
          <section className="fm-panel">
            <h2>Tu correo</h2>

            <form className="fm-form" onSubmit={(event) => void handleLookup(event)} noValidate>
              <label className="fm-field" htmlFor="fm-email">
                Correo electrónico
                <input
                  id="fm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={Boolean(payingId) || confirming || lookingUp}
                  autoComplete="email"
                  placeholder="cliente@restaurante.com"
                />
              </label>
              <button
                type="submit"
                className="fm-btn fm-btn-primary"
                disabled={lookingUp || Boolean(payingId)}
              >
                {lookingUp ? 'Consultando...' : 'Consultar'}
              </button>
            </form>

            {membresia ? (
              <div className={`fm-status ${isPremiumActive(membresia) ? 'is-on' : 'is-off'}`}>
                <p className="fm-status-email">{membresia.email || email}</p>
                <p>
                  {isPremiumActive(membresia) ? 'Premium activo' : 'Premium inactivo'}
                  {membresia.diasRestantes > 0 ? ` · ${membresia.diasRestantes} días` : ''}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              className="fm-btn fm-btn-outline fm-btn-block"
              onClick={() => void handleConfirmManual()}
              disabled={confirming}
            >
              {confirming ? 'Confirmando...' : 'Ya pagué'}
            </button>

            {statusMessage ? <p className="fm-note">{statusMessage}</p> : null}
            {formError ? (
              <p className="fm-error" role="alert">
                {formError}
              </p>
            ) : null}
          </section>

          <section className="fm-panel">
            <h2>Planes</h2>
            <p className="fm-panel-copy">El pago activa premium en tu correo.</p>

            {planesLoading ? <p className="fm-note">Cargando planes...</p> : null}
            {planesError ? (
              <p className="fm-error" role="alert">
                {planesError}
              </p>
            ) : null}
            {!planesLoading && !planesError && planes.length === 0 ? (
              <p className="fm-note">Aún no hay planes publicados.</p>
            ) : null}

            <div className="fm-plans">
              {planes.map((plan) => (
                <article key={plan.id} className="fm-plan">
                  <div className="fm-plan-body">
                    <h3>{plan.nombre}</h3>
                    <p>{plan.descripcion || `${plan.dias} días de premium`}</p>
                    <p className="fm-plan-price">
                      {plan.dias} días · {formatCop(plan.precio)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="fm-btn fm-btn-primary"
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
      </main>
    </div>
  )
}
