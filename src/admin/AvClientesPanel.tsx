import { useEffect, useState, type FormEvent } from 'react'
import {
  createAvCliente,
  listAvClientes,
  type AvCliente,
  type AvComoNosConocio,
  type AvServicioInteres,
  type AvTipoComercial,
  type AvTipoPersona,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  LoaderCircle,
  Plus,
  RefreshCw,
  Users,
  X,
} from '../icons'

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

function emptyForm() {
  return {
    tipoPersona: 'persona' as AvTipoPersona,
    nombre: '',
    documento: '',
    contactoNombre: '',
    telefono: '',
    correo: '',
    ciudad: '',
    direccion: '',
    tipoComercial: 'emprendimiento' as AvTipoComercial,
    tipoComercialOtro: '',
    serviciosInteres: [] as AvServicioInteres[],
    servicioOtro: '',
    comoNosConocio: 'instagram' as AvComoNosConocio,
    comoNosConocioOtro: '',
    referidoVendedor: '',
    responsable: '',
    notas: '',
  }
}

export function AvClientesPanel() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<AvCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  function updateField<K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const nombre = form.nombre.trim()
    const documento = form.documento.trim()
    const contactoNombre = form.contactoNombre.trim()
    const telefono = form.telefono.trim()
    const correo = form.correo.trim()
    const ciudad = form.ciudad.trim()
    const direccion = form.direccion.trim()
    const responsable = form.responsable.trim()
    const notas = form.notas.trim()

    if (!nombre) {
      setFormError('El nombre o razón social es obligatorio.')
      return
    }
    if (!documento) {
      setFormError('El NIT / Cédula es obligatorio.')
      return
    }
    if (form.tipoPersona === 'empresa' && !contactoNombre) {
      setFormError('El nombre del contacto es obligatorio para empresas.')
      return
    }
    if (!telefono) {
      setFormError('El teléfono / WhatsApp es obligatorio.')
      return
    }
    if (!correo) {
      setFormError('El correo electrónico es obligatorio.')
      return
    }
    if (!ciudad) {
      setFormError('La ciudad es obligatoria.')
      return
    }
    if (form.tipoComercial === 'otro' && !form.tipoComercialOtro.trim()) {
      setFormError('Describe el tipo comercial (Otro).')
      return
    }
    if (form.serviciosInteres.includes('otro') && !form.servicioOtro.trim()) {
      setFormError('Describe el servicio de interés (Otro).')
      return
    }
    if (form.comoNosConocio === 'otro' && !form.comoNosConocioOtro.trim()) {
      setFormError('Describe cómo nos conoció (Otro).')
      return
    }
    if (form.comoNosConocio === 'referido' && !form.referidoVendedor.trim()) {
      setFormError('Indica el nombre del vendedor o referido.')
      return
    }
    if (!responsable) {
      setFormError('El responsable dentro de Nodefex es obligatorio.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      await createAvCliente(token, {
        tipoPersona: form.tipoPersona,
        nombre,
        documento,
        contactoNombre: form.tipoPersona === 'empresa' ? contactoNombre : undefined,
        telefono,
        correo,
        ciudad,
        direccion: direccion || undefined,
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
        responsable,
        notas: notas || undefined,
      })
      setModalOpen(false)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el cliente')
    } finally {
      setSubmitting(false)
    }
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
                <tr key={cliente.id}>
                  <td>{cliente.nombre || '—'}</td>
                  <td>
                    {cliente.tipoPersona
                      ? TIPO_PERSONA_LABEL[cliente.tipoPersona]
                      : '—'}
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

            <form className="modal-form av-cliente-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
              <section className="av-cliente-section">
                <h3>Datos básicos</h3>
                <div className="av-ingresos-form-grid">
                  <fieldset className="av-cliente-fieldset av-ingresos-span-2">
                    <legend>Tipo de cliente</legend>
                    <div className="av-cliente-radio-row">
                      {(['persona', 'empresa'] as AvTipoPersona[]).map((tipo) => (
                        <label key={tipo} className="av-plan-activo" htmlFor={`av-cli-tipo-${tipo}`}>
                          <input
                            id={`av-cli-tipo-${tipo}`}
                            type="radio"
                            name="tipoPersona"
                            checked={form.tipoPersona === tipo}
                            onChange={() => updateField('tipoPersona', tipo)}
                            disabled={submitting}
                          />
                          {TIPO_PERSONA_LABEL[tipo]}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="login-field" htmlFor="av-cli-nombre">
                    Nombre o razón social
                    <input
                      id="av-cli-nombre"
                      type="text"
                      value={form.nombre}
                      onChange={(event) => updateField('nombre', event.target.value)}
                      required
                      disabled={submitting}
                      autoFocus
                    />
                  </label>

                  <label className="login-field" htmlFor="av-cli-documento">
                    NIT / Cédula
                    <input
                      id="av-cli-documento"
                      type="text"
                      value={form.documento}
                      onChange={(event) => updateField('documento', event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </label>

                  {form.tipoPersona === 'empresa' ? (
                    <label className="login-field av-ingresos-span-2" htmlFor="av-cli-contacto">
                      Nombre del contacto
                      <input
                        id="av-cli-contacto"
                        type="text"
                        value={form.contactoNombre}
                        onChange={(event) => updateField('contactoNombre', event.target.value)}
                        required
                        disabled={submitting}
                      />
                    </label>
                  ) : null}

                  <label className="login-field" htmlFor="av-cli-telefono">
                    Teléfono / WhatsApp
                    <input
                      id="av-cli-telefono"
                      type="tel"
                      value={form.telefono}
                      onChange={(event) => updateField('telefono', event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </label>

                  <label className="login-field" htmlFor="av-cli-correo">
                    Correo electrónico
                    <input
                      id="av-cli-correo"
                      type="email"
                      value={form.correo}
                      onChange={(event) => updateField('correo', event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </label>

                  <label className="login-field" htmlFor="av-cli-ciudad">
                    Ciudad
                    <input
                      id="av-cli-ciudad"
                      type="text"
                      value={form.ciudad}
                      onChange={(event) => updateField('ciudad', event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </label>

                  <label className="login-field" htmlFor="av-cli-direccion">
                    Dirección (opcional)
                    <input
                      id="av-cli-direccion"
                      type="text"
                      value={form.direccion}
                      onChange={(event) => updateField('direccion', event.target.value)}
                      disabled={submitting}
                    />
                  </label>
                </div>
              </section>

              <section className="av-cliente-section">
                <h3>Información comercial</h3>
                <div className="av-ingresos-form-grid">
                  <label className="login-field" htmlFor="av-cli-tipo-comercial">
                    Tipo de cliente
                    <select
                      id="av-cli-tipo-comercial"
                      value={form.tipoComercial}
                      onChange={(event) =>
                        updateField('tipoComercial', event.target.value as AvTipoComercial)
                      }
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
                    <label className="login-field" htmlFor="av-cli-tipo-comercial-otro">
                      ¿Cuál?
                      <input
                        id="av-cli-tipo-comercial-otro"
                        type="text"
                        value={form.tipoComercialOtro}
                        onChange={(event) => updateField('tipoComercialOtro', event.target.value)}
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
                          htmlFor={`av-cli-servicio-${servicio.id}`}
                        >
                          <input
                            id={`av-cli-servicio-${servicio.id}`}
                            type="checkbox"
                            checked={form.serviciosInteres.includes(servicio.id)}
                            onChange={() => toggleServicio(servicio.id)}
                            disabled={submitting}
                          />
                          {servicio.label}
                        </label>
                      ))}
                    </div>
                    {form.serviciosInteres.includes('otro') ? (
                      <label className="login-field" htmlFor="av-cli-servicio-otro">
                        Otro servicio
                        <input
                          id="av-cli-servicio-otro"
                          type="text"
                          value={form.servicioOtro}
                          onChange={(event) => updateField('servicioOtro', event.target.value)}
                          disabled={submitting}
                        />
                      </label>
                    ) : null}
                  </fieldset>

                  <label className="login-field" htmlFor="av-cli-como">
                    Cómo nos conoció
                    <select
                      id="av-cli-como"
                      value={form.comoNosConocio}
                      onChange={(event) =>
                        updateField('comoNosConocio', event.target.value as AvComoNosConocio)
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
                    <label className="login-field" htmlFor="av-cli-como-otro">
                      ¿Cuál?
                      <input
                        id="av-cli-como-otro"
                        type="text"
                        value={form.comoNosConocioOtro}
                        onChange={(event) => updateField('comoNosConocioOtro', event.target.value)}
                        disabled={submitting}
                      />
                    </label>
                  ) : form.comoNosConocio === 'referido' ? (
                    <label className="login-field" htmlFor="av-cli-referido-vendedor">
                      Nombre del vendedor / referido
                      <input
                        id="av-cli-referido-vendedor"
                        type="text"
                        value={form.referidoVendedor}
                        onChange={(event) => updateField('referidoVendedor', event.target.value)}
                        placeholder="Quién lo refirió"
                        required
                        disabled={submitting}
                      />
                    </label>
                  ) : (
                    <div />
                  )}

                  <label className="login-field av-ingresos-span-2" htmlFor="av-cli-responsable">
                    Responsable dentro de Nodefex
                    <input
                      id="av-cli-responsable"
                      type="text"
                      value={form.responsable}
                      onChange={(event) => updateField('responsable', event.target.value)}
                      placeholder="Nombre del responsable interno"
                      required
                      disabled={submitting}
                    />
                  </label>

                  <label className="login-field av-ingresos-span-2" htmlFor="av-cli-notas">
                    Notas
                    <textarea
                      id="av-cli-notas"
                      value={form.notas}
                      onChange={(event) => updateField('notas', event.target.value)}
                      rows={3}
                      disabled={submitting}
                      placeholder="Observaciones comerciales u operativas"
                    />
                  </label>
                </div>
              </section>

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
