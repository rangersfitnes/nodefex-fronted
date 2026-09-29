import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvCotizacion,
  deleteAvCotizacion,
  generateAvCotizacionResumen,
  getAvEmpresaGenio,
  listAvCotizaciones,
  listAvServiciosCreditos,
  type AvCotizacion,
  type AvCotizacionItem,
  type AvEmpresaGenio,
  type AvServicioCredito,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from '../icons'
import { downloadAvCotizacionPdf } from './avCotizacionPdf'

type DraftItem = {
  id: string
  servicioId: string
  referencia: string
  concepto: string
  unidades: number
  costoUnitario: number
  valor: number
}

function newDraftId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeRef(raw: string | null | undefined): string {
  return String(raw || '')
    .replace(/\D/g, '')
    .padStart(4, '0')
    .slice(-4)
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
  }).format(new Date(iso))
}

export function AvCotizacionesPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [cotizaciones, setCotizaciones] = useState<AvCotizacion[]>([])
  const [servicios, setServicios] = useState<AvServicioCredito[]>([])
  const [empresa, setEmpresa] = useState<AvEmpresaGenio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteDocumento, setClienteDocumento] = useState('')
  const [clienteCorreo, setClienteCorreo] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [codigoBusqueda, setCodigoBusqueda] = useState('')
  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [unidadesAdd, setUnidadesAdd] = useState('1')
  const [codigoFeedback, setCodigoFeedback] = useState('')
  const [servicioSeleccionado, setServicioSeleccionado] = useState<AvServicioCredito | null>(null)
  const [resumen, setResumen] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [generatingResumen, setGeneratingResumen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const [list, empresaData, serviciosData] = await Promise.all([
          listAvCotizaciones(token),
          getAvEmpresaGenio(token),
          listAvServiciosCreditos(token),
        ])
        if (cancelled) return
        setCotizaciones(list)
        setEmpresa(empresaData)
        setServicios(serviciosData)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las cotizaciones')
          setCotizaciones([])
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

  const draftSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.valor > 0 ? item.valor : 0), 0),
    [items],
  )

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

  function openCreate() {
    setClienteNombre('')
    setClienteDocumento('')
    setClienteCorreo('')
    setClienteTelefono('')
    setItems([])
    setCodigoBusqueda('')
    setTextoBusqueda('')
    setUnidadesAdd('1')
    setCodigoFeedback('')
    setServicioSeleccionado(null)
    setResumen('')
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

  async function handleGenerateResumen() {
    if (!user || generatingResumen || submitting) return
    if (!items.length) {
      setFormError('Agrega al menos un servicio para generar el resumen.')
      return
    }
    setGeneratingResumen(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      const generated = await generateAvCotizacionResumen(token, {
        clienteNombre: clienteNombre.trim() || undefined,
        items: items.map((item) => ({
          servicioId: item.servicioId,
          referencia: item.referencia,
          unidades: item.unidades,
        })),
      })
      setResumen(generated)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo generar el resumen con IA')
    } finally {
      setGeneratingResumen(false)
    }
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
    const unidades = parseUnidades()
    const costoUnitario = Math.round(Number(servicio.costo) || 0)
    if (costoUnitario <= 0) {
      setFormError('El servicio no tiene un costo válido.')
      return
    }
    const referencia = normalizeRef(servicio.referencia)
    const concepto = `${referencia} · ${servicio.nombre || 'Servicio'}`
    setItems((current) => [
      ...current,
      {
        id: newDraftId(),
        servicioId: servicio.id,
        referencia,
        concepto,
        unidades,
        costoUnitario,
        valor: costoUnitario * unidades,
      },
    ])
    setCodigoBusqueda('')
    setTextoBusqueda('')
    setUnidadesAdd('1')
    setServicioSeleccionado(null)
    setFormError('')
    setCodigoFeedback(
      `Agregado: ${referencia} · ${servicio.nombre || 'Servicio'} × ${unidades} = ${formatCop(costoUnitario * unidades)}`,
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

  function updateItemUnidades(id: string, raw: string) {
    const unidades = Math.floor(Number(String(raw).replace(/,/g, '').trim()))
    if (!Number.isFinite(unidades) || unidades <= 0) return
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              unidades,
              valor: item.costoUnitario * unidades,
            }
          : item,
      ),
    )
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user || submitting || generatingResumen) return

    const nombre = clienteNombre.trim()
    const resumenValue = resumen.trim()
    const payloadItems: AvCotizacionItem[] = items.map((item) => ({
      concepto: item.concepto.trim(),
      valor: item.valor,
      servicioId: item.servicioId,
      referencia: item.referencia,
      unidades: item.unidades,
      costoUnitario: item.costoUnitario,
    }))

    if (!nombre) {
      setFormError('El nombre del cliente es obligatorio.')
      return
    }
    if (!payloadItems.length) {
      setFormError('Agrega al menos un servicio con su código.')
      return
    }
    if (!resumenValue) {
      setFormError('El resumen es obligatorio.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      const created = await createAvCotizacion(token, {
        clienteNombre: nombre,
        clienteDocumento: clienteDocumento.trim() || undefined,
        clienteCorreo: clienteCorreo.trim() || undefined,
        clienteTelefono: clienteTelefono.trim() || undefined,
        items: payloadItems,
        resumen: resumenValue,
      })
      setCotizaciones((current) => [created, ...current])
      setModalOpen(false)
      void downloadAvCotizacionPdf(created, empresa)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la cotización')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(cotizacion: AvCotizacion) {
    if (!user || readOnly || deletingId) return
    const ok = window.confirm(
      `¿Eliminar la cotización ${cotizacion.numero || ''} de «${cotizacion.clienteNombre || 'cliente'}»?`,
    )
    if (!ok) return
    setDeletingId(cotizacion.id)
    try {
      const token = await user.getIdToken()
      await deleteAvCotizacion(token, cotizacion.id)
      setCotizaciones((current) => current.filter((item) => item.id !== cotizacion.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="av-cotizaciones" role="tabpanel" aria-label="Cotizaciones">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Cotizaciones</h3>
          <p className="section-note">
            Arma cotizaciones buscando servicios por código. El valor sale del catálogo de Servicios.
          </p>
        </div>
        <div className="av-ingresos-toolbar-actions">
          <button
            type="button"
            className="btn-secondary contable-refresh"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden className={loading ? 'spin' : undefined} />
            Actualizar
          </button>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nueva cotización
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando cotizaciones...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && cotizaciones.length === 0 ? (
        <div className="proyectos-empty">
          <FileText size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay cotizaciones. Configura los datos de empresa arriba y crea la primera.</p>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nueva cotización
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && cotizaciones.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Ítems</th>
                <th>Subtotal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map((cotizacion) => (
                <tr key={cotizacion.id}>
                  <td>
                    <span className="av-credito-ref">{cotizacion.numero || '—'}</span>
                  </td>
                  <td>{cotizacion.clienteNombre || '—'}</td>
                  <td>{formatFecha(cotizacion.creadoEn)}</td>
                  <td>{cotizacion.items.length}</td>
                  <td>{formatCop(cotizacion.subtotal)}</td>
                  <td>
                    <div className="av-ingresos-row-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void downloadAvCotizacionPdf(cotizacion, empresa)}
                      >
                        <Download size={14} strokeWidth={2} aria-hidden />
                        PDF
                      </button>
                      {!readOnly ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={deletingId === cotizacion.id}
                          onClick={() => void handleDelete(cotizacion)}
                        >
                          {deletingId === cotizacion.id ? (
                            <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                          ) : (
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                          )}
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel av-cotizacion-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-cotizacion-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-cotizacion-modal-title">Nueva cotización</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <form className="modal-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
              <div className="av-ingresos-form-grid">
                <label className="login-field av-ingresos-span-2" htmlFor="av-cot-cliente">
                  Nombre del cliente
                  <input
                    id="av-cot-cliente"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    disabled={submitting}
                    required
                    autoFocus
                  />
                </label>
                <label className="login-field" htmlFor="av-cot-doc">
                  Documento / NIT cliente
                  <input
                    id="av-cot-doc"
                    value={clienteDocumento}
                    onChange={(e) => setClienteDocumento(e.target.value)}
                    disabled={submitting}
                  />
                </label>
                <label className="login-field" htmlFor="av-cot-tel">
                  Teléfono cliente
                  <input
                    id="av-cot-tel"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    disabled={submitting}
                  />
                </label>
                <label className="login-field av-ingresos-span-2" htmlFor="av-cot-mail">
                  Correo cliente
                  <input
                    id="av-cot-mail"
                    type="email"
                    value={clienteCorreo}
                    onChange={(e) => setClienteCorreo(e.target.value)}
                    disabled={submitting}
                  />
                </label>
              </div>

              <section className="av-cotizacion-items">
                <h3>Servicios de la cotización</h3>
                <p className="section-note">
                  Elige un servicio de la lista o por código; luego define la cantidad y pulsa Agregar.
                </p>

                {servicios.length === 0 ? (
                  <p className="section-note av-readonly-banner">
                    No hay servicios en el catálogo. Créalos primero en la pestaña Servicios.
                  </p>
                ) : (
                  <>
                    <label className="login-field" htmlFor="av-cot-buscar">
                      Buscar servicio
                      <span className="av-cotizacion-buscar-wrap">
                        <Search size={16} strokeWidth={2} aria-hidden />
                        <input
                          id="av-cot-buscar"
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

                    <ul className="av-cotizacion-servicio-results" role="listbox" aria-label="Resultados">
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

                      <label className="login-field" htmlFor="av-cot-codigo">
                        Código
                        <input
                          id="av-cot-codigo"
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

                      <label className="login-field" htmlFor="av-cot-unidades">
                        Unidades
                        <input
                          id="av-cot-unidades"
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

                {items.length > 0 ? (
                  <ul className="av-cotizacion-items-list">
                    {items.map((item) => (
                      <li key={item.id}>
                        <div className="av-cotizacion-item-main">
                          <span className="av-credito-ref">{item.referencia}</span>
                          <strong>{item.concepto.replace(/^\d{4}\s·\s/, '')}</strong>
                          <span className="av-cotizacion-item-meta">
                            {formatCop(item.costoUnitario)} ×{' '}
                            <input
                              className="av-cotizacion-item-unidades"
                              type="number"
                              min={1}
                              step={1}
                              value={item.unidades}
                              onChange={(event) =>
                                updateItemUnidades(item.id, event.target.value)
                              }
                              disabled={submitting}
                              aria-label={`Unidades de ${item.concepto}`}
                            />
                          </span>
                          <span>{formatCop(item.valor)}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => removeItem(item.id)}
                          disabled={submitting}
                        >
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="section-note">Todavía no hay servicios en la cotización.</p>
                )}

                <div className="av-cotizacion-subtotal">
                  <span>Subtotal</span>
                  <strong>{formatCop(draftSubtotal)}</strong>
                </div>
              </section>

              <div className="av-combo-resumen">
                <div className="av-combo-resumen-head">
                  <label className="login-field" htmlFor="av-cot-resumen">
                    Resumen del combo
                  </label>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void handleGenerateResumen()}
                    disabled={submitting || generatingResumen || items.length === 0}
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
                  id="av-cot-resumen"
                  value={resumen}
                  onChange={(e) => setResumen(e.target.value)}
                  rows={4}
                  disabled={submitting || generatingResumen}
                  required
                  placeholder="Alcance y entregables según los servicios y cantidades. Puedes escribirlo o generarlo con IA."
                />
                <p className="section-note">
                  La IA usa nombre, descripción, entregables y unidades de cada servicio de la cotización.
                </p>
              </div>

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
                  disabled={submitting || generatingResumen || servicios.length === 0}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Download size={16} strokeWidth={2} aria-hidden />
                      Guardar y descargar PDF
                    </>
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
