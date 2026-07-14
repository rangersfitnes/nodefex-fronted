import { API_URL } from '../config'

export type Proyecto = {
  id: string
  nombre: string
  descripcion: string
  createdAt: string | null
  updatedAt: string | null
}

export type ProyectoUsuario = {
  uid: string
  email: string | null
  disabled: boolean
  emailVerified: boolean
  createdAt: string | null
  lastSignInAt: string | null
  diasRestantes: number
  licenseExpiresAt: string | null
  activa: boolean
  timezone: string
}

/** Proyectos con Firebase Auth externo gestionable desde el admin */
export function proyectoSoportaUsuarios(proyectoId: string): boolean {
  return decodeURIComponent(proyectoId).trim().toLowerCase() === 'velix'
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

export async function listProyectos(token: string): Promise<Proyecto[]> {
  const data = await apiFetch<{ proyectos: Proyecto[] }>('/api/proyectos', token)
  return data.proyectos
}

export async function getProyecto(token: string, id: string): Promise<Proyecto> {
  const data = await apiFetch<{ proyecto: Proyecto }>(
    `/api/proyectos/${encodeURIComponent(id)}`,
    token,
  )
  return data.proyecto
}

export async function createProyecto(
  token: string,
  payload: { nombre: string; descripcion: string },
): Promise<Proyecto> {
  const data = await apiFetch<{ proyecto: Proyecto }>('/api/proyectos', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.proyecto
}

export async function deleteProyecto(token: string, id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/proyectos/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}

export async function listUsuariosProyecto(
  token: string,
  proyectoId: string,
): Promise<ProyectoUsuario[]> {
  const data = await apiFetch<{ usuarios: ProyectoUsuario[] }>(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/usuarios`,
    token,
  )
  return data.usuarios
}

export async function createUsuarioProyecto(
  token: string,
  proyectoId: string,
  payload: { email: string; password: string },
): Promise<ProyectoUsuario> {
  const data = await apiFetch<{ usuario: ProyectoUsuario }>(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/usuarios`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data.usuario
}

export type LicenciaPlan = {
  id: string
  nombre: string
  descripcion: string
  dias: number
  precio: number
  activo: boolean
  createdAt: string | null
  updatedAt: string | null
}

export async function listLicenciasProyecto(
  token: string,
  proyectoId: string,
): Promise<LicenciaPlan[]> {
  const data = await apiFetch<{ licencias: LicenciaPlan[] }>(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/licencias`,
    token,
  )
  return data.licencias
}

export async function createLicenciaProyecto(
  token: string,
  proyectoId: string,
  payload: { nombre: string; descripcion: string; dias: number; precio: number },
): Promise<LicenciaPlan> {
  const data = await apiFetch<{ licencia: LicenciaPlan }>(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/licencias`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data.licencia
}

export async function deleteLicenciaProyecto(
  token: string,
  proyectoId: string,
  licenciaId: string,
): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/licencias/${encodeURIComponent(licenciaId)}`,
    token,
    { method: 'DELETE' },
  )
}

export type LinkLicencia = {
  id: string
  url: string
  updatedAt: string | null
}

export async function getLinkLicenciaProyecto(
  token: string,
  proyectoId: string,
): Promise<LinkLicencia> {
  const data = await apiFetch<{ linkLicencia: LinkLicencia }>(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/link-licencia`,
    token,
  )
  return data.linkLicencia
}

export async function saveLinkLicenciaProyecto(
  token: string,
  proyectoId: string,
  url: string,
): Promise<LinkLicencia> {
  const data = await apiFetch<{ linkLicencia: LinkLicencia }>(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/link-licencia`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ url }),
    },
  )
  return data.linkLicencia
}

export async function agregarMembresiaProyecto(
  token: string,
  proyectoId: string,
  payload: { uid: string; dias: number },
): Promise<ProyectoUsuario> {
  const data = await apiFetch<{
    membresia: {
      uid: string
      email: string | null
      diasRestantes: number
      licenseExpiresAt: string | null
      activa: boolean
      timezone: string
    }
  }>(`/api/proyectos/${encodeURIComponent(proyectoId)}/usuarios/membresias`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return {
    uid: data.membresia.uid,
    email: data.membresia.email,
    disabled: false,
    emailVerified: false,
    createdAt: null,
    lastSignInAt: null,
    diasRestantes: data.membresia.diasRestantes,
    licenseExpiresAt: data.membresia.licenseExpiresAt,
    activa: data.membresia.activa,
    timezone: data.membresia.timezone,
  }
}
