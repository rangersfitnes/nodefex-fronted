import { API_URL } from '../config'

export type SistecontactUsuario = {
  uid: string
  email: string | null
  access: boolean
  diasRestantes: number
  expiresAt: string | null
  activa: boolean
  timezone?: string
}

export type SistecontactPlan = {
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
  customerEmail?: string | null
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

export async function bootstrapSistecontactUser(
  token: string,
): Promise<SistecontactUsuario> {
  const data = await authFetch<{ usuario: SistecontactUsuario }>(
    '/api/sistecontact/bootstrap',
    token,
    { method: 'POST' },
  )
  return data.usuario
}

export async function getSistecontactMe(token: string): Promise<SistecontactUsuario> {
  const data = await authFetch<{ usuario: SistecontactUsuario }>(
    '/api/sistecontact/me',
    token,
  )
  return data.usuario
}

export async function listSistecontactPlanes(): Promise<SistecontactPlan[]> {
  const data = await publicFetch<{ licencias: SistecontactPlan[] }>(
    '/api/sistecontact/licencias',
  )
  return data.licencias
}

export async function consultarMembresiaSistecontact(
  email: string,
): Promise<SistecontactUsuario> {
  const data = await publicFetch<{ usuario: SistecontactUsuario }>(
    '/api/sistecontact/membresia',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
  )
  return data.usuario
}

export async function iniciarPagoSistecontact(
  email: string,
  licenciaId: string,
): Promise<{
  mock: boolean
  mensaje?: string
  membresia?: SistecontactUsuario | null
  checkout: CheckoutPayload | null
  licencia: SistecontactPlan
}> {
  return publicFetch('/api/sistecontact/pagos/iniciar', {
    method: 'POST',
    body: JSON.stringify({ email, licenciaId }),
  })
}

export async function confirmarPagoSistecontact(payload: {
  email?: string
  reference?: string
  transactionId?: string
}): Promise<{
  activated: boolean
  alreadyActivated?: boolean
  membresia: SistecontactUsuario | null
  pago: { reference: string; status?: string; dias?: number }
}> {
  return publicFetch('/api/sistecontact/pagos/confirmar', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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
