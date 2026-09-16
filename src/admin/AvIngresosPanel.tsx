import { useEffect, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvIngreso,
  createAvPago,
  deleteAvIngreso,
  deleteAvPago,
  listAvIngresos,
  listAvPlanes,
  type AvIngreso,
  type AvIngresoEstado,
  type AvIngresosFiltros,
  type AvIngresosResumen,
  type AvPlan,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ChevronLeft,
  LoaderCircle,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  X,
} from '../icons'

type VistaIngresos = 'lista' | 'detalle' | 'nuevo'

const ESTADO_LABEL: Record<AvIngresoEstado, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagado: 'Pagado',
  vencido: 'Vencido',
}

const EMPTY_RESUMEN: AvIngresosResumen = {
  totalFacturado: 0,
  totalCobrado: 0,
  totalPorCobrar: 0,
  totalVencido: 0,
  cantidad: 0,
}

const EMPTY_FILTROS: AvIngresosFiltros = {
  clientes: [],
  proyectos: [],
  estados: ['pendiente', 'parcial', 'pagado', 'vencido'],
}

function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

function previewEstado(fechaVencimiento: string): AvIngresoEstado {
  const today = todayBogota()
  if (fechaVencimiento && fechaVencimiento < today) return 'vencido'
  return 'pendiente'
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

export function AvIngresosPanel() {
  const { user } = useAuth()

  const [vista, setVista] = useState<VistaIngresos>('lista')
  const [ingresos, setIngresos] = useState<AvIngreso[]>([])
  const [resumen, setResumen] = useState<AvIngresosResumen>(EMPTY_RESUMEN)
  const [filtrosOpciones, setFiltrosOpciones] = useState<AvIngresosFiltros>(EMPTY_FILTROS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const [detalle, setDetalle] = useState<AvIngreso | null>(null)
  const [deletingId, setDeletingId] = useState('')

  const [nuevoPlanId, setNuevoPlanId] = useState('')
  const [nuevoCliente, setNuevoCliente] = useState('')
  const [nuevoProyecto, setNuevoProyecto] = useState('')
  const [nuevoConcepto, setNuevoConcepto] = useState('')
  const [nuevoValor, setNuevoValor] = useState('')
  const [nuevoCreditos, setNuevoCreditos] = useState('')
  const [nuevoEmision, setNuevoEmision] = useState(() => todayBogota())
  const [nuevoVencimiento, setNuevoVencimiento] = useState(() => todayBogota())
  const [nuevoNotas, setNuevoNotas] = useState('')
  const [nuevoError, setNuevoError] = useState('')
  const [nuevoSubmitting, setNuevoSubmitting] = useState(false)
  const [planesActivos, setPlanesActivos] = useState<AvPlan[]>([])
  const [planesLoading, setPlanesLoading] = useState(false)

  const [pagoModalOpen, setPagoModalOpen] = useState(false)
  const [pagoValor, setPagoValor] = useState('')
  const [pagoFecha, setPagoFecha] = useState(() => todayBogota())
  const [pagoMetodo, setPagoMetodo] = useState('')
  const [pagoReferencia, setPagoReferencia] = useState('')
  const [pagoNotas, setPagoNotas] = useState('')
  const [pagoError, setPagoError] = useState('')
  const [pagoSubmitting, setPagoSubmitting] = useState(false)
  const [deletingPagoId, setDeletingPagoId] = useState('')

  const estadoPreview = previewEstado(nuevoVencimiento)
  const planSeleccionado = planesActivos.find((plan) => plan.id === nuevoPlanId) ?? null

  useEffect(() => {
    setDetalle((current) => {
      if (!current) return current
      return ingresos.find((item) => item.id === current.id) ?? current
    })
  }, [ingresos])

  useEffect(() => {
    let cancelled = false

    async function loadPlanes() {
      if (!user || vista !== 'nuevo') return
      setPlanesLoading(true)
      try {
        const token = await user.getIdToken()
        const planes = await listAvPlanes(token, { activos: true })
        if (!cancelled) setPlanesActivos(planes)
      } catch {
        if (!cancelled) setPlanesActivos([])
      } finally {
        if (!cancelled) setPlanesLoading(false)
      }
    }

    void loadPlanes()
    return () => {
      cancelled = true
    }
  }, [user, vista])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvIngresos(token, {
          cliente: filtroCliente || undefined,
          proyecto: filtroProyecto || undefined,
          estado: filtroEstado || undefined,
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
        })
        if (cancelled) return
        setIngresos(data.ingresos)
        setResumen(data.resumen)
        setFiltrosOpciones(data.filtros)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los ingresos')
          setIngresos([])
          setResumen(EMPTY_RESUMEN)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    user,
    filtroCliente,
    filtroProyecto,
    filtroEstado,
    filtroDesde,
    filtroHasta,
    refreshTick,
  ])

  function openNuevo() {
    setNuevoPlanId('')
    setNuevoCliente('')
    setNuevoProyecto('')
    setNuevoConcepto('')
    setNuevoValor('')
    setNuevoCreditos('')
    setNuevoEmision(todayBogota())
    setNuevoVencimiento(todayBogota())
    setNuevoNotas('')
    setNuevoError('')
    setVista('nuevo')
  }

  function applyPlan(planId: string) {
    setNuevoPlanId(planId)
    if (!planId) {
      setNuevoCreditos('')
      return
    }
    const plan = planesActivos.find((item) => item.id === planId)
    if (!plan) return
    setNuevoValor(String(plan.precio))
    setNuevoCreditos(String(plan.creditos))
    if (!nuevoConcepto.trim()) setNuevoConcepto(plan.nombre || '')
    if (!nuevoProyecto.trim()) setNuevoProyecto(plan.nombre || '')
  }

  function openDetalle(item: AvIngreso) {
    setDetalle(item)
    setVista('detalle')
  }

  function backToLista() {
    setVista('lista')
    setDetalle(null)
    setPagoModalOpen(false)
  }

  async function handleCreateIngreso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const cliente = nuevoCliente.trim()
    const proyecto = nuevoProyecto.trim()
    const concepto = nuevoConcepto.trim()
    const valor = Number(String(nuevoValor).replace(/,/g, '').trim())
    const fechaEmision = nuevoEmision || todayBogota()
    const fechaVencimiento = nuevoVencimiento || todayBogota()
    const creditos = Number(String(nuevoCreditos).trim())

    if (!cliente) {
      setNuevoError('El cliente es obligatorio.')
      return
    }
    if (!proyecto) {
      setNuevoError('El proyecto/servicio es obligatorio.')
      return
    }
    if (!concepto) {
      setNuevoError('El concepto es obligatorio.')
      return
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      setNuevoError('El valor debe ser un número mayor a 0 (en pesos COP).')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEmision) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaVencimiento)) {
      setNuevoError('Las fechas no son válidas.')
      return
    }

    setNuevoSubmitting(true)
    setNuevoError('')
    try {
      const token = await user.getIdToken()
      const created = await createAvIngreso(token, {
        cliente,
        proyecto,
        concepto,
        valor,
        fechaEmision,
        fechaVencimiento,
        notas: nuevoNotas.trim() || undefined,
        planId: nuevoPlanId || undefined,
        creditos: Number.isInteger(creditos) && creditos > 0 ? creditos : undefined,
      })
      setDetalle(created)
      setVista('detalle')
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setNuevoError(err instanceof Error ? err.message : 'No se pudo crear el ingreso')
    } finally {
      setNuevoSubmitting(false)
    }
  }

  async function handleDeleteIngreso(item: AvIngreso) {
    if (!user) return
    const ok = window.confirm(
      `¿Eliminar el ingreso "${item.concepto || item.id}" de ${formatCop(item.valor)}? Se borrarán también sus pagos.`,
    )
    if (!ok) return
    setDeletingId(item.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvIngreso(token, item.id)
      if (detalle?.id === item.id) backToLista()
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el ingreso')
    } finally {
      setDeletingId('')
    }
  }

  function openPagoModal() {
    if (!detalle) return
    setPagoValor('')
    setPagoFecha(todayBogota())
    setPagoMetodo('')
    setPagoReferencia('')
    setPagoNotas('')
    setPagoError('')
    setPagoModalOpen(true)
  }

  function closePagoModal() {
    if (pagoSubmitting) return
    setPagoModalOpen(false)
    setPagoError('')
  }

  async function handleCreatePago(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !detalle) return

    const valor = Number(String(pagoValor).replace(/,/g, '').trim())
    const fecha = pagoFecha || todayBogota()

    if (!Number.isFinite(valor) || valor <= 0) {
      setPagoError('El valor del pago debe ser mayor a 0.')
      return
    }
    if (valor > detalle.saldoPendiente + 0.0001) {
      setPagoError(`El pago supera el saldo pendiente (${formatCop(detalle.saldoPendiente)}).`)
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setPagoError('La fecha no es válida.')
      return
    }

    setPagoSubmitting(true)
    setPagoError('')
    try {
      const token = await user.getIdToken()
      const updated = await createAvPago(token, detalle.id, {
        valor,
        fecha,
        metodoPago: pagoMetodo.trim() || undefined,
        referencia: pagoReferencia.trim() || undefined,
        notas: pagoNotas.trim() || undefined,
      })
      setDetalle(updated)
      setIngresos((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setPagoModalOpen(false)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setPagoError(err instanceof Error ? err.message : 'No se pudo registrar el pago')
    } finally {
      setPagoSubmitting(false)
    }
  }

  async function handleDeletePago(pagoId: string) {
    if (!user || !detalle) return
    const ok = window.confirm('¿Eliminar este pago? El saldo y el estado se recalcularán.')
    if (!ok) return
    setDeletingPagoId(pagoId)
    try {
      const token = await user.getIdToken()
      const updated = await deleteAvPago(token, detalle.id, pagoId)
      setDetalle(updated)
      setIngresos((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el pago')
    } finally {
      setDeletingPagoId('')
    }
  }

  if (vista === 'nuevo') {
    return (
      <div className="av-ingresos" role="tabpanel" aria-label="Nuevo ingreso">
        <div className="av-ingresos-toolbar">
          <button type="button" className="btn-secondary" onClick={backToLista}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            Volver al listado
          </button>
        </div>

        <form className="av-ingresos-form" onSubmit={(event) => void handleCreateIngreso(event)} noValidate>
          <div className="section-heading">
            <Plus size={18} strokeWidth={2} aria-hidden />
            <h3>Nuevo ingreso</h3>
          </div>
          <p className="section-note">
            El estado se calcula automáticamente según pagos y fecha de vencimiento.
          </p>

          <div className="av-ingresos-form-grid">
            <label className="login-field av-ingresos-span-2" htmlFor="av-ing-plan">
              Plan de créditos
              <select
                id="av-ing-plan"
                value={nuevoPlanId}
                onChange={(event) => applyPlan(event.target.value)}
                disabled={nuevoSubmitting || planesLoading}
              >
                <option value="">
                  {planesLoading ? 'Cargando planes...' : 'Sin plan / valor personalizado'}
                </option>
                {planesActivos.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} — {plan.creditos} créditos — {formatCop(plan.precio)}
                  </option>
                ))}
              </select>
            </label>

            <label className="login-field" htmlFor="av-ing-cliente">
              Cliente
              <input
                id="av-ing-cliente"
                type="text"
                list="av-clientes-list"
                value={nuevoCliente}
                onChange={(event) => setNuevoCliente(event.target.value)}
                placeholder="Nombre del cliente"
                required
                disabled={nuevoSubmitting}
                autoFocus
              />
            </label>

            <label className="login-field" htmlFor="av-ing-proyecto">
              Proyecto / servicio
              <input
                id="av-ing-proyecto"
                type="text"
                list="av-proyectos-list"
                value={nuevoProyecto}
                onChange={(event) => setNuevoProyecto(event.target.value)}
                placeholder="Producción, alquiler, edición..."
                required
                disabled={nuevoSubmitting}
              />
            </label>

            <label className="login-field av-ingresos-span-2" htmlFor="av-ing-concepto">
              Concepto
              <input
                id="av-ing-concepto"
                type="text"
                value={nuevoConcepto}
                onChange={(event) => setNuevoConcepto(event.target.value)}
                placeholder="Descripción de la factura o ingreso"
                required
                disabled={nuevoSubmitting}
              />
            </label>

            <label className="login-field" htmlFor="av-ing-valor">
              Valor (COP)
              <input
                id="av-ing-valor"
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                value={nuevoValor}
                onChange={(event) => setNuevoValor(event.target.value)}
                placeholder="1500000"
                required
                disabled={nuevoSubmitting || Boolean(planSeleccionado)}
                title={
                  planSeleccionado
                    ? 'Precio tomado del plan seleccionado'
                    : undefined
                }
              />
            </label>

            <label className="login-field" htmlFor="av-ing-creditos">
              Créditos
              <input
                id="av-ing-creditos"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={nuevoCreditos}
                onChange={(event) => setNuevoCreditos(event.target.value)}
                placeholder={planSeleccionado ? String(planSeleccionado.creditos) : '—'}
                readOnly={Boolean(planSeleccionado)}
                disabled={nuevoSubmitting || Boolean(planSeleccionado)}
              />
            </label>

            <label className="login-field" htmlFor="av-ing-estado">
              Estado
              <input
                id="av-ing-estado"
                type="text"
                value={ESTADO_LABEL[estadoPreview]}
                readOnly
                disabled
                title="Se calcula según vencimiento y pagos"
              />
            </label>

            <label className="login-field" htmlFor="av-ing-emision">
              Fecha de emisión
              <input
                id="av-ing-emision"
                type="date"
                value={nuevoEmision}
                onChange={(event) => setNuevoEmision(event.target.value || todayBogota())}
                required
                disabled={nuevoSubmitting}
              />
            </label>

            <label className="login-field" htmlFor="av-ing-vencimiento">
              Fecha de vencimiento
              <input
                id="av-ing-vencimiento"
                type="date"
                value={nuevoVencimiento}
                onChange={(event) => setNuevoVencimiento(event.target.value || todayBogota())}
                required
                disabled={nuevoSubmitting}
              />
            </label>

            <label className="login-field av-ingresos-span-2" htmlFor="av-ing-notas">
              Notas (opcional)
              <textarea
                id="av-ing-notas"
                value={nuevoNotas}
                onChange={(event) => setNuevoNotas(event.target.value)}
                rows={3}
                disabled={nuevoSubmitting}
                placeholder="Observaciones internas"
              />
            </label>
          </div>

          <datalist id="av-clientes-list">
            {filtrosOpciones.clientes.map((cliente) => (
              <option key={cliente} value={cliente} />
            ))}
          </datalist>
          <datalist id="av-proyectos-list">
            {filtrosOpciones.proyectos.map((proyecto) => (
              <option key={proyecto} value={proyecto} />
            ))}
          </datalist>

          {nuevoError ? (
            <p className="login-error" role="alert">
              <AlertCircle size={16} strokeWidth={2} aria-hidden />
              {nuevoError}
            </p>
          ) : null}

          <div className="av-ingresos-form-actions">
            <button type="button" className="btn-secondary" onClick={backToLista} disabled={nuevoSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={nuevoSubmitting}>
              {nuevoSubmitting ? (
                <>
                  <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                  Guardando...
                </>
              ) : (
                'Crear ingreso'
              )}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (vista === 'detalle' && detalle) {
    return (
      <div className="av-ingresos" role="tabpanel" aria-label="Detalle del ingreso">
        <div className="av-ingresos-toolbar">
          <button type="button" className="btn-secondary" onClick={backToLista}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            Volver al listado
          </button>
          <div className="av-ingresos-toolbar-actions">
            {detalle.saldoPendiente > 0 ? (
              <button type="button" className="btn-primary" onClick={openPagoModal}>
                <Plus size={16} strokeWidth={2} aria-hidden />
                Registrar pago
              </button>
            ) : null}
            <button
              type="button"
              className="btn-danger"
              disabled={deletingId === detalle.id}
              onClick={() => void handleDeleteIngreso(detalle)}
            >
              {deletingId === detalle.id ? (
                <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
              ) : (
                <Trash2 size={16} strokeWidth={2} aria-hidden />
              )}
              Eliminar
            </button>
          </div>
        </div>

        <div className="av-ingresos-detail">
          <div className="av-ingresos-detail-head">
            <div>
              <p className="av-ingresos-kicker">Ingreso</p>
              <h3>{detalle.concepto || 'Sin concepto'}</h3>
              <p className="section-note">
                {detalle.cliente || '—'} · {detalle.proyecto || '—'}
                {detalle.planNombre ? ` · ${detalle.planNombre}` : ''}
              </p>
            </div>
            <span className={`av-estado av-estado-${detalle.estado}`}>
              {ESTADO_LABEL[detalle.estado]}
            </span>
          </div>

          <div className="contable-summary">
            <div>
              <span>Valor</span>
              <strong>{formatCop(detalle.valor)}</strong>
            </div>
            <div>
              <span>Total pagado</span>
              <strong>{formatCop(detalle.totalPagado)}</strong>
            </div>
            <div>
              <span>Saldo pendiente</span>
              <strong>{formatCop(detalle.saldoPendiente)}</strong>
            </div>
            <div>
              <span>Créditos</span>
              <strong>{detalle.creditos ?? '—'}</strong>
            </div>
          </div>

          <dl className="av-ingresos-meta">
            <div>
              <dt>Plan</dt>
              <dd>{detalle.planNombre || 'Sin plan'}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{ESTADO_LABEL[detalle.estado]}</dd>
            </div>
            <div>
              <dt>Emisión</dt>
              <dd>{formatYmd(detalle.fechaEmision)}</dd>
            </div>
            <div>
              <dt>Vencimiento</dt>
              <dd>{formatYmd(detalle.fechaVencimiento)}</dd>
            </div>
            {detalle.notas ? (
              <div className="av-ingresos-span-2">
                <dt>Notas</dt>
                <dd>{detalle.notas}</dd>
              </div>
            ) : null}
          </dl>

          <div className="av-ingresos-pagos-head">
            <h4>Historial de pagos</h4>
            <p className="section-note">
              {detalle.pagos.length
                ? `${detalle.pagos.length} pago${detalle.pagos.length === 1 ? '' : 's'} registrado${detalle.pagos.length === 1 ? '' : 's'}`
                : 'Aún no hay pagos registrados'}
            </p>
          </div>

          {detalle.pagos.length === 0 ? (
            <div className="proyectos-empty">
              <Receipt size={28} strokeWidth={1.75} aria-hidden />
              <p>Registra el primer pago para actualizar el saldo y el estado.</p>
              {detalle.saldoPendiente > 0 ? (
                <button type="button" className="btn-primary" onClick={openPagoModal}>
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Registrar pago
                </button>
              ) : null}
            </div>
          ) : (
            <div className="pagos-table-wrap">
              <table className="pagos-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Valor</th>
                    <th>Método</th>
                    <th>Referencia</th>
                    <th>Notas</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {detalle.pagos.map((pago) => (
                    <tr key={pago.id}>
                      <td>{formatYmd(pago.fecha)}</td>
                      <td>{formatCop(pago.valor)}</td>
                      <td>{pago.metodoPago || '—'}</td>
                      <td>{pago.referencia || '—'}</td>
                      <td>{pago.notas || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={deletingPagoId === pago.id}
                          aria-label="Eliminar pago"
                          onClick={() => void handleDeletePago(pago.id)}
                        >
                          {deletingPagoId === pago.id ? (
                            <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                          ) : (
                            <Trash2 size={16} strokeWidth={2} aria-hidden />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagoModalOpen ? (
          <div className="modal-overlay" role="presentation" onClick={closePagoModal}>
            <div
              className="modal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="av-pago-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <h2 id="av-pago-modal-title">Registrar pago</h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closePagoModal}
                  disabled={pagoSubmitting}
                  aria-label="Cerrar"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <form className="modal-form" onSubmit={(event) => void handleCreatePago(event)} noValidate>
                <p className="section-note">
                  Saldo pendiente: <strong>{formatCop(detalle.saldoPendiente)}</strong>
                </p>

                <label className="login-field" htmlFor="av-pago-valor">
                  Valor (COP)
                  <input
                    id="av-pago-valor"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="1"
                    max={detalle.saldoPendiente}
                    value={pagoValor}
                    onChange={(event) => setPagoValor(event.target.value)}
                    placeholder={String(Math.round(detalle.saldoPendiente))}
                    required
                    disabled={pagoSubmitting}
                    autoFocus
                  />
                </label>

                <label className="login-field" htmlFor="av-pago-fecha">
                  Fecha
                  <input
                    id="av-pago-fecha"
                    type="date"
                    value={pagoFecha}
                    onChange={(event) => setPagoFecha(event.target.value || todayBogota())}
                    required
                    disabled={pagoSubmitting}
                  />
                </label>

                <label className="login-field" htmlFor="av-pago-metodo">
                  Método de pago (opcional)
                  <input
                    id="av-pago-metodo"
                    type="text"
                    value={pagoMetodo}
                    onChange={(event) => setPagoMetodo(event.target.value)}
                    placeholder="Transferencia, efectivo, Nequi..."
                    disabled={pagoSubmitting}
                  />
                </label>

                <label className="login-field" htmlFor="av-pago-ref">
                  Referencia (opcional)
                  <input
                    id="av-pago-ref"
                    type="text"
                    value={pagoReferencia}
                    onChange={(event) => setPagoReferencia(event.target.value)}
                    placeholder="N.º de comprobante"
                    disabled={pagoSubmitting}
                  />
                </label>

                <label className="login-field" htmlFor="av-pago-notas">
                  Notas (opcional)
                  <input
                    id="av-pago-notas"
                    type="text"
                    value={pagoNotas}
                    onChange={(event) => setPagoNotas(event.target.value)}
                    disabled={pagoSubmitting}
                  />
                </label>

                {pagoError ? (
                  <p className="login-error" role="alert">
                    <AlertCircle size={16} strokeWidth={2} aria-hidden />
                    {pagoError}
                  </p>
                ) : null}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closePagoModal}
                    disabled={pagoSubmitting}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={pagoSubmitting}>
                    {pagoSubmitting ? (
                      <>
                        <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                        Guardando...
                      </>
                    ) : (
                      'Registrar pago'
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

  return (
    <div className="av-ingresos" role="tabpanel" aria-label="Ingresos">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Ingresos</h3>
          <p className="section-note">Resumen, facturas y cobros de Nodefex Audio Visual.</p>
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
          <button type="button" className="btn-primary" onClick={openNuevo}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Nuevo ingreso
          </button>
        </div>
      </div>

      <div className="contable-summary">
        <div>
          <span>Total facturado</span>
          <strong>{formatCop(resumen.totalFacturado)}</strong>
        </div>
        <div>
          <span>Total cobrado</span>
          <strong>{formatCop(resumen.totalCobrado)}</strong>
        </div>
        <div>
          <span>Total por cobrar</span>
          <strong>{formatCop(resumen.totalPorCobrar)}</strong>
        </div>
        <div>
          <span>Total vencido</span>
          <strong>{formatCop(resumen.totalVencido)}</strong>
        </div>
      </div>

      <div className="av-ingresos-filters">
        <label className="login-field" htmlFor="av-filtro-cliente">
          Cliente
          <select
            id="av-filtro-cliente"
            value={filtroCliente}
            onChange={(event) => setFiltroCliente(event.target.value)}
          >
            <option value="">Todos</option>
            {filtrosOpciones.clientes.map((cliente) => (
              <option key={cliente} value={cliente}>
                {cliente}
              </option>
            ))}
          </select>
        </label>

        <label className="login-field" htmlFor="av-filtro-proyecto">
          Proyecto
          <select
            id="av-filtro-proyecto"
            value={filtroProyecto}
            onChange={(event) => setFiltroProyecto(event.target.value)}
          >
            <option value="">Todos</option>
            {filtrosOpciones.proyectos.map((proyecto) => (
              <option key={proyecto} value={proyecto}>
                {proyecto}
              </option>
            ))}
          </select>
        </label>

        <label className="login-field" htmlFor="av-filtro-estado">
          Estado
          <select
            id="av-filtro-estado"
            value={filtroEstado}
            onChange={(event) => setFiltroEstado(event.target.value)}
          >
            <option value="">Todos</option>
            {filtrosOpciones.estados.map((estado) => (
              <option key={estado} value={estado}>
                {ESTADO_LABEL[estado]}
              </option>
            ))}
          </select>
        </label>

        <label className="login-field" htmlFor="av-filtro-desde">
          Desde
          <input
            id="av-filtro-desde"
            type="date"
            value={filtroDesde}
            max={filtroHasta || undefined}
            onChange={(event) => setFiltroDesde(event.target.value)}
          />
        </label>

        <label className="login-field" htmlFor="av-filtro-hasta">
          Hasta
          <input
            id="av-filtro-hasta"
            type="date"
            value={filtroHasta}
            min={filtroDesde || undefined}
            onChange={(event) => setFiltroHasta(event.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando ingresos...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && ingresos.length === 0 ? (
        <div className="proyectos-empty">
          <Receipt size={28} strokeWidth={1.75} aria-hidden />
          <p>No hay ingresos con estos filtros. Crea el primero para empezar.</p>
          <button type="button" className="btn-primary" onClick={openNuevo}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Nuevo ingreso
          </button>
        </div>
      ) : null}

      {!loading && !error && ingresos.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Emisión</th>
                <th>Cliente</th>
                <th>Plan</th>
                <th>Concepto</th>
                <th>Créditos</th>
                <th>Valor</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Vence</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {ingresos.map((item) => (
                <tr key={item.id}>
                  <td>{formatYmd(item.fechaEmision)}</td>
                  <td>{item.cliente || '—'}</td>
                  <td>{item.planNombre || item.proyecto || '—'}</td>
                  <td>
                    <button type="button" className="av-ingresos-link" onClick={() => openDetalle(item)}>
                      {item.concepto || 'Sin concepto'}
                    </button>
                  </td>
                  <td>{item.creditos ?? '—'}</td>
                  <td>{formatCop(item.valor)}</td>
                  <td>{formatCop(item.totalPagado)}</td>
                  <td>{formatCop(item.saldoPendiente)}</td>
                  <td>
                    <span className={`av-estado av-estado-${item.estado}`}>
                      {ESTADO_LABEL[item.estado]}
                    </span>
                  </td>
                  <td>{formatYmd(item.fechaVencimiento)}</td>
                  <td>
                    <div className="av-ingresos-row-actions">
                      <button type="button" className="btn-secondary" onClick={() => openDetalle(item)}>
                        Ver
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={deletingId === item.id}
                        aria-label="Eliminar ingreso"
                        onClick={() => void handleDeleteIngreso(item)}
                      >
                        {deletingId === item.id ? (
                          <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                        ) : (
                          <Trash2 size={16} strokeWidth={2} aria-hidden />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
