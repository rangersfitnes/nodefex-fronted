import { API_URL } from '../config'

export type AvIngresoEstado = 'pendiente' | 'parcial' | 'pagado' | 'vencido'

export type AvPlan = {
  id: string
  nombre: string | null
  creditos: number
  precio: number
  descripcion: string | null
  activo: boolean
  orden: number
  creadoEn: string | null
  actualizadoEn: string | null
  createdBy: string | null
}

export type AvTipoPersona = 'persona' | 'empresa'
export type AvTipoComercial = 'emprendimiento' | 'empresa' | 'persona_natural' | 'otro'
export type AvServicioInteres =
  | 'produccion_audiovisual'
  | 'fotografia'
  | 'video'
  | 'manejo_de_redes'
  | 'marketing_digital'
  | 'pagina_web'
  | 'landing_page'
  | 'bot'
  | 'software_a_medida'
  | 'otro'
export type AvComoNosConocio = 'instagram' | 'whatsapp' | 'referido' | 'web' | 'otro'

export type AvCliente = {
  id: string
  tipoPersona: AvTipoPersona | null
  nombre: string | null
  documento: string | null
  contactoNombre: string | null
  telefono: string | null
  correo: string | null
  ciudad: string | null
  direccion: string | null
  tipoComercial: AvTipoComercial | null
  tipoComercialOtro: string | null
  serviciosInteres: AvServicioInteres[]
  servicioOtro: string | null
  comoNosConocio: AvComoNosConocio | null
  comoNosConocioOtro: string | null
  referidoVendedor: string | null
  responsable: string | null
  notas: string | null
  creadoEn: string | null
  actualizadoEn: string | null
  createdBy: string | null
}

export type AvClienteCreatePayload = {
  tipoPersona: AvTipoPersona
  nombre: string
  documento: string
  contactoNombre?: string
  telefono: string
  correo: string
  ciudad: string
  direccion?: string
  tipoComercial: AvTipoComercial
  tipoComercialOtro?: string
  serviciosInteres: AvServicioInteres[]
  servicioOtro?: string
  comoNosConocio: AvComoNosConocio
  comoNosConocioOtro?: string
  referidoVendedor?: string
  responsable: string
  notas?: string
}

export type AvPago = {
  id: string
  valor: number
  fecha: string | null
  metodoPago: string | null
  referencia: string | null
  notas: string | null
  creadoEn: string | null
  createdBy: string | null
}

export type AvIngreso = {
  id: string
  cliente: string | null
  proyecto: string | null
  concepto: string | null
  valor: number
  unidad: 'COP'
  planId: string | null
  planNombre: string | null
  creditos: number | null
  fechaEmision: string | null
  fechaVencimiento: string | null
  estado: AvIngresoEstado
  estadoManual: string | null
  totalPagado: number
  saldoPendiente: number
  notas: string | null
  creadoEn: string | null
  actualizadoEn: string | null
  createdBy: string | null
  pagos: AvPago[]
}

export type AvIngresosResumen = {
  totalFacturado: number
  totalCobrado: number
  totalPorCobrar: number
  totalVencido: number
  cantidad: number
}

export type AvIngresosFiltros = {
  clientes: string[]
  proyectos: string[]
  estados: AvIngresoEstado[]
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

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T
  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud')
  }
  return data
}

export async function listAvPlanes(
  token: string,
  options: { activos?: boolean } = {},
): Promise<AvPlan[]> {
  const params = new URLSearchParams()
  if (options.activos) params.set('activos', '1')
  const query = params.toString() ? `?${params.toString()}` : ''
  const data = await apiFetch<{ planes: AvPlan[] }>(`/api/audiovisual/planes${query}`, token)
  return data.planes
}

export async function createAvPlan(
  token: string,
  payload: {
    nombre: string
    creditos: number
    precio: number
    descripcion?: string
    activo?: boolean
    orden?: number
  },
): Promise<AvPlan> {
  const data = await apiFetch<{ plan: AvPlan }>('/api/audiovisual/planes', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.plan
}

export async function updateAvPlan(
  token: string,
  id: string,
  payload: Partial<{
    nombre: string
    creditos: number
    precio: number
    descripcion: string | null
    activo: boolean
    orden: number
  }>,
): Promise<AvPlan> {
  const data = await apiFetch<{ plan: AvPlan }>(
    `/api/audiovisual/planes/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return data.plan
}

export async function listAvClientes(token: string): Promise<AvCliente[]> {
  const data = await apiFetch<{ clientes: AvCliente[] }>('/api/audiovisual/clientes', token)
  return data.clientes
}

export async function createAvCliente(
  token: string,
  payload: AvClienteCreatePayload,
): Promise<AvCliente> {
  const data = await apiFetch<{ cliente: AvCliente }>('/api/audiovisual/clientes', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.cliente
}

export async function listAvIngresos(
  token: string,
  filters: {
    cliente?: string
    proyecto?: string
    estado?: string
    desde?: string
    hasta?: string
  } = {},
): Promise<{
  resumen: AvIngresosResumen
  ingresos: AvIngreso[]
  filtros: AvIngresosFiltros
}> {
  const params = new URLSearchParams()
  if (filters.cliente) params.set('cliente', filters.cliente)
  if (filters.proyecto) params.set('proyecto', filters.proyecto)
  if (filters.estado) params.set('estado', filters.estado)
  if (filters.desde) params.set('desde', filters.desde)
  if (filters.hasta) params.set('hasta', filters.hasta)
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/audiovisual/ingresos${query}`, token)
}

export async function getAvIngreso(token: string, id: string): Promise<AvIngreso> {
  const data = await apiFetch<{ ingreso: AvIngreso }>(
    `/api/audiovisual/ingresos/${encodeURIComponent(id)}`,
    token,
  )
  return data.ingreso
}

export async function createAvIngreso(
  token: string,
  payload: {
    cliente: string
    proyecto: string
    concepto: string
    valor: number
    fechaEmision: string
    fechaVencimiento: string
    notas?: string
    planId?: string
    creditos?: number
  },
): Promise<AvIngreso> {
  const data = await apiFetch<{ ingreso: AvIngreso }>('/api/audiovisual/ingresos', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.ingreso
}

export async function updateAvIngreso(
  token: string,
  id: string,
  payload: Partial<{
    cliente: string
    proyecto: string
    concepto: string
    valor: number
    fechaEmision: string
    fechaVencimiento: string
    notas: string | null
  }>,
): Promise<AvIngreso> {
  const data = await apiFetch<{ ingreso: AvIngreso }>(
    `/api/audiovisual/ingresos/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return data.ingreso
}

export async function deleteAvIngreso(token: string, id: string): Promise<void> {
  await apiFetch(`/api/audiovisual/ingresos/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}

export async function createAvPago(
  token: string,
  ingresoId: string,
  payload: {
    valor: number
    fecha: string
    metodoPago?: string
    referencia?: string
    notas?: string
  },
): Promise<AvIngreso> {
  const data = await apiFetch<{ ingreso: AvIngreso }>(
    `/api/audiovisual/ingresos/${encodeURIComponent(ingresoId)}/pagos`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data.ingreso
}

export async function deleteAvPago(
  token: string,
  ingresoId: string,
  pagoId: string,
): Promise<AvIngreso> {
  const data = await apiFetch<{ ingreso: AvIngreso }>(
    `/api/audiovisual/ingresos/${encodeURIComponent(ingresoId)}/pagos/${encodeURIComponent(pagoId)}`,
    token,
    { method: 'DELETE' },
  )
  return data.ingreso
}
