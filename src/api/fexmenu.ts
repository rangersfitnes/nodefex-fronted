import { API_URL } from '../config'
import { openWompiWebCheckout } from './sistecontact'

export type FexmenuUsuario = {
  uid: string
  email: string | null
  premium: boolean
  access: boolean
  diasRestantes: number
  expiresAt: string | null
  activa: boolean
  timezone?: string
}

export type FexmenuPlan = {
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

export async function listFexmenuPlanes(): Promise<FexmenuPlan[]> {
  const data = await publicFetch<{ licencias: FexmenuPlan[] }>('/api/fexmenu/licencias')
  return data.licencias
}

export async function consultarMembresiaFexmenu(email: string): Promise<{
  registrado: boolean
  usuario: FexmenuUsuario | null
}> {
  const data = await publicFetch<{
    registrado?: boolean
    usuario?: FexmenuUsuario | null
  }>('/api/fexmenu/membresia', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  const usuario = data.usuario?.uid ? data.usuario : null
  return {
    registrado: data.registrado !== false && Boolean(usuario),
    usuario,
  }
}

export async function iniciarPagoFexmenu(
  email: string,
  licenciaId: string,
): Promise<{
  mock: boolean
  mensaje?: string
  membresia?: FexmenuUsuario | null
  checkout: CheckoutPayload | null
  licencia: FexmenuPlan
}> {
  return publicFetch('/api/fexmenu/pagos/iniciar', {
    method: 'POST',
    body: JSON.stringify({ email, licenciaId }),
  })
}

export async function confirmarPagoFexmenu(payload: {
  email?: string
  reference?: string
  transactionId?: string
}): Promise<{
  activated: boolean
  alreadyActivated?: boolean
  membresia: FexmenuUsuario | null
  pago: { reference: string; status?: string; dias?: number }
}> {
  return publicFetch('/api/fexmenu/pagos/confirmar', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export { openWompiWebCheckout }
