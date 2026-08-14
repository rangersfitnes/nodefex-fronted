import { API_URL } from '../config'

export type AdminAccion =
  | 'create_users'
  | 'delete_users'
  | 'activate_memberships'
  | 'manage_plans'
  | 'manage_settings'

export const ADMIN_ACCIONES: { id: AdminAccion; label: string }[] = [
  { id: 'create_users', label: 'Crear usuarios' },
  { id: 'delete_users', label: 'Eliminar usuarios' },
  { id: 'activate_memberships', label: 'Activar membresías' },
  { id: 'manage_plans', label: 'Crear y eliminar planes' },
  { id: 'manage_settings', label: 'Editar links y WhatsApp' },
]

export type ProyectoAccesoNivel = 'view' | 'manage' | 'custom'

export type ProyectoAccesoConfig = {
  nivel: ProyectoAccesoNivel
  acciones: AdminAccion[]
}

export type AdministradorRol = 'owner' | 'admin'

export type Administrador = {
  uid: string
  email: string | null
  nombre: string | null
  cedula: string | null
  rol: AdministradorRol
  accesos: Record<string, ProyectoAccesoConfig>
  createdAt: string | null
  updatedAt: string | null
  lastSignInAt: string | null
}

async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })

  const data = (await response.json().catch(() => ({}))) as {
    error?: string
  } & T

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud')
  }

  return data
}

export async function getMe(token: string): Promise<Administrador> {
  const data = await apiFetch<{ administrador: Administrador }>('/api/me', token)
  return data.administrador
}

export async function listAdministradores(token: string): Promise<Administrador[]> {
  const data = await apiFetch<{ administradores: Administrador[] }>(
    '/api/administradores',
    token,
  )
  return data.administradores
}

export async function createAdministrador(
  token: string,
  payload: { email: string; password: string; nombre?: string; cedula?: string },
): Promise<Administrador> {
  const data = await apiFetch<{ administrador: Administrador }>(
    '/api/administradores',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data.administrador
}

export async function registrarAdministradorPublico(payload: {
  nombre: string
  cedula: string
  email: string
  password: string
}): Promise<Administrador> {
  const response = await fetch(`${API_URL}/api/registro-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await response.json().catch(() => ({}))) as {
    error?: string
    administrador?: Administrador
  }
  if (!response.ok || !data.administrador) {
    throw new Error(data.error || 'No se pudo completar el registro')
  }
  return data.administrador
}

export async function getAdministrador(
  token: string,
  uid: string,
): Promise<Administrador> {
  const data = await apiFetch<{ administrador: Administrador }>(
    `/api/administradores/${encodeURIComponent(uid)}`,
    token,
  )
  return data.administrador
}

export async function deleteAdministrador(token: string, uid: string): Promise<void> {
  await apiFetch(`/api/administradores/${encodeURIComponent(uid)}`, token, {
    method: 'DELETE',
  })
}

export async function saveAdministradorAccesos(
  token: string,
  uid: string,
  accesos: Record<string, ProyectoAccesoConfig>,
): Promise<Administrador> {
  const data = await apiFetch<{ administrador: Administrador }>(
    `/api/administradores/${encodeURIComponent(uid)}/accesos`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ accesos }),
    },
  )
  return data.administrador
}
