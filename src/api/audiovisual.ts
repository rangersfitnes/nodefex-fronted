import { API_URL } from '../config'

export type AvFacturaEstado = 'pendiente' | 'parcial' | 'pagado' | 'vencido'

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

export type AvClienteUpdatePayload = {
  tipoPersona?: AvTipoPersona
  nombre?: string
  contactoNombre?: string | null
  telefono?: string
  correo?: string
  ciudad?: string
  direccion?: string | null
  tipoComercial?: AvTipoComercial
  tipoComercialOtro?: string | null
  serviciosInteres?: AvServicioInteres[]
  servicioOtro?: string | null
  comoNosConocio?: AvComoNosConocio
  comoNosConocioOtro?: string | null
  referidoVendedor?: string | null
  responsable?: string
  notas?: string | null
}

export type AvMetodoPagoTipo = 'efectivo' | 'cuenta_bancaria' | 'pasarela'

export type AvPagoParte = {
  tipo: AvMetodoPagoTipo
  valor: number
  cuenta: string | null
  detalle: string | null
}

export type AvPago = {
  id: string
  valor: number
  fecha: string | null
  metodoPago: string | null
  partes: AvPagoParte[]
  referencia: string | null
  notas: string | null
  creadoEn: string | null
  createdBy: string | null
}

export type AvFactura = {
  id: string
  numero: string | null
  cliente: string | null
  clienteId: string | null
  concepto: string | null
  valor: number
  unidad: 'COP'
  planId: string | null
  planNombre: string | null
  creditos: number | null
  fechaEmision: string | null
  fechaVencimiento: string | null
  estado: AvFacturaEstado
  estadoManual: string | null
  totalPagado: number
  saldoPendiente: number
  notas: string | null
  origen: string | null
  creadoEn: string | null
  actualizadoEn: string | null
  createdBy: string | null
  pagos: AvPago[]
}

export type AvFacturasResumen = {
  totalFacturado: number
  totalCobrado: number
  totalPorCobrar: number
  totalVencido: number
  cantidad: number
}

export type AvFacturasFiltros = {
  clientes: string[]
  estados: AvFacturaEstado[]
}

export type AvIngresoCaja = {
  id: string
  fecha: string | null
  concepto: string | null
  valor: number
  numeroFactura: string | null
  metodoPago: string | null
  partes: AvPagoParte[]
  creadoEn: string | null
  actualizadoEn: string | null
  createdBy: string | null
}

export type AvIngresosCajaResumen = {
  total: number
  cantidad: number
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

export async function getAvCliente(token: string, id: string): Promise<AvCliente> {
  const data = await apiFetch<{ cliente: AvCliente }>(
    `/api/audiovisual/clientes/${encodeURIComponent(id)}`,
    token,
  )
  return data.cliente
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

export async function updateAvCliente(
  token: string,
  id: string,
  payload: AvClienteUpdatePayload,
): Promise<AvCliente> {
  const data = await apiFetch<{ cliente: AvCliente }>(
    `/api/audiovisual/clientes/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return data.cliente
}

export async function listAvFacturas(
  token: string,
  filters: {
    cliente?: string
    clienteId?: string
    estado?: string
    desde?: string
    hasta?: string
  } = {},
): Promise<{
  resumen: AvFacturasResumen
  facturas: AvFactura[]
  filtros: AvFacturasFiltros
}> {
  const params = new URLSearchParams()
  if (filters.cliente) params.set('cliente', filters.cliente)
  if (filters.clienteId) params.set('clienteId', filters.clienteId)
  if (filters.estado) params.set('estado', filters.estado)
  if (filters.desde) params.set('desde', filters.desde)
  if (filters.hasta) params.set('hasta', filters.hasta)
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/audiovisual/facturas${query}`, token)
}

export async function getAvFactura(token: string, id: string): Promise<AvFactura> {
  const data = await apiFetch<{ factura: AvFactura }>(
    `/api/audiovisual/facturas/${encodeURIComponent(id)}`,
    token,
  )
  return data.factura
}

export async function createAvFactura(
  token: string,
  payload: {
    cliente: string
    clienteId?: string
    planId: string
    fechaEmision?: string
    notas?: string
  },
): Promise<AvFactura> {
  const data = await apiFetch<{ factura: AvFactura }>('/api/audiovisual/facturas', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.factura
}

export async function updateAvFactura(
  token: string,
  id: string,
  payload: Partial<{
    cliente: string
    fechaEmision: string
    notas: string | null
  }>,
): Promise<AvFactura> {
  const data = await apiFetch<{ factura: AvFactura }>(
    `/api/audiovisual/facturas/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return data.factura
}

export async function deleteAvFactura(token: string, id: string): Promise<void> {
  await apiFetch(`/api/audiovisual/facturas/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}

export async function createAvFacturaPago(
  token: string,
  facturaId: string,
  payload: {
    valor: number
    fecha: string
    partes: Array<{
      tipo: AvMetodoPagoTipo
      valor: number
      cuenta?: string
      detalle?: string
    }>
    metodoPago?: string
    referencia?: string
    notas?: string
  },
): Promise<AvFactura> {
  const data = await apiFetch<{ factura: AvFactura }>(
    `/api/audiovisual/facturas/${encodeURIComponent(facturaId)}/pagos`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data.factura
}

export async function deleteAvFacturaPago(
  token: string,
  facturaId: string,
  pagoId: string,
): Promise<AvFactura> {
  const data = await apiFetch<{ factura: AvFactura }>(
    `/api/audiovisual/facturas/${encodeURIComponent(facturaId)}/pagos/${encodeURIComponent(pagoId)}`,
    token,
    { method: 'DELETE' },
  )
  return data.factura
}

export async function listAvIngresosCaja(token: string): Promise<{
  ingresos: AvIngresoCaja[]
  resumen: AvIngresosCajaResumen
}> {
  return apiFetch('/api/audiovisual/ingresos', token)
}

export async function createAvIngresoCaja(
  token: string,
  payload: {
    fecha?: string
    concepto: string
    valor: number
    numeroFactura?: string
    partes: Array<{
      tipo: AvMetodoPagoTipo
      valor: number
      cuenta?: string
      detalle?: string
    }>
  },
): Promise<AvIngresoCaja> {
  const data = await apiFetch<{ ingreso: AvIngresoCaja }>('/api/audiovisual/ingresos', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.ingreso
}

export async function updateAvIngresoCaja(
  token: string,
  id: string,
  payload: Partial<{
    fecha: string
    concepto: string
    valor: number
    numeroFactura: string | null
    partes: Array<{
      tipo: AvMetodoPagoTipo
      valor: number
      cuenta?: string
      detalle?: string
    }>
  }>,
): Promise<AvIngresoCaja> {
  const data = await apiFetch<{ ingreso: AvIngresoCaja }>(
    `/api/audiovisual/ingresos/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return data.ingreso
}

export async function deleteAvIngresoCaja(token: string, id: string): Promise<void> {
  await apiFetch(`/api/audiovisual/ingresos/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}

export type AvEgreso = {
  id: string
  fecha: string | null
  concepto: string | null
  valor: number
  unidad: 'COP'
  creadoEn: string | null
  actualizadoEn: string | null
  createdBy: string | null
}

export type AvEgresosResumen = {
  total: number
  cantidad: number
}

export async function listAvEgresos(token: string): Promise<{
  egresos: AvEgreso[]
  resumen: AvEgresosResumen
}> {
  return apiFetch('/api/audiovisual/egresos', token)
}

export async function createAvEgreso(
  token: string,
  payload: { fecha: string; concepto: string; valor: number },
): Promise<AvEgreso> {
  const data = await apiFetch<{ egreso: AvEgreso }>('/api/audiovisual/egresos', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.egreso
}

export async function updateAvEgreso(
  token: string,
  id: string,
  payload: Partial<{ fecha: string; concepto: string; valor: number }>,
): Promise<AvEgreso> {
  const data = await apiFetch<{ egreso: AvEgreso }>(
    `/api/audiovisual/egresos/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return data.egreso
}

export async function deleteAvEgreso(token: string, id: string): Promise<void> {
  await apiFetch(`/api/audiovisual/egresos/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}

export type AvFinanzasResumen = {
  ingresosTotales: number
  egresosTotales: number
  disponible: number
  cantidadIngresos: number
  cantidadEgresos: number
}

export async function getAvFinanzasResumen(token: string): Promise<AvFinanzasResumen> {
  const data = await apiFetch<{ resumen: AvFinanzasResumen }>('/api/audiovisual/resumen', token)
  return data.resumen
}

export type AvContrato = {
  fileName: string | null
  mimeType: string | null
  size: number | null
  uploadedAt: string | null
  uploadedBy: string | null
  uploadedByNombre: string | null
  uploadedByEmail: string | null
  externalUrl: string | null
  source: 'docs' | 'sheets' | 'file' | null
  downloadUrl: string | null
}

export type AvNotificacion = {
  id: string
  titulo: string | null
  mensaje: string | null
  alcance: 'todos' | 'admin'
  adminUid: string | null
  adminNombre: string | null
  adminEmail: string | null
  creadoEn: string | null
  createdBy: string | null
  createdByNombre: string | null
  createdByEmail: string | null
}

export type AvGestionAdmin = {
  uid: string
  nombre: string | null
  email: string | null
}

export async function getAvContrato(token: string): Promise<AvContrato | null> {
  const data = await apiFetch<{ contrato: AvContrato | null }>('/api/audiovisual/contrato', token)
  return data.contrato
}

export async function uploadAvContrato(
  token: string,
  payload: { fileName: string; mimeType: string; contentBase64: string },
): Promise<AvContrato> {
  const data = await apiFetch<{ contrato: AvContrato }>('/api/audiovisual/contrato', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return data.contrato
}

export async function saveAvContratoEnlace(
  token: string,
  payload: { externalUrl: string; fileName?: string },
): Promise<AvContrato> {
  const data = await apiFetch<{ contrato: AvContrato }>('/api/audiovisual/contrato', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return data.contrato
}

export type AvGenioAdmin = {
  titulo: string | null
  externalUrl: string | null
  updatedAt: string | null
  updatedBy: string | null
  updatedByNombre: string | null
  updatedByEmail: string | null
}

export async function getAvGenioAdmin(token: string): Promise<AvGenioAdmin | null> {
  const data = await apiFetch<{ genioAdmin: AvGenioAdmin | null }>(
    '/api/audiovisual/genio-admin',
    token,
  )
  return data.genioAdmin
}

export async function saveAvGenioAdminEnlace(
  token: string,
  payload: { externalUrl: string; titulo?: string },
): Promise<AvGenioAdmin> {
  const data = await apiFetch<{ genioAdmin: AvGenioAdmin }>('/api/audiovisual/genio-admin', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return data.genioAdmin
}

export async function listAvNotificaciones(token: string): Promise<AvNotificacion[]> {
  const data = await apiFetch<{ notificaciones: AvNotificacion[] }>(
    '/api/audiovisual/notificaciones',
    token,
  )
  return data.notificaciones
}

export async function createAvNotificacion(
  token: string,
  payload: {
    titulo: string
    mensaje: string
    alcance: 'todos' | 'admin'
    adminUid?: string
  },
): Promise<AvNotificacion> {
  const data = await apiFetch<{ notificacion: AvNotificacion }>(
    '/api/audiovisual/notificaciones',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data.notificacion
}

export async function listAvGestionAdmins(token: string): Promise<AvGestionAdmin[]> {
  const data = await apiFetch<{ administradores: AvGestionAdmin[] }>(
    '/api/audiovisual/gestion/admins',
    token,
  )
  return data.administradores
}

export type AvAccesoCategoria = 'redes' | 'computadores' | 'otros'

export type AvAccesoCredencial = {
  id: string
  nombre: string | null
  usuario: string | null
  clave: string | null
  categoria: AvAccesoCategoria
  notas: string | null
  creadoEn: string | null
  actualizadoEn: string | null
  createdBy: string | null
}

export async function listAvAccesos(token: string): Promise<AvAccesoCredencial[]> {
  const data = await apiFetch<{ accesos: AvAccesoCredencial[] }>(
    '/api/audiovisual/accesos',
    token,
  )
  return data.accesos
}

export async function createAvAcceso(
  token: string,
  payload: {
    nombre: string
    usuario: string
    clave: string
    categoria?: AvAccesoCategoria
    notas?: string
  },
): Promise<AvAccesoCredencial> {
  const data = await apiFetch<{ acceso: AvAccesoCredencial }>('/api/audiovisual/accesos', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.acceso
}

export async function updateAvAcceso(
  token: string,
  id: string,
  payload: Partial<{
    nombre: string
    usuario: string
    clave: string
    categoria: AvAccesoCategoria
    notas: string | null
  }>,
): Promise<AvAccesoCredencial> {
  const data = await apiFetch<{ acceso: AvAccesoCredencial }>(
    `/api/audiovisual/accesos/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return data.acceso
}

export async function deleteAvAcceso(token: string, id: string): Promise<void> {
  await apiFetch(`/api/audiovisual/accesos/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}

export type AvMovimientoTipo =
  | 'plan'
  | 'cliente'
  | 'factura'
  | 'pago'
  | 'ingreso'
  | 'egreso'

export type AvMovimientoAccion =
  | 'crear'
  | 'editar'
  | 'eliminar'
  | 'activar'
  | 'desactivar'
  | 'registrar_pago'

export type AvMovimiento = {
  id: string
  tipo: AvMovimientoTipo | string | null
  accion: AvMovimientoAccion | string | null
  resumen: string | null
  entidadId: string | null
  entidadLabel: string | null
  adminUid: string | null
  adminEmail: string | null
  adminNombre: string | null
  creadoEn: string | null
}

export async function listAvMovimientos(
  token: string,
  options: { limit?: number } = {},
): Promise<AvMovimiento[]> {
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  const query = params.toString() ? `?${params.toString()}` : ''
  const data = await apiFetch<{ movimientos: AvMovimiento[] }>(
    `/api/audiovisual/movimientos${query}`,
    token,
  )
  return data.movimientos
}

export async function deleteAvCliente(token: string, id: string): Promise<void> {
  await apiFetch(`/api/audiovisual/clientes/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}

export type AvServicioCredito = {
  id: string
  nombre: string | null
  descripcion: string | null
  creditos: number
  referencia: string | null
  creadoEn: string | null
  actualizadoEn: string | null
  createdBy: string | null
}

export async function listAvServiciosCreditos(token: string): Promise<AvServicioCredito[]> {
  const data = await apiFetch<{ servicios: AvServicioCredito[] }>(
    '/api/audiovisual/servicios-creditos',
    token,
  )
  return data.servicios
}

export async function createAvServicioCredito(
  token: string,
  payload: { nombre: string; descripcion: string; creditos: number },
): Promise<AvServicioCredito> {
  const data = await apiFetch<{ servicio: AvServicioCredito }>(
    '/api/audiovisual/servicios-creditos',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data.servicio
}

export async function updateAvServicioCredito(
  token: string,
  id: string,
  payload: Partial<{ nombre: string; descripcion: string; creditos: number }>,
): Promise<AvServicioCredito> {
  const data = await apiFetch<{ servicio: AvServicioCredito }>(
    `/api/audiovisual/servicios-creditos/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
  return data.servicio
}

export async function deleteAvServicioCredito(token: string, id: string): Promise<void> {
  await apiFetch(`/api/audiovisual/servicios-creditos/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}

export type AvCrmWhatsappStatus = {
  status: 'idle' | 'connecting' | 'qr' | 'open' | 'close' | string
  connected: boolean
  hasQr: boolean
  qrDataUrl: string | null
  phoneNumber: string | null
  phoneDisplay?: string | null
  pushName?: string | null
  profilePicUrl?: string | null
  lastError: string | null
  chatsCount?: number
}

export async function getAvCrmWhatsappStatus(token: string): Promise<AvCrmWhatsappStatus> {
  const data = await apiFetch<{ whatsapp: AvCrmWhatsappStatus }>(
    '/api/audiovisual/crm/whatsapp/status',
    token,
  )
  return data.whatsapp
}

export async function connectAvCrmWhatsapp(
  token: string,
  options: { forceNew?: boolean } = {},
): Promise<AvCrmWhatsappStatus> {
  const data = await apiFetch<{ whatsapp: AvCrmWhatsappStatus }>(
    '/api/audiovisual/crm/whatsapp/connect',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ forceNew: Boolean(options.forceNew) }),
    },
  )
  return data.whatsapp
}

export async function disconnectAvCrmWhatsapp(token: string): Promise<AvCrmWhatsappStatus> {
  const data = await apiFetch<{ whatsapp: AvCrmWhatsappStatus }>(
    '/api/audiovisual/crm/whatsapp/disconnect',
    token,
    { method: 'POST', body: JSON.stringify({}) },
  )
  return data.whatsapp
}

export type AvCrmChatPresence = {
  presence: string
  lastSeen: number | null
  label: string
}

export type AvCrmChatLastMessage = {
  id: string | null
  fromMe: boolean
  text: string
  status: string | null
  timestamp: number | null
}

export type AvCrmChat = {
  id: string
  name: string
  phoneNumber?: string | null
  phoneDisplay?: string | null
  isGroup: boolean
  unreadCount: number
  archived: boolean
  pinned: boolean
  muted: boolean
  conversationTimestamp: number | null
  lastMessage: AvCrmChatLastMessage | null
  presence: AvCrmChatPresence
  profilePicUrl: string | null
}

export type AvCrmMessage = {
  id: string | null
  chatId: string | null
  fromMe: boolean
  participant: string | null
  pushName: string | null
  timestamp: number | null
  type: string
  text: string
  status: string | null
  starred: boolean
  hasAudio?: boolean
  isPtt?: boolean
  audioSeconds?: number | null
  audioMimetype?: string | null
  hasImage?: boolean
  imageKind?: 'image' | 'sticker' | null
  imageCaption?: string | null
  imageMimetype?: string | null
  hasDocument?: boolean
  documentFileName?: string | null
  documentMimetype?: string | null
  documentCaption?: string | null
  documentPageCount?: number | null
  documentFileLength?: number | null
  isPdf?: boolean
}

export async function listAvCrmChats(
  token: string,
  options: { q?: string; limit?: number } = {},
): Promise<AvCrmChat[]> {
  const params = new URLSearchParams()
  if (options.q) params.set('q', options.q)
  if (options.limit) params.set('limit', String(options.limit))
  const query = params.toString() ? `?${params.toString()}` : ''
  const data = await apiFetch<{ chats: AvCrmChat[] }>(
    `/api/audiovisual/crm/whatsapp/chats${query}`,
    token,
  )
  return data.chats
}

export async function getAvCrmChat(
  token: string,
  jid: string,
  options: { limit?: number } = {},
): Promise<{ chat: AvCrmChat; messages: AvCrmMessage[] }> {
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiFetch<{ chat: AvCrmChat; messages: AvCrmMessage[] }>(
    `/api/audiovisual/crm/whatsapp/chats/${encodeURIComponent(jid)}${query}`,
    token,
  )
}

export async function sendAvCrmMessage(
  token: string,
  jid: string,
  text: string,
): Promise<AvCrmMessage> {
  const data = await apiFetch<{ message: AvCrmMessage }>(
    `/api/audiovisual/crm/whatsapp/chats/${encodeURIComponent(jid)}/messages`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    },
  )
  return data.message
}

export async function fetchAvCrmMessageAudio(
  token: string,
  jid: string,
  messageId: string,
): Promise<Blob> {
  const response = await fetch(
    `${API_URL}/api/audiovisual/crm/whatsapp/chats/${encodeURIComponent(jid)}/messages/${encodeURIComponent(messageId)}/audio`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'No se pudo cargar el audio')
  }
  return response.blob()
}

export async function fetchAvCrmMessageImage(
  token: string,
  jid: string,
  messageId: string,
): Promise<Blob> {
  const response = await fetch(
    `${API_URL}/api/audiovisual/crm/whatsapp/chats/${encodeURIComponent(jid)}/messages/${encodeURIComponent(messageId)}/image`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'No se pudo cargar la imagen')
  }
  return response.blob()
}

export async function fetchAvCrmMessageDocument(
  token: string,
  jid: string,
  messageId: string,
): Promise<Blob> {
  const response = await fetch(
    `${API_URL}/api/audiovisual/crm/whatsapp/chats/${encodeURIComponent(jid)}/messages/${encodeURIComponent(messageId)}/document`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'No se pudo cargar el documento')
  }
  return response.blob()
}

export type AvCrmMensajeAlcance = 'global' | 'personal'

export type AvCrmMensajePredeterminado = {
  id: string
  titulo: string
  texto: string
  orden: number
  alcance: AvCrmMensajeAlcance
  ownerUid: string | null
  creadoEn: string | null
  actualizadoEn: string | null
}

export async function listAvCrmMensajesPredeterminados(
  token: string,
): Promise<AvCrmMensajePredeterminado[]> {
  const data = await apiFetch<{ mensajes: AvCrmMensajePredeterminado[] }>(
    '/api/audiovisual/crm/mensajes-predeterminados',
    token,
  )
  return data.mensajes
}

export async function createAvCrmMensajePredeterminado(
  token: string,
  payload: { titulo: string; texto: string; orden?: number },
): Promise<AvCrmMensajePredeterminado> {
  const data = await apiFetch<{ mensaje: AvCrmMensajePredeterminado }>(
    '/api/audiovisual/crm/mensajes-predeterminados',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data.mensaje
}

export async function updateAvCrmMensajePredeterminado(
  token: string,
  id: string,
  payload: { titulo: string; texto: string; orden?: number },
): Promise<AvCrmMensajePredeterminado> {
  const data = await apiFetch<{ mensaje: AvCrmMensajePredeterminado }>(
    `/api/audiovisual/crm/mensajes-predeterminados/${encodeURIComponent(id)}`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
  return data.mensaje
}

export async function deleteAvCrmMensajePredeterminado(
  token: string,
  id: string,
): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    `/api/audiovisual/crm/mensajes-predeterminados/${encodeURIComponent(id)}`,
    token,
    { method: 'DELETE', body: JSON.stringify({}) },
  )
}

export type AvCrmVendedor = {
  uid: string
  email: string | null
  nombre: string | null
  cedula: string | null
  rol: 'vendedor'
  accesos?: Record<
    string,
    {
      nivel: 'view' | 'manage' | 'custom'
      acciones: string[]
      visualizar?: string[]
    }
  >
  mustChangePassword?: boolean
  createdAt: string | null
  lastSignInAt: string | null
}

export async function listAvCrmVendedores(token: string): Promise<AvCrmVendedor[]> {
  const data = await apiFetch<{ vendedores: AvCrmVendedor[] }>(
    '/api/audiovisual/crm/vendedores',
    token,
  )
  return data.vendedores
}

export async function createAvCrmVendedor(
  token: string,
  payload: { email: string; password: string; nombre: string; cedula: string },
): Promise<AvCrmVendedor> {
  const data = await apiFetch<{ vendedor: AvCrmVendedor }>(
    '/api/audiovisual/crm/vendedores',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return data.vendedor
}

export async function deleteAvCrmVendedor(token: string, uid: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(
    `/api/audiovisual/crm/vendedores/${encodeURIComponent(uid)}`,
    token,
    { method: 'DELETE', body: JSON.stringify({}) },
  )
}

export async function saveAvCrmVendedorAccesos(
  token: string,
  uid: string,
  acciones: string[],
): Promise<AvCrmVendedor> {
  const data = await apiFetch<{ vendedor: AvCrmVendedor }>(
    `/api/audiovisual/crm/vendedores/${encodeURIComponent(uid)}/accesos`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ acciones }),
    },
  )
  return data.vendedor
}

export type AvEmpresaGenio = {
  nit: string | null
  razonSocial: string | null
  nombreComercial: string | null
  correo: string | null
  telefono: string | null
  direccion: string | null
  ciudad: string | null
  sitioWeb: string | null
  regimen: string | null
  actualizadoEn: string | null
  updatedBy: string | null
  updatedByNombre: string | null
}

export type AvCotizacionItem = {
  concepto: string
  valor: number
}

export type AvCotizacion = {
  id: string
  numero: string | null
  clienteNombre: string | null
  clienteDocumento: string | null
  clienteCorreo: string | null
  clienteTelefono: string | null
  items: AvCotizacionItem[]
  subtotal: number
  resumen: string | null
  empresaSnapshot: AvEmpresaGenio | null
  creadoEn: string | null
  actualizadoEn: string | null
  createdBy: string | null
  createdByNombre: string | null
}

export async function getAvEmpresaGenio(token: string): Promise<AvEmpresaGenio> {
  const data = await apiFetch<{ empresa: AvEmpresaGenio }>('/api/audiovisual/empresa-genio', token)
  return data.empresa
}

export async function saveAvEmpresaGenio(
  token: string,
  payload: Partial<AvEmpresaGenio>,
): Promise<AvEmpresaGenio> {
  const data = await apiFetch<{ empresa: AvEmpresaGenio }>('/api/audiovisual/empresa-genio', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return data.empresa
}

export async function listAvCotizaciones(token: string): Promise<AvCotizacion[]> {
  const data = await apiFetch<{ cotizaciones: AvCotizacion[] }>(
    '/api/audiovisual/cotizaciones',
    token,
  )
  return data.cotizaciones
}

export async function createAvCotizacion(
  token: string,
  payload: {
    clienteNombre: string
    clienteDocumento?: string
    clienteCorreo?: string
    clienteTelefono?: string
    items: AvCotizacionItem[]
    resumen: string
  },
): Promise<AvCotizacion> {
  const data = await apiFetch<{ cotizacion: AvCotizacion }>('/api/audiovisual/cotizaciones', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.cotizacion
}

export async function deleteAvCotizacion(token: string, id: string): Promise<void> {
  await apiFetch(`/api/audiovisual/cotizaciones/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
}
