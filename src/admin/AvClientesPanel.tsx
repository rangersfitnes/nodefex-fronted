import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvCliente,
  listAvClientes,
  listAvFacturas,
  updateAvCliente,
  type AvCliente,
  type AvComoNosConocio,
  type AvFactura,
  type AvFacturaEstado,
  type AvServicioInteres,
  type AvTipoComercial,
  type AvTipoPersona,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ChevronLeft,
  LoaderCircle,
  Plus,
  RefreshCw,
  Users,
  X,
} from '../icons'

type VistaClientes = 'lista' | 'detalle'

type ClienteFormState = {
  tipoPersona: AvTipoPersona
  nombre: string
  documento: string
  contactoNombre: string
  telefono: string
  correo: string
  ciudad: string
  direccion: string
  tipoComercial: AvTipoComercial
  tipoComercialOtro: string
  serviciosInteres: AvServicioInteres[]
  servicioOtro: string
  comoNosConocio: AvComoNosConocio
  comoNosConocioOtro: string
  referidoVendedor: string
  responsable: string
  notas: string
}

const SERVICIOS: { id: AvServicioInteres; label: string }[] = [
  { id: 'produccion_audiovisual', label: 'Producción audiovisual' },
  { id: 'fotografia', label: 'Fotografía' },
  { id: 'video', label: 'Video' },
  { id: 'manejo_de_redes', label: 'Manejo de redes' },
  { id: 'marketing_digital', label: 'Marketing digital' },
  { id: 'pagina_web', label: 'Página web' },
  { id: 'landing_page', label: 'Landing page' },
  { id: 'bot', label: 'Bot' },
  { id: 'software_a_medida', label: 'Software a medida' },
  { id: 'otro', label: 'Otro' },
]

const TIPO_PERSONA_LABEL: Record<AvTipoPersona, string> = {
  persona: 'Persona',
  empresa: 'Empresa',
}

const TIPO_COMERCIAL_LABEL: Record<AvTipoComercial, string> = {
  emprendimiento: 'Emprendimiento',
  empresa: 'Empresa',
  persona_natural: 'Persona natural',
  otro: 'Otro',
}

const COMO_NOS_CONOCIO_LABEL: Record<AvComoNosConocio, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  referido: 'Referido',
  web: 'Web',
  otro: 'Otro',
}

const ESTADO_LABEL: Record<AvFacturaEstado, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagado: 'Pagado',
  vencido: 'Vencido',
}

function emptyForm(): ClienteFormState {
  return {
    tipoPersona: 'persona',
    nombre: '',
    documento: '',
    contactoNombre: '',
    telefono: '',
    correo: '',
    ciudad: '',
    direccion: '',
    tipoComercial: 'emprendimiento',
    tipoComercialOtro: '',
    serviciosInteres: [],
    servicioOtro: '',
    comoNosConocio: 'instagram',
    comoNosConocioOtro: '',
    referidoVendedor: '',
    responsable: '',
    notas: '',
  }
}

function formFromCliente(cliente: AvCliente): ClienteFormState {
  return {
    tipoPersona: cliente.tipoPersona || 'persona',
    nombre: cliente.nombre || '',
    documento: cliente.documento || '',
    contactoNombre: cliente.contactoNombre || '',
    telefono: cliente.telefono || '',
    correo: cliente.correo || '',
    ciudad: cliente.ciudad || '',
    direccion: cliente.direccion || '',
    tipoComercial: cliente.tipoComercial || 'emprendimiento',
    tipoComercialOtro: cliente.tipoComercialOtro || '',
    serviciosInteres: [...cliente.serviciosInteres],
    servicioOtro: cliente.servicioOtro || '',
    comoNosConocio: cliente.comoNosConocio || 'instagram',
    comoNosConocioOtro: cliente.comoNosConocioOtro || '',
    referidoVendedor: cliente.referidoVendedor || '',
    responsable: cliente.responsable || '',
    notas: cliente.notas || '',
  }
}

function normalizeDocumentoKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s.\-_/]/g, '')
}

function formatYmd(ymd: string | null): string {
  if (!ymd) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${ymd}T12:00:00-05:00`))
}

function validateClienteForm(
  form: ClienteFormState,
  options: { requireDocumento: boolean },
): string | null {
  const nombre = form.nombre.trim()
  const documento = form.documento.trim()
  const contactoNombre = form.contactoNombre.trim()
  const telefono = form.telefono.trim()
  const correo = form.correo.trim()
  const ciudad = form.ciudad.trim()
  const responsable = form.responsable.trim()

  if (!nombre) return 'El nombre o razón social es obligatorio.'
  if (options.requireDocumento && !documento) return 'El NIT / Cédula es obligatorio.'
  if (form.tipoPersona === 'empresa' && !contactoNombre) {
    return 'El nombre del contacto es obligatorio para empresas.'
  }
  if (!telefono) return 'El teléfono / WhatsApp es obligatorio.'
  if (!correo) return 'El correo electrónico es obligatorio.'
  if (!ciudad) return 'La ciudad es obligatoria.'
  if (form.tipoComercial === 'otro' && !form.tipoComercialOtro.trim()) {
    return 'Describe el tipo comercial (Otro).'
  }
  if (form.serviciosInteres.includes('otro') && !form.servicioOtro.trim()) {
    return 'Describe el servicio de interés (Otro).'
  }
  if (form.comoNosConocio === 'otro' && !form.comoNosConocioOtro.trim()) {
    return 'Describe cómo nos conoció (Otro).'
  }
  if (form.comoNosConocio === 'referido' && !form.referidoVendedor.trim()) {
    return 'Indica el nombre del vendedor o referido.'
  }
  if (!responsable) return 'El responsable dentro de Nodefex es obligatorio.'
  return null
}

type ClienteFormFieldsProps = {
  form: ClienteFormState
  submitting: boolean
  documentoLocked: boolean
  idPrefix: string
  onChange: <K extends keyof ClienteFormState>(key: K, value: ClienteFormState[K]) => void
  onToggleServicio: (servicio: AvServicioInteres) => void
}

function ClienteFormFields({
  form,
  submitting,
  documentoLocked,
  idPrefix,
  onChange,
  onToggleServicio,
}: ClienteFormFieldsProps) {
  return (
    <>
      <section className="av-cliente-section">
        <h3>Datos básicos</h3>
        <div className="av-ingresos-form-grid">
          <fieldset className="av-cliente-fieldset av-ingresos-span-2">
            <legend>Tipo de cliente</legend>
            <div className="av-cliente-radio-row">
              {(['persona', 'empresa'] as AvTipoPersona[]).map((tipo) => (
                <label key={tipo} className="av-plan-activo" htmlFor={`${idPrefix}-tipo-${tipo}`}>
                  <input
                    id={`${idPrefix}-tipo-${tipo}`}
                    type="radio"
                    name={`${idPrefix}-tipoPersona`}
                    checked={form.tipoPersona === tipo}
                    onChange={() => onChange('tipoPersona', tipo)}
                    disabled={submitting}
                  />
                  {TIPO_PERSONA_LABEL[tipo]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="login-field" htmlFor={`${idPrefix}-nombre`}>
            Nombre o razón social
            <input
              id={`${idPrefix}-nombre`}
              type="text"
              value={form.nombre}
              onChange={(event) => onChange('nombre', event.target.value)}
              required
              disabled={submitting}
              autoFocus={!documentoLocked}
            />
          </label>

          <label className="login-field" htmlFor={`${idPrefix}-documento`}>
            NIT / Cédula
            <input
              id={`${idPrefix}-documento`}
              type="text"
              value={form.documento}
              onChange={(event) => onChange('documento', event.target.value)}
              required
              disabled={submitting || documentoLocked}
              readOnly={documentoLocked}
            />
            {documentoLocked ? (
              <span className="av-cliente-field-hint">El número de identificación no se puede modificar.</span>
            ) : null}
          </label>

          {form.tipoPersona === 'empresa' ? (
            <label className="login-field av-ingresos-span-2" htmlFor={`${idPrefix}-contacto`}>
              Nombre del contacto
              <input
                id={`${idPrefix}-contacto`}
                type="text"
                value={form.contactoNombre}
                onChange={(event) => onChange('contactoNombre', event.target.value)}
                required
                disabled={submitting}
              />
            </label>
          ) : null}

          <label className="login-field" htmlFor={`${idPrefix}-telefono`}>
            Teléfono / WhatsApp
            <input
              id={`${idPrefix}-telefono`}
              type="tel"
              value={form.telefono}
              onChange={(event) => onChange('telefono', event.target.value)}
              required
              disabled={submitting}
            />
          </label>

          <label className="login-field" htmlFor={`${idPrefix}-correo`}>
            Correo electrónico
            <input
              id={`${idPrefix}-correo`}
              type="email"
              value={form.correo}
              onChange={(event) => onChange('correo', event.target.value)}
              required
              disabled={submitting}
            />
          </label>

          <label className="login-field" htmlFor={`${idPrefix}-ciudad`}>
            Ciudad
            <input
              id={`${idPrefix}-ciudad`}
              type="text"
              value={form.ciudad}
              onChange={(event) => onChange('ciudad', event.target.value)}
              required
              disabled={submitting}
            />
          </label>

          <label className="login-field" htmlFor={`${idPrefix}-direccion`}>
            Dirección (opcional)
            <input
              id={`${idPrefix}-direccion`}
              type="text"
              value={form.direccion}
              onChange={(event) => onChange('direccion', event.target.value)}
              disabled={submitting}
            />
          </label>
        </div>
      </section>

      <section className="av-cliente-section">
        <h3>Información comercial</h3>
        <div className="av-ingresos-form-grid">
          <label className="login-field" htmlFor={`${idPrefix}-tipo-comercial`}>
            Tipo de cliente
            <select
              id={`${idPrefix}-tipo-comercial`}
              value={form.tipoComercial}
              onChange={(event) => onChange('tipoComercial', event.target.value as AvTipoComercial)}
              disabled={submitting}
            >
              {(Object.keys(TIPO_COMERCIAL_LABEL) as AvTipoComercial[]).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {TIPO_COMERCIAL_LABEL[tipo]}
                </option>
              ))}
            </select>
          </label>

          {form.tipoComercial === 'otro' ? (
            <label className="login-field" htmlFor={`${idPrefix}-tipo-comercial-otro`}>
              ¿Cuál?
              <input
                id={`${idPrefix}-tipo-comercial-otro`}
                type="text"
                value={form.tipoComercialOtro}
                onChange={(event) => onChange('tipoComercialOtro', event.target.value)}
                disabled={submitting}
              />
            </label>
          ) : (
            <div />
          )}

          <fieldset className="av-cliente-fieldset av-ingresos-span-2">
            <legend>Servicios de interés</legend>
            <div className="av-cliente-checkboxes">
              {SERVICIOS.map((servicio) => (
                <label
                  key={servicio.id}
                  className="av-plan-activo"
                  htmlFor={`${idPrefix}-servicio-${servicio.id}`}
                >
                  <input
                    id={`${idPrefix}-servicio-${servicio.id}`}
                    type="checkbox"
                    checked={form.serviciosInteres.includes(servicio.id)}
                    onChange={() => onToggleServicio(servicio.id)}
                    disabled={submitting}
                  />
                  {servicio.label}
                </label>
              ))}
            </div>
            {form.serviciosInteres.includes('otro') ? (
              <label className="login-field" htmlFor={`${idPrefix}-servicio-otro`}>
                Otro servicio
                <input
                  id={`${idPrefix}-servicio-otro`}
                  type="text"
                  value={form.servicioOtro}
                  onChange={(event) => onChange('servicioOtro', event.target.value)}
                  disabled={submitting}
                />
              </label>
            ) : null}
          </fieldset>

          <label className="login-field" htmlFor={`${idPrefix}-como`}>
            Cómo nos conoció
            <select
              id={`${idPrefix}-como`}
              value={form.comoNosConocio}
              onChange={(event) =>
                onChange('comoNosConocio', event.target.value as AvComoNosConocio)
              }
              disabled={submitting}
            >
              {(Object.keys(COMO_NOS_CONOCIO_LABEL) as AvComoNosConocio[]).map((item) => (
                <option key={item} value={item}>
                  {COMO_NOS_CONOCIO_LABEL[item]}
                </option>
              ))}
            </select>
          </label>

          {form.comoNosConocio === 'otro' ? (
            <label className="login-field" htmlFor={`${idPrefix}-como-otro`}>
              ¿Cuál?
              <input
                id={`${idPrefix}-como-otro`}
                type="text"
                value={form.comoNosConocioOtro}
                onChange={(event) => onChange('comoNosConocioOtro', event.target.value)}
                disabled={submitting}
              />
            </label>
          ) : form.comoNosConocio === 'referido' ? (
            <label className="login-field" htmlFor={`${idPrefix}-referido-vendedor`}>
              Nombre del vendedor / referido
              <input
                id={`${idPrefix}-referido-vendedor`}
                type="text"
                value={form.referidoVendedor}
                onChange={(event) => onChange('referidoVendedor', event.target.value)}
                placeholder="Quién lo refirió"
                required
                disabled={submitting}
              />
            </label>
          ) : (
            <div />
          )}

          <label className="login-field av-ingresos-span-2" htmlFor={`${idPrefix}-responsable`}>
            Responsable dentro de Nodefex
            <input
              id={`${idPrefix}-responsable`}
              type="text"
              value={form.responsable}
              onChange={(event) => onChange('responsable', event.target.value)}
              placeholder="Nombre del responsable interno"
              required
              disabled={submitting}
            />
          </label>

          <label className="login-field av-ingresos-span-2" htmlFor={`${idPrefix}-notas`}>
            Notas
            <textarea
              id={`${idPrefix}-notas`}
              value={form.notas}
              onChange={(event) => onChange('notas', event.target.value)}
              rows={3}
              disabled={submitting}
              placeholder="Observaciones comerciales u operativas"
            />
          </label>
        </div>
      </section>
    </>
  )
}

export function AvClientesPanel() {
  const { user } = useAuth()
  const [vista, setVista] = useState<VistaClientes>('lista')
  const [clientes, setClientes] = useState<AvCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [detalle, setDetalle] = useState<AvCliente | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editError, setEditError] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editSuccess, setEditSuccess] = useState('')

  const [facturas, setFacturas] = useState<AvFactura[]>([])
  const [facturasLoading, setFacturasLoading] = useState(false)
  const [facturasError, setFacturasError] = useState('')
  const [detalleRefreshTick, setDetalleRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvClientes(token)
        if (!cancelled) setClientes(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes')
          setClientes([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, refreshTick])

  useEffect(() => {
    let cancelled = false

    async function loadFacturas() {
      if (!user || !detalle) return
      setFacturasLoading(true)
      setFacturasError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvFacturas(token, {
          clienteId: detalle.id,
          cliente: detalle.nombre || undefined,
        })
        if (!cancelled) setFacturas(data.facturas)
      } catch (err) {
        if (!cancelled) {
          setFacturasError(
            err instanceof Error ? err.message : 'No se pudieron cargar las facturas del cliente',
          )
          setFacturas([])
        }
      } finally {
        if (!cancelled) setFacturasLoading(false)
      }
    }

    void loadFacturas()
    return () => {
      cancelled = true
    }
  }, [user, detalle, detalleRefreshTick])

  const creditosComprados = useMemo(
    () => facturas.reduce((sum, item) => sum + (item.creditos || 0), 0),
    [facturas],
  )

  const totalFacturado = useMemo(
    () => facturas.reduce((sum, item) => sum + (item.valor || 0), 0),
    [facturas],
  )

  const totalCobrado = useMemo(
    () => facturas.reduce((sum, item) => sum + (item.totalPagado || 0), 0),
    [facturas],
  )

  function openCreate() {
    setForm(emptyForm())
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setFormError('')
  }

  function updateField<K extends keyof ClienteFormState>(key: K, value: ClienteFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateEditField<K extends keyof ClienteFormState>(key: K, value: ClienteFormState[K]) {
    setEditForm((current) => ({ ...current, [key]: value }))
    setEditSuccess('')
  }

  function toggleServicio(servicio: AvServicioInteres) {
    setForm((current) => {
      const exists = current.serviciosInteres.includes(servicio)
      return {
        ...current,
        serviciosInteres: exists
          ? current.serviciosInteres.filter((item) => item !== servicio)
          : [...current.serviciosInteres, servicio],
      }
    })
  }

  function toggleEditServicio(servicio: AvServicioInteres) {
    setEditForm((current) => {
      const exists = current.serviciosInteres.includes(servicio)
      return {
        ...current,
        serviciosInteres: exists
          ? current.serviciosInteres.filter((item) => item !== servicio)
          : [...current.serviciosInteres, servicio],
      }
    })
    setEditSuccess('')
  }

  function openDetalle(cliente: AvCliente) {
    setDetalle(cliente)
    setEditForm(formFromCliente(cliente))
    setEditError('')
    setEditSuccess('')
    setFacturas([])
    setFacturasError('')
    setVista('detalle')
    setDetalleRefreshTick((n) => n + 1)
  }

  function backToLista() {
    if (editSubmitting) return
    setVista('lista')
    setDetalle(null)
    setEditError('')
    setEditSuccess('')
    setFacturas([])
    setFacturasError('')
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const validationError = validateClienteForm(form, { requireDocumento: true })
    if (validationError) {
      setFormError(validationError)
      return
    }

    const documento = form.documento.trim()
    const documentoKey = normalizeDocumentoKey(documento)
    const duplicado = clientes.some(
      (cliente) =>
        normalizeDocumentoKey(cliente.documento || '') === documentoKey ||
        (cliente.documento || '').trim() === documento,
    )
    if (duplicado) {
      setFormError('Ya existe un cliente con ese NIT / Cédula.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      await createAvCliente(token, {
        tipoPersona: form.tipoPersona,
        nombre: form.nombre.trim(),
        documento,
        contactoNombre: form.tipoPersona === 'empresa' ? form.contactoNombre.trim() : undefined,
        telefono: form.telefono.trim(),
        correo: form.correo.trim(),
        ciudad: form.ciudad.trim(),
        direccion: form.direccion.trim() || undefined,
        tipoComercial: form.tipoComercial,
        tipoComercialOtro:
          form.tipoComercial === 'otro' ? form.tipoComercialOtro.trim() : undefined,
        serviciosInteres: form.serviciosInteres,
        servicioOtro: form.serviciosInteres.includes('otro')
          ? form.servicioOtro.trim()
          : undefined,
        comoNosConocio: form.comoNosConocio,
        comoNosConocioOtro:
          form.comoNosConocio === 'otro' ? form.comoNosConocioOtro.trim() : undefined,
        referidoVendedor:
          form.comoNosConocio === 'referido' ? form.referidoVendedor.trim() : undefined,
        responsable: form.responsable.trim(),
        notas: form.notas.trim() || undefined,
      })
      setModalOpen(false)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el cliente')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !detalle) return

    const validationError = validateClienteForm(editForm, { requireDocumento: false })
    if (validationError) {
      setEditError(validationError)
      return
    }

    setEditSubmitting(true)
    setEditError('')
    setEditSuccess('')
    try {
      const token = await user.getIdToken()
      const updated = await updateAvCliente(token, detalle.id, {
        tipoPersona: editForm.tipoPersona,
        nombre: editForm.nombre.trim(),
        contactoNombre:
          editForm.tipoPersona === 'empresa' ? editForm.contactoNombre.trim() : null,
        telefono: editForm.telefono.trim(),
        correo: editForm.correo.trim(),
        ciudad: editForm.ciudad.trim(),
        direccion: editForm.direccion.trim() || null,
        tipoComercial: editForm.tipoComercial,
        tipoComercialOtro:
          editForm.tipoComercial === 'otro' ? editForm.tipoComercialOtro.trim() : null,
        serviciosInteres: editForm.serviciosInteres,
        servicioOtro: editForm.serviciosInteres.includes('otro')
          ? editForm.servicioOtro.trim()
          : null,
        comoNosConocio: editForm.comoNosConocio,
        comoNosConocioOtro:
          editForm.comoNosConocio === 'otro' ? editForm.comoNosConocioOtro.trim() : null,
        referidoVendedor:
          editForm.comoNosConocio === 'referido' ? editForm.referidoVendedor.trim() : null,
        responsable: editForm.responsable.trim(),
        notas: editForm.notas.trim() || null,
      })
      setDetalle(updated)
      setEditForm(formFromCliente(updated))
      setClientes((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setEditSuccess('Cliente actualizado correctamente.')
      setDetalleRefreshTick((n) => n + 1)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudo actualizar el cliente')
    } finally {
      setEditSubmitting(false)
    }
  }

  if (vista === 'detalle' && detalle) {
    return (
      <div className="av-clientes" role="tabpanel" aria-label="Detalle de cliente">
        <div className="av-ingresos-toolbar">
          <button type="button" className="btn-secondary" onClick={backToLista}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            Volver al listado
          </button>
          <div className="av-ingresos-toolbar-actions">
            <button
              type="button"
              className="btn-secondary contable-refresh"
              onClick={() => setDetalleRefreshTick((n) => n + 1)}
              disabled={facturasLoading || editSubmitting}
              aria-label="Actualizar"
            >
              <RefreshCw
                size={16}
                strokeWidth={2}
                aria-hidden
                className={facturasLoading ? 'spin' : undefined}
              />
              Actualizar
            </button>
          </div>
        </div>

        <div className="av-ingresos-detail">
          <div className="av-ingresos-detail-head">
            <div>
              <p className="av-ingresos-kicker">
                {detalle.tipoPersona ? TIPO_PERSONA_LABEL[detalle.tipoPersona] : 'Cliente'}
              </p>
              <h3>{detalle.nombre || 'Sin nombre'}</h3>
              <p className="section-note">
                {detalle.documento || 'Sin documento'}
                {detalle.ciudad ? ` · ${detalle.ciudad}` : ''}
              </p>
            </div>
          </div>

          <div className="contable-summary">
            <div>
              <span>Créditos comprados</span>
              <strong>{creditosComprados}</strong>
            </div>
            <div>
              <span>Facturas</span>
              <strong>{facturas.length}</strong>
            </div>
            <div>
              <span>Total facturado</span>
              <strong>{formatCop(totalFacturado)}</strong>
            </div>
            <div>
              <span>Total cobrado</span>
              <strong>{formatCop(totalCobrado)}</strong>
            </div>
          </div>

          <section className="av-cliente-section">
            <h3>Información del cliente</h3>
            <form
              className="av-cliente-form"
              onSubmit={(event) => void handleUpdate(event)}
              noValidate
            >
              <ClienteFormFields
                form={editForm}
                submitting={editSubmitting}
                documentoLocked
                idPrefix="av-cli-edit"
                onChange={updateEditField}
                onToggleServicio={toggleEditServicio}
              />

              {editError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {editError}
                </p>
              ) : null}

              {editSuccess ? <p className="av-cliente-success">{editSuccess}</p> : null}

              <div className="av-ingresos-form-actions">
                <button type="submit" className="btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </button>
              </div>
            </form>
          </section>

          <section className="av-cliente-section">
            <div className="av-ingresos-pagos-head">
              <h3>Facturas y créditos</h3>
              <p className="section-note">
                {facturasLoading
                  ? 'Cargando facturas...'
                  : facturas.length
                    ? `${facturas.length} factura${facturas.length === 1 ? '' : 's'} · ${creditosComprados} créditos comprados`
                    : 'Aún no hay facturas asociadas a este cliente'}
              </p>
            </div>

            {facturasLoading ? (
              <div className="proyectos-status">
                <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                Cargando facturas...
              </div>
            ) : null}

            {!facturasLoading && facturasError ? (
              <div className="proyectos-status proyectos-status-error" role="alert">
                <AlertCircle size={18} strokeWidth={2} aria-hidden />
                {facturasError}
              </div>
            ) : null}

            {!facturasLoading && !facturasError && facturas.length === 0 ? (
              <div className="proyectos-empty">
                <Users size={28} strokeWidth={1.75} aria-hidden />
                <p>Cuando se generen facturas para este cliente aparecerán aquí.</p>
              </div>
            ) : null}

            {!facturasLoading && !facturasError && facturas.length > 0 ? (
              <div className="pagos-table-wrap">
                <table className="pagos-table">
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Emisión</th>
                      <th>Plan</th>
                      <th>Créditos</th>
                      <th>Valor</th>
                      <th>Pagado</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((factura) => (
                      <tr key={factura.id}>
                        <td>{factura.numero || '—'}</td>
                        <td>{formatYmd(factura.fechaEmision)}</td>
                        <td>{factura.planNombre || factura.concepto || '—'}</td>
                        <td>{factura.creditos ?? '—'}</td>
                        <td>{formatCop(factura.valor)}</td>
                        <td>{formatCop(factura.totalPagado)}</td>
                        <td>
                          <span className={`av-estado av-estado-${factura.estado}`}>
                            {ESTADO_LABEL[factura.estado]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="av-clientes" role="tabpanel" aria-label="Clientes">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Clientes</h3>
          <p className="section-note">Cartera de clientes de Nodefex Audio Visual.</p>
        </div>
        <div className="av-ingresos-toolbar-actions">
          <button
            type="button"
            className="btn-secondary contable-refresh"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading}
            aria-label="Actualizar"
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden className={loading ? 'spin' : undefined} />
            Actualizar
          </button>
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Crear cliente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando clientes...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && clientes.length === 0 ? (
        <div className="proyectos-empty">
          <Users size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay clientes. Crea el primero para empezar.</p>
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Crear cliente
          </button>
        </div>
      ) : null}

      {!loading && !error && clientes.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Documento</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Ciudad</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr
                  key={cliente.id}
                  className="av-cliente-row"
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle de ${cliente.nombre || 'cliente'}`}
                  onClick={() => openDetalle(cliente)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openDetalle(cliente)
                    }
                  }}
                >
                  <td>{cliente.nombre || '—'}</td>
                  <td>
                    {cliente.tipoPersona ? TIPO_PERSONA_LABEL[cliente.tipoPersona] : '—'}
                  </td>
                  <td>{cliente.documento || '—'}</td>
                  <td>{cliente.telefono || '—'}</td>
                  <td>{cliente.correo || '—'}</td>
                  <td>{cliente.ciudad || '—'}</td>
                  <td>{cliente.responsable || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel av-cliente-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-cliente-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-cliente-modal-title">Crear cliente</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form
              className="modal-form av-cliente-form"
              onSubmit={(event) => void handleCreate(event)}
              noValidate
            >
              <ClienteFormFields
                form={form}
                submitting={submitting}
                documentoLocked={false}
                idPrefix="av-cli"
                onChange={updateField}
                onToggleServicio={toggleServicio}
              />

              {formError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {formError}
                </p>
              ) : null}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : (
                    'Crear cliente'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
