import { API_URL } from '../config'

export type ContableTipo = 'ingresos' | 'egresos'

export type ContableMovimiento = {
  id: string
  fecha: string | null
  concepto: string | null
  categoria: string | null
  clienteId: string | null
  clienteNombre: string | null
  metodoPago: string | null
  valor: number | null
  referencia: string | null
  estado: string | null
  programa: string | null
  programaId: string | null
  origen: string | null
  creadoEn: string | null
  createdBy: string | null
}

export type ContableApiKey = {
  id: string
  programa: string | null
  prefix: string | null
  activa: boolean
  usos: number
  createdAt: string | null
  lastUsedAt: string | null
  createdBy: string | null
  key?: string
}

export type ContableResumenAnual = {
  tipo: ContableTipo
  año: number
  total: number
  totalIngresos?: number
  totalEgresos?: number
  cantidadMovimientos: number
  actualizadoEn?: string | null
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

export async function listContableAnios(
  token: string,
  tipo: ContableTipo,
): Promise<ContableResumenAnual[]> {
  const data = await apiFetch<{ años: ContableResumenAnual[] }>(
    `/api/contable/${tipo}`,
    token,
  )
  return data.años || []
}

export async function listContableMovimientos(
  token: string,
  tipo: ContableTipo,
  anio: number,
  mes?: number,
): Promise<{ resumenAnual: ContableResumenAnual; movimientos: ContableMovimiento[] }> {
  const query = mes ? `?mes=${mes}` : ''
  return apiFetch(`/api/contable/${tipo}/${anio}${query}`, token)
}

export async function listContableApiKeys(token: string): Promise<ContableApiKey[]> {
  const data = await apiFetch<{ apiKeys: ContableApiKey[] }>('/api/contable/api-keys', token)
  return data.apiKeys || []
}

export async function createContableApiKey(
  token: string,
  programa: string,
): Promise<ContableApiKey> {
  const data = await apiFetch<{ apiKey: ContableApiKey }>(
    '/api/contable/api-keys',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ programa }),
    },
  )
  return data.apiKey
}

export async function setContableApiKeyActiva(
  token: string,
  id: string,
  activa: boolean,
): Promise<ContableApiKey> {
  const data = await apiFetch<{ apiKey: ContableApiKey }>(
    `/api/contable/api-keys/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ activa }),
    },
  )
  return data.apiKey
}

export async function deleteContableApiKey(token: string, id: string): Promise<void> {
  await apiFetch(`/api/contable/api-keys/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}
