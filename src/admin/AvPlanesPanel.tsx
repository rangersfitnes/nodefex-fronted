import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvPlan,
  deleteAvPlan,
  listAvPlanes,
  listAvServiciosCreditos,
  updateAvPlan,
  type AvPlan,
  type AvServicioCredito,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from '../icons'

type ModalMode = 'crear' | 'editar'

type PlanServicioRow = {
  key: string
  servicioId: string
  unidades: string
}

function newPlanServicioRow(partial?: Partial<PlanServicioRow>): PlanServicioRow {
  return {
    key: `ps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    servicioId: partial?.servicioId || '',
    unidades: partial?.unidades || '1',
  }
}

export function AvPlanesPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [planes, setPlanes] = useState<AvPlan[]>([])
  const [servicios, setServicios] = useState<AvServicioCredito[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [togglingId, setTogglingId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvPlan | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [activo, setActivo] = useState(true)
  const [descuento, setDescuento] = useState('')
  const [codigoBusqueda, setCodigoBusqueda] = useState('')
  const [codigoFeedback, setCodigoFeedback] = useState('')
  const [servicioRows, setServicioRows] = useState<PlanServicioRow[]>([newPlanServicioRow()])
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const serviciosById = useMemo(() => {
    const map = new Map<string, AvServicioCredito>()
    for (const item of servicios) map.set(item.id, item)
    return map
  }, [servicios])

  const planSubtotal = useMemo(() => {
    return servicioRows.reduce((sum, row) => {
      const servicio = serviciosById.get(row.servicioId)
      const unidades = Math.floor(Number(row.unidades))
      if (!servicio || !Number.isFinite(unidades) || unidades <= 0) return sum
      return sum + servicio.costo * unidades
    }, 0)
  }, [servicioRows, serviciosById])

  const descuentoPct = useMemo(() => {
    if (!String(descuento).trim()) return 0
    const n = Number(String(descuento).replace(',', '.').trim())
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.min(100, Math.round(n * 100) / 100)
  }, [descuento])

  const descuentoValor = useMemo(
    () => Math.round((planSubtotal * descuentoPct) / 100),
    [planSubtotal, descuentoPct],
  )

  const planTotal = useMemo(
    () => Math.max(0, planSubtotal - descuentoValor),
    [planSubtotal, descuentoValor],
  )

  const canSavePlan = useMemo(() => {
    if (!nombre.trim()) return false
    if (servicioRows.length === 0) return false
    if (descuentoPct < 0 || descuentoPct > 100) return false
    return (
      servicioRows.every((row) => {
        const unidades = Math.floor(Number(row.unidades))
        return Boolean(row.servicioId) && Number.isFinite(unidades) && unidades > 0
      }) && planSubtotal > 0
    )
  }, [nombre, servicioRows, planSubtotal, descuentoPct])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const [planesData, serviciosData] = await Promise.all([
          listAvPlanes(token),
          listAvServiciosCreditos(token),
        ])
        if (!cancelled) {
          setPlanes(planesData)
          setServicios(serviciosData)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los planes')
          setPlanes([])
          setServicios([])
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
    setModalMode('crear')
    setEditing(null)
    setNombre('')
    setDescripcion('')
    setActivo(true)
    setDescuento('')
    setCodigoBusqueda('')
    setCodigoFeedback('')
    setServicioRows([newPlanServicioRow()])
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(plan: AvPlan) {
    setModalMode('editar')
    setEditing(plan)
    setNombre(plan.nombre || '')
    setDescripcion(plan.descripcion || '')
    setActivo(plan.activo)
    setDescuento(
      plan.descuentoPorcentaje > 0 ? String(plan.descuentoPorcentaje) : '',
    )
    setCodigoBusqueda('')
    setCodigoFeedback('')
    const rows =
      Array.isArray(plan.servicios) && plan.servicios.length > 0
        ? plan.servicios.map((item) =>
            newPlanServicioRow({
              key: item.key,
              servicioId: item.servicioId,
              unidades: String(item.unidades || 1),
            }),
          )
        : [newPlanServicioRow()]
    setServicioRows(rows)
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setFormError('')
  }

  function updateServicioRow(key: string, patch: Partial<PlanServicioRow>) {
    setServicioRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  function addServicioByCodigo() {
    const digits = String(codigoBusqueda || '').replace(/\D/g, '')
    if (!digits) {
      setCodigoFeedback('Escribe el código de 4 dígitos del servicio.')
      return
    }
    const codigo = digits.padStart(4, '0').slice(-4)

    const match = servicios.find((item) => {
      const ref = String(item.referencia || '').replace(/\D/g, '').padStart(4, '0').slice(-4)
      return ref === codigo
    })

    if (!match) {
      setCodigoFeedback(`No hay servicio con código ${codigo}.`)
      return
    }

    setServicioRows((current) => {
      const empty = current.find((row) => !row.servicioId)
      if (empty) {
        return current.map((row) =>
          row.key === empty.key
            ? { ...row, servicioId: match.id, unidades: row.unidades || '1' }
            : row,
        )
      }
      return [...current, newPlanServicioRow({ servicioId: match.id, unidades: '1' })]
    })
    setCodigoBusqueda('')
    setCodigoFeedback(
      `Agregado: ${match.referencia || codigo} · ${match.nombre || 'Servicio'} (${formatCop(match.costo)})`,
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const nombreValue = nombre.trim()
    const descripcionValue = descripcion.trim()

    if (!nombreValue) {
      setFormError('El nombre es obligatorio.')
      return
    }
    if (!canSavePlan) {
      setFormError('Agrega al menos un servicio con unidades mayores a 0.')
      return
    }
    if (descuentoPct < 0 || descuentoPct > 100) {
      setFormError('El descuento debe estar entre 0% y 100%.')
      return
    }

    const serviciosPayload = servicioRows.map((row) => ({
      key: row.key,
      servicioId: row.servicioId,
      unidades: Math.floor(Number(row.unidades)),
    }))

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      if (modalMode === 'crear') {
        await createAvPlan(token, {
          nombre: nombreValue,
          descripcion: descripcionValue || undefined,
          activo,
          descuentoPorcentaje: descuentoPct,
          servicios: serviciosPayload,
        })
      } else if (editing) {
        await updateAvPlan(token, editing.id, {
          nombre: nombreValue,
          descripcion: descripcionValue || null,
          activo,
          descuentoPorcentaje: descuentoPct,
          servicios: serviciosPayload,
        })
      }
      setModalOpen(false)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el plan')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(plan: AvPlan) {
    if (!user) return
    setTogglingId(plan.id)
    setError('')
    try {
      const token = await user.getIdToken()
      const updated = await updateAvPlan(token, plan.id, { activo: !plan.activo })
      setPlanes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del plan')
    } finally {
      setTogglingId('')
    }
  }

  async function handleDelete(plan: AvPlan) {
    if (!user || readOnly || deletingId) return
    const ok = window.confirm(
      `¿Eliminar el plan «${plan.nombre || 'sin nombre'}»? Esta acción no se puede deshacer.`,
    )
    if (!ok) return

    setDeletingId(plan.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvPlan(token, plan.id)
      setPlanes((current) => current.filter((item) => item.id !== plan.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el plan')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="av-planes" role="tabpanel" aria-label="Planes">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Planes</h3>
          <p className="section-note">
            Arma planes con uno o más servicios (y varias unidades). El valor se calcula solo sumando
            el costo de los servicios incluidos.
          </p>
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
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nuevo plan
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando planes...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && planes.length === 0 ? (
        <div className="proyectos-empty">
          <Layers size={28} strokeWidth={1.75} aria-hidden />
          <p>No hay planes configurados. Crea el primero para empezar.</p>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nuevo plan
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && planes.length > 0 ? (
        <div className="av-planes-list" role="list">
          {planes.map((plan) => (
            <article key={plan.id} className="av-plan-card" role="listitem">
              <div className="av-plan-card-head">
                <div className="av-plan-card-title">
                  <h4>{plan.nombre || 'Sin nombre'}</h4>
                  <span className={`av-estado ${plan.activo ? 'av-estado-pagado' : 'av-estado-vencido'}`}>
                    {plan.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="av-plan-card-precio">{formatCop(plan.precio)}</p>
              </div>

              {(plan.descuentoPorcentaje || 0) > 0 ? (
                <p className="av-plan-card-descuento">
                  Subtotal {formatCop(plan.subtotal || plan.precio)} · Descuento{' '}
                  {plan.descuentoPorcentaje}% (−{formatCop(plan.descuentoValor || 0)})
                </p>
              ) : null}

              {plan.descripcion ? (
                <p className="av-plan-card-desc">{plan.descripcion}</p>
              ) : null}

              <div className="av-plan-card-servicios">
                <span className="av-plan-card-label">Servicios</span>
                {(plan.servicios || []).length > 0 ? (
                  <ul className="av-plan-servicios-preview">
                    {plan.servicios.map((item) => (
                      <li key={item.key || `${item.servicioId}-${item.unidades}`}>
                        <span>
                          {item.unidades}× {item.nombre || item.referencia || 'Servicio'}
                        </span>
                        <strong>{formatCop(item.subtotal)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="av-plan-card-empty">Sin servicios · valor $0</p>
                )}
              </div>

              {!readOnly ? (
                <div className="av-ingresos-row-actions av-plan-card-actions">
                  <button type="button" className="btn-secondary" onClick={() => openEdit(plan)}>
                    <Pencil size={14} strokeWidth={2} aria-hidden />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={togglingId === plan.id}
                    onClick={() => void handleToggle(plan)}
                  >
                    {togglingId === plan.id ? (
                      <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                    ) : null}
                    {plan.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={deletingId === plan.id}
                    onClick={() => void handleDelete(plan)}
                  >
                    {deletingId === plan.id ? (
                      <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                    ) : (
                      <Trash2 size={14} strokeWidth={2} aria-hidden />
                    )}
                    Eliminar
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel av-plan-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-plan-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-plan-modal-title">
                {modalMode === 'crear' ? 'Nuevo plan' : 'Editar plan'}
              </h2>
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

            <form className="modal-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
              <label className="login-field" htmlFor="av-plan-nombre">
                Nombre
                <input
                  id="av-plan-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Plan producción"
                  required
                  disabled={submitting}
                  autoFocus
                />
              </label>

              <fieldset className="av-plan-servicios" disabled={submitting}>
                <legend>Servicios del plan</legend>
                {servicios.length === 0 ? (
                  <p className="section-note">
                    Primero crea servicios en la pestaña Servicios para poder agregarlos aquí.
                  </p>
                ) : (
                  <p className="section-note">
                    Busca por código de 4 dígitos o elige en la lista. Puedes agregar el mismo
                    servicio varias veces o subir las unidades.
                  </p>
                )}

                {servicios.length > 0 ? (
                  <div className="av-plan-codigo-search">
                    <label className="login-field" htmlFor="av-plan-codigo">
                      Buscar servicio por código
                      <input
                        id="av-plan-codigo"
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={codigoBusqueda}
                        onChange={(event) => {
                          setCodigoBusqueda(event.target.value.replace(/\D/g, '').slice(0, 4))
                          setCodigoFeedback('')
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            addServicioByCodigo()
                          }
                        }}
                        placeholder="Ej. 0421"
                        disabled={submitting}
                        autoComplete="off"
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={addServicioByCodigo}
                      disabled={submitting || !codigoBusqueda.trim()}
                    >
                      <Plus size={14} strokeWidth={2} aria-hidden />
                      Agregar
                    </button>
                    {codigoFeedback ? (
                      <p
                        className={`av-plan-codigo-feedback ${
                          codigoFeedback.startsWith('Agregado') ? 'is-ok' : 'is-error'
                        }`}
                        role="status"
                      >
                        {codigoFeedback}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="av-plan-servicios-list">
                  {servicioRows.map((row) => {
                    const servicio = serviciosById.get(row.servicioId)
                    const unidades = Math.floor(Number(row.unidades))
                    const subtotal =
                      servicio && Number.isFinite(unidades) && unidades > 0
                        ? servicio.costo * unidades
                        : 0
                    return (
                      <div key={row.key} className="av-plan-servicio-row">
                        <label className="login-field">
                          Servicio
                          <select
                            value={row.servicioId}
                            onChange={(event) =>
                              updateServicioRow(row.key, { servicioId: event.target.value })
                            }
                            disabled={submitting || servicios.length === 0}
                            required
                          >
                            <option value="">Selecciona un servicio</option>
                            {servicios.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.referencia || '----'} · {item.nombre || 'Servicio'} ·{' '}
                                {formatCop(item.costo)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="login-field">
                          Unidades
                          <input
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            value={row.unidades}
                            onChange={(event) =>
                              updateServicioRow(row.key, { unidades: event.target.value })
                            }
                            disabled={submitting}
                            required
                          />
                        </label>
                        <div className="av-plan-servicio-subtotal" aria-live="polite">
                          <span>Subtotal</span>
                          <strong>{formatCop(subtotal)}</strong>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary av-plan-servicio-remove"
                          onClick={() => {
                            if (servicioRows.length <= 1) return
                            setServicioRows((current) =>
                              current.filter((item) => item.key !== row.key),
                            )
                          }}
                          disabled={submitting || servicioRows.length <= 1}
                          aria-label="Quitar servicio"
                        >
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setServicioRows((current) => [...current, newPlanServicioRow()])}
                  disabled={submitting || servicios.length === 0}
                >
                  <Plus size={14} strokeWidth={2} aria-hidden />
                  Agregar servicio
                </button>

                <label className="login-field" htmlFor="av-plan-descuento">
                  Descuento (%)
                  <input
                    id="av-plan-descuento"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    inputMode="decimal"
                    value={descuento}
                    onChange={(event) => setDescuento(event.target.value)}
                    placeholder="0"
                    disabled={submitting}
                  />
                </label>

                <div className="av-plan-total" aria-live="polite">
                  <div className="av-plan-total-row">
                    <span>Subtotal</span>
                    <strong>{formatCop(planSubtotal)}</strong>
                  </div>
                  {descuentoPct > 0 ? (
                    <div className="av-plan-total-row is-discount">
                      <span>Descuento ({descuentoPct}%)</span>
                      <strong>−{formatCop(descuentoValor)}</strong>
                    </div>
                  ) : null}
                  <div className="av-plan-total-row is-final">
                    <span>Valor del plan</span>
                    <strong>{formatCop(planTotal)}</strong>
                  </div>
                </div>
              </fieldset>

              <label className="login-field" htmlFor="av-plan-descripcion">
                Descripción
                <textarea
                  id="av-plan-descripcion"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  rows={3}
                  placeholder="Detalle del plan"
                  disabled={submitting}
                />
              </label>

              <label className="av-plan-activo" htmlFor="av-plan-activo">
                <input
                  id="av-plan-activo"
                  type="checkbox"
                  checked={activo}
                  onChange={(event) => setActivo(event.target.checked)}
                  disabled={submitting}
                />
                Plan activo (visible en Finanzas → Ingresos)
              </label>

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
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !canSavePlan || servicios.length === 0}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : modalMode === 'crear' ? (
                    'Crear plan'
                  ) : (
                    'Guardar cambios'
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
