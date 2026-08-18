import { useEffect, useState, type FormEvent } from 'react'
import {
  confirmarPagoSistecontact,
  consultarMembresiaSistecontact,
  iniciarPagoSistecontact,
  listSistecontactPlanes,
  openWompiWebCheckout,
  type SistecontactPlan,
  type SistecontactUsuario,
} from '../api/sistecontact'

const EMAIL_KEY = 'sistecontact_checkout_email'
const PENDING_PAYMENT_KEY = 'sistecontact_pending_payment'
const APP_URL = 'https://sistecontact.nodefex.com'

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

export function SistecontactPublic() {
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || '')
  const [membresia, setMembresia] = useState<SistecontactUsuario | null>(null)
  const [formError, setFormError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [planes, setPlanes] = useState<SistecontactPlan[]>([])
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
        const result = await confirmarPagoSistecontact({
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
      const usuario = await consultarMembresiaSistecontact(value)
      setMembresia(usuario)
      setStatusMessage(
        usuario.access
          ? `Membresía activa · ${usuario.diasRestantes} días`
          : 'Este correo no tiene una membresía activa.',
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo consultar la membresía')
    } finally {
      setLookingUp(false)
    }
  }

  async function handlePay(plan: SistecontactPlan) {
    const value = email.trim().toLowerCase()
    if (!isValidEmail(value)) {
      setFormError('Escribe tu correo para activar la membresía')
      return
    }

    setPayingId(plan.id)
    setStatusMessage('')
    setFormError('')
    localStorage.setItem(EMAIL_KEY, value)

    try {
      const result = await iniciarPagoSistecontact(value, plan.id)

      if (result.mock) {
        if (result.membresia) setMembresia(result.membresia)
        setStatusMessage(
          result.mensaje ||
            `Pago simulado: se activaron ${result.licencia.dias} días de membresía.`,
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
        'Te redirigimos a Wompi. Al pagar, volverás aquí y se activará la membresía.',
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
        'Pega el ID de la transacción de Wompi o la referencia del pago (empieza por SC):',
      )
      if (!pasted?.trim()) return
      if (pasted.trim().startsWith('SC')) reference = pasted.trim()
      else transactionId = pasted.trim()
    }

    if (!value) {
      setFormError('Escribe el correo con el que pagaste')
      return
    }

    setConfirming(true)
    try {
      const result = await confirmarPagoSistecontact({
        email: value,
        reference: reference || undefined,
        transactionId: transactionId || undefined,
      })
      if (result.membresia) setMembresia(result.membresia)
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
        </div>
      </header>

      <main className="sc-main">
        <section className="sc-hero">
          <h1>Sistecontact</h1>
          <p>Elige un plan, indica tu correo y activa la membresía. No necesitas iniciar sesión.</p>
        </section>

        <div className="sc-grid">
          <section className="sc-panel">
            <h2>Correo para la membresía</h2>
            <p className="sc-panel-copy">
              Usa el mismo correo con el que entrarás a Sistecontact. Ahí se activa el acceso.
            </p>

            <form className="modal-form" onSubmit={(event) => void handleLookup(event)} noValidate>
              <label className="login-field" htmlFor="sc-email">
                Correo electrónico
                <input
                  id="sc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={Boolean(payingId) || confirming || lookingUp}
                  autoComplete="email"
                  placeholder="ivan.p@example.net"
                />
              </label>
              <button type="submit" className="btn-secondary" disabled={lookingUp || Boolean(payingId)}>
                {lookingUp ? 'Consultando...' : 'Consultar membresía'}
              </button>
            </form>

            {membresia ? (
              <div className="sc-account">
                <p className="sc-eyebrow">Estado</p>
                <p className="sc-email">{membresia.email || email}</p>
                <p className={`sc-access ${membresia.access ? 'is-on' : 'is-off'}`}>
                  Membresía: {membresia.access ? 'Activa' : 'Inactiva'}
                  {membresia.diasRestantes > 0 ? ` · ${membresia.diasRestantes} días` : ''}
                </p>
              </div>
            ) : null}

            <div className="sc-account-actions">
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
              El pago activa el acceso de ese correo en Sistecontact por la vigencia del plan.
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
      </main>
    </div>
  )
}
