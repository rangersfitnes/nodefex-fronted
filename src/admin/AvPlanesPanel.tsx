import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvPlan,
  deleteAvPlan,
  generateAvPlanResumen,
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
  Search,
  Sparkles,
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
    key:
      partial?.key ||
      `ps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    servicioId: partial?.servicioId || '',
    unidades: partial?.unidades || '1',
  }
}

function normalizeRef(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(/\D/g, '')
    .padStart(4, '0')
    .slice(-4)
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
  const [resumen, setResumen] = useState('')
  const [activo, setActivo] = useState(true)
  const [descuento, setDescuento] = useState('')
  const [codigoBusqueda, setCodigoBusqueda] = useState('')
  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [unidadesAdd, setUnidadesAdd] = useState('1')
  const [codigoFeedback, setCodigoFeedback] = useState('')
  const [servicioSeleccionado, setServicioSeleccionado] = useState<AvServicioCredito | null>(
    null,
  )
  const [servicioRows, setServicioRows] = useState<PlanServicioRow[]>([])
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [generatingResumen, setGeneratingResumen] = useState(false)

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

  const serviciosFiltrados = useMemo(() => {
    const q = textoBusqueda.trim().toLowerCase()
    if (!q) return servicios.slice(0, 12)
    return servicios
      .filter((item) => {
        const haystack = [
          item.referencia,
          item.nombre,
          item.descripcion,
          String(item.costo || ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .slice(0, 20)
  }, [servicios, textoBusqueda])

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
    setResumen('')
    setActivo(true)
    setDescuento('')
    setCodigoBusqueda('')
    setTextoBusqueda('')
    setUnidadesAdd('1')
    setCodigoFeedback('')
    setServicioSeleccionado(null)
    setServicioRows([])
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(plan: AvPlan) {
    setModalMode('editar')
    setEditing(plan)
    setNombre(plan.nombre || '')
    setDescripcion(plan.descripcion || '')
    setResumen(plan.resumen || '')
    setActivo(plan.activo)
    setDescuento(
      plan.descuentoPorcentaje > 0 ? String(plan.descuentoPorcentaje) : '',
    )
    setCodigoBusqueda('')
    setTextoBusqueda('')
    setUnidadesAdd('1')
    setCodigoFeedback('')
    setServicioSeleccionado(null)
    const rows =
      Array.isArray(plan.servicios) && plan.servicios.length > 0
        ? plan.servicios.map((item) =>
            newPlanServicioRow({
              key: item.key,
              servicioId: item.servicioId,
              unidades: String(item.unidades || 1),
            }),
          )
        : []
    setServicioRows(rows)
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting || generatingResumen) return
    setModalOpen(false)
    setFormError('')
    setCodigoFeedback('')
    setServicioSeleccionado(null)
  }

  function parseUnidades(): number {
    const n = Math.floor(Number(String(unidadesAdd).replace(/,/g, '').trim()))
    return Number.isFinite(n) && n > 0 ? n : 1
  }

  function seleccionarServicio(servicio: AvServicioCredito) {
    setServicioSeleccionado(servicio)
    setCodigoBusqueda(normalizeRef(servicio.referencia))
    setTextoBusqueda('')
    setFormError('')
    setCodigoFeedback(
      `Seleccionado: ${normalizeRef(servicio.referencia)} · ${servicio.nombre || 'Servicio'}. Define la cantidad y pulsa Agregar.`,
    )
  }

  function clearServicioSeleccionado() {
    setServicioSeleccionado(null)
    setCodigoBusqueda('')
    setCodigoFeedback('')
  }

  function addServicioSeleccionado() {
    const servicio = servicioSeleccionado
    if (!servicio) {
      setCodigoFeedback('Selecciona un servicio de la lista o con el código.')
      return
    }
    const unidades = String(parseUnidades())
    setServicioRows((current) => [
      ...current,
      newPlanServicioRow({ servicioId: servicio.id, unidades }),
    ])
    setCodigoBusqueda('')
    setTextoBusqueda('')
    setUnidadesAdd('1')
    setServicioSeleccionado(null)
    setFormError('')
    setCodigoFeedback(
      `Agregado: ${normalizeRef(servicio.referencia)} · ${servicio.nombre || 'Servicio'} × ${unidades}`,
    )
  }

  function seleccionarPorCodigo() {
    const digits = String(codigoBusqueda || '').replace(/\D/g, '')
    if (!digits) {
      setCodigoFeedback('Escribe el código de 4 dígitos del servicio.')
      return
    }
    const codigo = digits.padStart(4, '0').slice(-4)
    const match = servicios.find((item) => normalizeRef(item.referencia) === codigo)
    if (!match) {
      setServicioSeleccionado(null)
      setCodigoFeedback(`No hay servicio con código ${codigo}.`)
      return
    }
    seleccionarServicio(match)
  }

  function updateServicioRow(key: string, patch: Partial<PlanServicioRow>) {
    setServicioRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  function removeServicioRow(key: string) {
    setServicioRows((current) => current.filter((item) => item.key !== key))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || submitting || generatingResumen) return

    const nombreValue = nombre.trim()
    const descripcionValue = descripcion.trim()
    const resumenValue = resumen.trim()

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
          resumen: resumenValue || undefined,
          activo,
          descuentoPorcentaje: descuentoPct,
          servicios: serviciosPayload,
        })
      } else if (editing) {
        await updateAvPlan(token, editing.id, {
          nombre: nombreValue,
          descripcion: descripcionValue || null,
          resumen: resumenValue || null,
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

  async function handleGenerateResumen() {
    if (!user || generatingResumen || submitting) return
    const serviciosPayload = servicioRows
      .map((row) => ({
        servicioId: row.servicioId,
        unidades: Math.floor(Number(row.unidades)),
      }))
      .filter((row) => row.servicioId && Number.isFinite(row.unidades) && row.unidades > 0)
    if (!serviciosPayload.length) {
      setFormError('Agrega al menos un servicio con unidades para generar el resumen.')
      return
    }
    setGeneratingResumen(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      const generated = await generateAvPlanResumen(token, {
        nombre: nombre.trim() || undefined,
        servicios: serviciosPayload,
      })
      setResumen(generated)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo generar el resumen con IA')
    } finally {
      setGeneratingResumen(false)
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
              {plan.resumen ? (
                <p className="av-plan-card-resumen">{plan.resumen}</p>
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

              <fieldset className="av-plan-servicios" disabled={submitting || generatingResumen}>
                <legend>Servicios del plan</legend>
                {servicios.length === 0 ? (
                  <p className="section-note">
                    Primero crea servicios en la pestaña Servicios para poder agregarlos aquí.
                  </p>
                ) : (
                  <>
                    <p className="section-note">
                      Elige un servicio de la lista o por código; luego define la cantidad y pulsa
                      Agregar.
                    </p>

                    <label className="login-field" htmlFor="av-plan-buscar">
                      Buscar servicio
                      <span className="av-cotizacion-buscar-wrap">
                        <Search size={16} strokeWidth={2} aria-hidden />
                        <input
                          id="av-plan-buscar"
                          value={textoBusqueda}
                          onChange={(event) => {
                            setTextoBusqueda(event.target.value)
                            setCodigoFeedback('')
                          }}
                          placeholder="Nombre, código o descripción…"
                          disabled={submitting || generatingResumen}
                          autoComplete="off"
                        />
                      </span>
                    </label>

                    <ul
                      className="av-cotizacion-servicio-results"
                      role="listbox"
                      aria-label="Resultados"
                    >
                      {serviciosFiltrados.length === 0 ? (
                        <li className="av-cotizacion-servicio-empty">Sin resultados</li>
                      ) : (
                        serviciosFiltrados.map((servicio) => {
                          const selected = servicioSeleccionado?.id === servicio.id
                          return (
                            <li key={servicio.id}>
                              <button
                                type="button"
                                className={`av-cotizacion-servicio-option${selected ? ' is-selected' : ''}`}
                                onClick={() => seleccionarServicio(servicio)}
                                disabled={submitting || generatingResumen}
                                aria-pressed={selected}
                              >
                                <span className="av-credito-ref">
                                  {normalizeRef(servicio.referencia)}
                                </span>
                                <span className="av-cotizacion-servicio-option-main">
                                  <strong>{servicio.nombre || 'Servicio'}</strong>
                                  {servicio.descripcion ? (
                                    <span className="av-cotizacion-servicio-option-desc">
                                      {servicio.descripcion}
                                    </span>
                                  ) : null}
                                </span>
                                <strong className="av-cotizacion-servicio-option-precio">
                                  {formatCop(servicio.costo || 0)}
                                </strong>
                              </button>
                            </li>
                          )
                        })
                      )}
                    </ul>

                    <div className="av-cotizacion-add-bar">
                      <div className="av-cotizacion-add-selected">
                        {servicioSeleccionado ? (
                          <>
                            <span className="av-credito-ref">
                              {normalizeRef(servicioSeleccionado.referencia)}
                            </span>
                            <strong>{servicioSeleccionado.nombre || 'Servicio'}</strong>
                            <span className="av-cotizacion-add-precio">
                              {formatCop(servicioSeleccionado.costo || 0)}
                            </span>
                            <button
                              type="button"
                              className="av-cotizacion-add-clear"
                              onClick={clearServicioSeleccionado}
                              disabled={submitting || generatingResumen}
                              aria-label="Quitar selección"
                            >
                              <X size={14} strokeWidth={2} aria-hidden />
                            </button>
                          </>
                        ) : (
                          <span className="av-cotizacion-add-placeholder">
                            Selecciona un servicio de la lista o escribe el código
                          </span>
                        )}
                      </div>

                      <label className="login-field" htmlFor="av-plan-codigo">
                        Código
                        <input
                          id="av-plan-codigo"
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={codigoBusqueda}
                          onChange={(event) => {
                            const next = event.target.value.replace(/\D/g, '').slice(0, 4)
                            setCodigoBusqueda(next)
                            setCodigoFeedback('')
                            if (next.length === 4) {
                              const match = servicios.find(
                                (item) => normalizeRef(item.referencia) === next,
                              )
                              if (match) {
                                setServicioSeleccionado(match)
                                setCodigoFeedback(
                                  `Seleccionado: ${normalizeRef(match.referencia)} · ${match.nombre || 'Servicio'}. Define la cantidad y pulsa Agregar.`,
                                )
                              } else {
                                setServicioSeleccionado(null)
                                setCodigoFeedback(`No hay servicio con código ${next}.`)
                              }
                            } else if (
                              servicioSeleccionado &&
                              normalizeRef(servicioSeleccionado.referencia) !==
                                next.padStart(4, '0').slice(-4)
                            ) {
                              setServicioSeleccionado(null)
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              if (servicioSeleccionado) {
                                addServicioSeleccionado()
                              } else {
                                seleccionarPorCodigo()
                              }
                            }
                          }}
                          placeholder="0421"
                          disabled={submitting || generatingResumen}
                          autoComplete="off"
                        />
                      </label>

                      <label className="login-field" htmlFor="av-plan-unidades-add">
                        Unidades
                        <input
                          id="av-plan-unidades-add"
                          type="number"
                          min={1}
                          step={1}
                          value={unidadesAdd}
                          onChange={(event) => setUnidadesAdd(event.target.value)}
                          disabled={submitting || generatingResumen}
                        />
                      </label>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={addServicioSeleccionado}
                        disabled={
                          submitting || generatingResumen || !servicioSeleccionado
                        }
                      >
                        <Plus size={14} strokeWidth={2} aria-hidden />
                        Agregar
                      </button>
                    </div>

                    {codigoFeedback ? (
                      <p
                        className={`av-plan-codigo-feedback ${
                          codigoFeedback.startsWith('Agregado') ||
                          codigoFeedback.startsWith('Seleccionado')
                            ? 'is-ok'
                            : 'is-error'
                        }`}
                        role="status"
                      >
                        {codigoFeedback}
                      </p>
                    ) : null}
                  </>
                )}

                {servicioRows.length > 0 ? (
                  <ul className="av-cotizacion-items-list">
                    {servicioRows.map((row) => {
                      const servicio = serviciosById.get(row.servicioId)
                      const unidades = Math.floor(Number(row.unidades))
                      const subtotal =
                        servicio && Number.isFinite(unidades) && unidades > 0
                          ? servicio.costo * unidades
                          : 0
                      return (
                        <li key={row.key}>
                          <div className="av-cotizacion-item-main">
                            <span className="av-credito-ref">
                              {normalizeRef(servicio?.referencia)}
                            </span>
                            <strong>{servicio?.nombre || 'Servicio'}</strong>
                            <span className="av-cotizacion-item-meta">
                              {formatCop(servicio?.costo || 0)} ×{' '}
                              <input
                                className="av-cotizacion-item-unidades"
                                type="number"
                                min={1}
                                step={1}
                                value={row.unidades}
                                onChange={(event) =>
                                  updateServicioRow(row.key, {
                                    unidades: event.target.value,
                                  })
                                }
                                disabled={submitting || generatingResumen}
                                aria-label={`Unidades de ${servicio?.nombre || 'servicio'}`}
                              />
                            </span>
                            <span>{formatCop(subtotal)}</span>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => removeServicioRow(row.key)}
                            disabled={submitting || generatingResumen}
                          >
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                            Quitar
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="section-note">Todavía no hay servicios en el plan.</p>
                )}

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
                    disabled={submitting || generatingResumen}
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
                Descripción corta
                <textarea
                  id="av-plan-descripcion"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  rows={2}
                  placeholder="Nota interna o título comercial breve"
                  disabled={submitting || generatingResumen}
                />
              </label>

              <div className="av-combo-resumen">
                <div className="av-combo-resumen-head">
                  <label className="login-field" htmlFor="av-plan-resumen">
                    Resumen del combo
                  </label>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void handleGenerateResumen()}
                    disabled={submitting || generatingResumen || !canSavePlan}
                  >
                    {generatingResumen ? (
                      <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                    ) : (
                      <Sparkles size={14} strokeWidth={2} aria-hidden />
                    )}
                    {generatingResumen ? 'Generando…' : 'Generar con IA'}
                  </button>
                </div>
                <textarea
                  id="av-plan-resumen"
                  value={resumen}
                  onChange={(event) => setResumen(event.target.value)}
                  rows={4}
                  placeholder="Resume qué incluye el plan según servicios, cantidades y entregables. Puedes escribirlo o generarlo con IA."
                  disabled={submitting || generatingResumen}
                />
                <p className="section-note">
                  La IA usa nombre, descripción, entregables y unidades de cada servicio del plan.
                </p>
              </div>

              <label className="av-plan-activo" htmlFor="av-plan-activo">
                <input
                  id="av-plan-activo"
                  type="checkbox"
                  checked={activo}
                  onChange={(event) => setActivo(event.target.checked)}
                  disabled={submitting || generatingResumen}
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
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeModal}
                  disabled={submitting || generatingResumen}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    submitting || generatingResumen || !canSavePlan || servicios.length === 0
                  }
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
