import { API_URL } from '../config'

export type VelixUsuario = {
  uid: string
  email: string | null
  diasRestantes: number
  licenseExpiresAt: string | null
  activa: boolean
}

export type VelixLicencia = {
  id: string
  nombre: string
  descripcion: string
  dias: number
  precio: number
  activo: boolean
}

export type CheckoutPayload = {
  publicKey: string
  currency: string
  amountInCents: number
  reference: string
  integrity: string
  redirectUrl: string | null
}

async function publicFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T
  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud')
  }
  return data
}

async function authFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  return publicFetch<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
}

export async function bootstrapVelixUser(token: string): Promise<VelixUsuario> {
  const data = await authFetch<{ usuario: VelixUsuario }>('/api/velix/bootstrap', token, {
    method: 'POST',
  })
  return data.usuario
}

export async function listLicenciasPublicas(): Promise<VelixLicencia[]> {
  const data = await publicFetch<{ licencias: VelixLicencia[] }>('/api/velix/licencias')
  return data.licencias
}

export async function getLinkLicenciaPublico(): Promise<{ url: string; updatedAt: string | null }> {
  const data = await publicFetch<{ linkLicencia: { url: string; updatedAt: string | null } }>(
    '/api/velix/link-licencia',
  )
  return data.linkLicencia
}

export async function getVelixMe(token: string): Promise<VelixUsuario> {
  const data = await authFetch<{ usuario: VelixUsuario }>('/api/velix/me', token)
  return data.usuario
}

export async function iniciarPagoVelix(
  token: string,
  licenciaId: string,
): Promise<{
  mock: boolean
  mensaje?: string
  membresia?: VelixUsuario | null
  checkout: CheckoutPayload | null
  licencia: VelixLicencia
}> {
  return authFetch('/api/velix/pagos/iniciar', token, {
    method: 'POST',
    body: JSON.stringify({ licenciaId }),
  })
}

export async function confirmarPagoVelix(
  token: string,
  payload: { reference: string; transactionId: string },
): Promise<{
  activated: boolean
  membresia: VelixUsuario | null
  pago: { reference: string; status?: string; dias?: number }
}> {
  return authFetch('/api/velix/pagos/confirmar', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: {
      currency: string
      amountInCents: number
      reference: string
      publicKey: string
      signature: { integrity: string }
      redirectUrl?: string
      customerData?: { email?: string }
    }) => {
      open: (cb: (result: {
        transaction?: { id?: string; status?: string; reference?: string }
      }) => void) => void
    }
  }
}

export function openWompiWebCheckout(checkout: {
  publicKey: string
  currency: string
  amountInCents: number
  reference: string
  integrity: string
  redirectUrl?: string | null
  customerEmail?: string | null
}) {
  const form = document.createElement('form')
  form.method = 'GET'
  form.action = 'https://checkout.wompi.co/p/'
  form.target = '_blank'
  form.style.display = 'none'

  const fields: Record<string, string> = {
    'public-key': checkout.publicKey,
    currency: checkout.currency,
    'amount-in-cents': String(checkout.amountInCents),
    reference: checkout.reference,
    'signature:integrity': checkout.integrity,
  }

  if (checkout.redirectUrl) {
    fields['redirect-url'] = checkout.redirectUrl
  }
  if (checkout.customerEmail) {
    fields['customer-data:email'] = checkout.customerEmail
  }

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
  form.remove()
}

export function loadWompiWidget(): Promise<void> {
  if (window.WidgetCheckout) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-wompi-widget]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Wompi')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.wompi.co/widget.js'
    script.async = true
    script.dataset.wompiWidget = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Wompi'))
    document.body.appendChild(script)
  })
}
