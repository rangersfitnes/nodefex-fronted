import { useEffect, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvFactura,
  createAvFacturaPago,
  deleteAvFactura,
  deleteAvFacturaPago,
  listAvClientes,
  listAvFacturas,
  listAvPlanes,
  type AvCliente,
  type AvFactura,
  type AvFacturaEstado,
  type AvFacturasFiltros,
  type AvFacturasResumen,
  type AvMetodoPagoTipo,
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

type VistaFacturacion = 'lista' | 'detalle'

const ESTADO_LABEL: Record<AvFacturaEstado, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagado: 'Pagado',
  vencido: 'Vencido',
}

const METODO_PAGO_LABEL: Record<AvMetodoPagoTipo, string> = {
  efectivo: 'Efectivo',
  cuenta_bancaria: 'Cuenta bancaria',
  pasarela: 'Pasarela de pago',
}

type PagoParteForm = {
  id: string
  tipo: AvMetodoPagoTipo
  valor: string
  cuenta: string
  detalle: string
}

function newPagoParte(partial?: Partial<PagoParteForm>): PagoParteForm {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo: 'efectivo',
    valor: '',
    cuenta: '',
    detalle: '',
    ...partial,
  }
}

function formatPagoPartes(
  partes: Array<{
    tipo: AvMetodoPagoTipo
    valor: number
    cuenta: string | null
    detalle: string | null
  }>,
  fallback: string | null,
): string {
  if (!partes.length) return fallback || '—'
  return partes
    .map((parte) => {
      const label = METODO_PAGO_LABEL[parte.tipo] || parte.tipo
      if (parte.tipo === 'cuenta_bancaria' && parte.cuenta) {
        return `${label} (${parte.cuenta}): ${formatCop(parte.valor)}`
      }
      if (parte.tipo === 'pasarela' && parte.detalle) {
        return `${label} (${parte.detalle}): ${formatCop(parte.valor)}`
      }
      return `${label}: ${formatCop(parte.valor)}`
    })
    .join(' · ')
}

const EMPTY_RESUMEN: AvFacturasResumen = {
  totalFacturado: 0,
  totalCobrado: 0,
  totalPorCobrar: 0,
  totalVencido: 0,
  cantidad: 0,
}

const EMPTY_FILTROS: AvFacturasFiltros = {
  clientes: [],
  estados: ['pendiente', 'parcial', 'pagado', 'vencido'],
}

function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
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

export function AvFacturacionPanel() {
  const { user } = useAuth()

  const [vista, setVista] = useState<VistaFacturacion>('lista')
  const [facturas, setFacturas] = useState<AvFactura[]>([])
  const [resumen, setResumen] = useState<AvFacturasResumen>(EMPTY_RESUMEN)
  const [filtrosOpciones, setFiltrosOpciones] = useState<AvFacturasFiltros>(EMPTY_FILTROS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const [detalle, setDetalle] = useState<AvFactura | null>(null)
  const [deletingId, setDeletingId] = useState('')

  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [clientes, setClientes] = useState<AvCliente[]>([])
  const [planesActivos, setPlanesActivos] = useState<AvPlan[]>([])
  const [nuevoClienteId, setNuevoClienteId] = useState('')
  const [nuevoPlanId, setNuevoPlanId] = useState('')
  const [nuevoEmision, setNuevoEmision] = useState(() => todayBogota())
  const [nuevoNotas, setNuevoNotas] = useState('')
  const [nuevoError, setNuevoError] = useState('')
  const [nuevoSubmitting, setNuevoSubmitting] = useState(false)

  const [pagoModalOpen, setPagoModalOpen] = useState(false)
  const [pagoValor, setPagoValor] = useState('')
  const [pagoFecha, setPagoFecha] = useState(() => todayBogota())
  const [pagoPartes, setPagoPartes] = useState<PagoParteForm[]>(() => [newPagoParte()])
  const [pagoReferencia, setPagoReferencia] = useState('')
  const [pagoNotas, setPagoNotas] = useState('')
  const [pagoError, setPagoError] = useState('')
  const [pagoSubmitting, setPagoSubmitting] = useState(false)
  const [deletingPagoId, setDeletingPagoId] = useState('')

  const planSeleccionado = planesActivos.find((plan) => plan.id === nuevoPlanId) ?? null

  useEffect(() => {
    setDetalle((current) => {
      if (!current) return current
      return facturas.find((item) => item.id === current.id) ?? current
    })
  }, [facturas])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvFacturas(token, {
          cliente: filtroCliente || undefined,
          estado: filtroEstado || undefined,
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
        })
        if (cancelled) return
        setFacturas(data.facturas)
        setResumen(data.resumen)
        setFiltrosOpciones(data.filtros)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las facturas')
          setFacturas([])
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
  }, [user, filtroCliente, filtroEstado, filtroDesde, filtroHasta, refreshTick])

  async function openNueva() {
    setNuevoClienteId('')
    setNuevoPlanId('')
    setNuevoEmision(todayBogota())
    setNuevoNotas('')
    setNuevoError('')
    setNuevaOpen(true)

    if (!user) return
    try {
      const token = await user.getIdToken()
      const [clientesData, planes] = await Promise.all([
        listAvClientes(token),
        listAvPlanes(token, { activos: true }),
      ])
      setClientes(clientesData)
      setPlanesActivos(planes)
    } catch {
      setClientes([])
      setPlanesActivos([])
    }
  }

  function closeNueva() {
    if (nuevoSubmitting) return
    setNuevaOpen(false)
    setNuevoError('')
  }

  function openDetalle(item: AvFactura) {
    setDetalle(item)
    setVista('detalle')
  }

  function backToLista() {
    setVista('lista')
    setDetalle(null)
    setPagoModalOpen(false)
  }

  async function handleCreateFactura(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const cliente = clientes.find((c) => c.id === nuevoClienteId)
    if (!cliente?.nombre) {
      setNuevoError('Selecciona un cliente.')
      return
    }
    if (!nuevoPlanId) {
      setNuevoError('Selecciona un plan.')
      return
    }

    const fechaEmision = nuevoEmision || todayBogota()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEmision)) {
      setNuevoError('La fecha de emisión no es válida.')
      return
    }

    setNuevoSubmitting(true)
    setNuevoError('')
    try {
      const token = await user.getIdToken()
      const created = await createAvFactura(token, {
        cliente: cliente.nombre || '',
        clienteId: cliente.id,
        planId: nuevoPlanId,
        fechaEmision,
        notas: nuevoNotas.trim() || undefined,
      })
      setNuevaOpen(false)
      setDetalle(created)
      setVista('detalle')
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setNuevoError(err instanceof Error ? err.message : 'No se pudo crear la factura')
    } finally {
      setNuevoSubmitting(false)
    }
  }

  async function handleDeleteFactura(item: AvFactura) {
    if (!user) return
    const ok = window.confirm(
      `¿Eliminar la factura ${item.numero || item.id} de ${formatCop(item.valor)}? Se borrarán también sus pagos.`,
    )
    if (!ok) return
    setDeletingId(item.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvFactura(token, item.id)
      if (detalle?.id === item.id) backToLista()
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la factura')
    } finally {
      setDeletingId('')
    }
  }

  function openPagoModal() {
    if (!detalle) return
    setPagoValor('')
    setPagoFecha(todayBogota())
    setPagoPartes([newPagoParte()])
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

  function updatePagoParte(id: string, patch: Partial<PagoParteForm>) {
    setPagoPartes((current) =>
      current.map((parte) => (parte.id === id ? { ...parte, ...patch } : parte)),
    )
  }

  function addPagoParte() {
    setPagoPartes((current) => [...current, newPagoParte()])
  }

  function removePagoParte(id: string) {
    setPagoPartes((current) => (current.length <= 1 ? current : current.filter((p) => p.id !== id)))
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

    const partesPayload: Array<{
      tipo: AvMetodoPagoTipo
      valor: number
      cuenta?: string
      detalle?: string
    }> = []

    for (const parte of pagoPartes) {
      const parteValor = Number(String(parte.valor).replace(/,/g, '').trim())
      if (!Number.isFinite(parteValor) || parteValor <= 0) {
        setPagoError('Cada método de pago debe tener un valor mayor a 0.')
        return
      }
      if (parte.tipo === 'cuenta_bancaria' && !parte.cuenta.trim()) {
        setPagoError('Indica la cuenta bancaria para esa parte del pago.')
        return
      }
      partesPayload.push({
        tipo: parte.tipo,
        valor: parteValor,
        cuenta: parte.tipo === 'cuenta_bancaria' ? parte.cuenta.trim() : undefined,
        detalle: parte.tipo === 'pasarela' ? parte.detalle.trim() || undefined : undefined,
      })
    }

    const sumaPartes = partesPayload.reduce((sum, parte) => sum + parte.valor, 0)
    if (Math.abs(sumaPartes - valor) > 0.0001) {
      setPagoError(
        `La suma de los métodos (${formatCop(sumaPartes)}) debe coincidir con el valor del pago (${formatCop(valor)}).`,
      )
      return
    }

    setPagoSubmitting(true)
    setPagoError('')
    try {
      const token = await user.getIdToken()
      const updated = await createAvFacturaPago(token, detalle.id, {
        valor,
        fecha,
        partes: partesPayload,
        referencia: pagoReferencia.trim() || undefined,
        notas: pagoNotas.trim() || undefined,
      })
      setDetalle(updated)
      setFacturas((current) => current.map((item) => (item.id === updated.id ? updated : item)))
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
      const updated = await deleteAvFacturaPago(token, detalle.id, pagoId)
      setDetalle(updated)
      setFacturas((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el pago')
    } finally {
      setDeletingPagoId('')
    }
  }

  function renderPagoModal() {
    if (!pagoModalOpen || !detalle) return null
    return (
      <div className="modal-overlay" role="presentation" onClick={closePagoModal}>
        <div
          className="modal-panel av-pago-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="av-fact-pago-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-header">
            <h2 id="av-fact-pago-modal-title">Registrar pago</h2>
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

            <label className="login-field" htmlFor="av-fact-pago-valor">
              Valor del pago (COP)
              <input
                id="av-fact-pago-valor"
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

            <label className="login-field" htmlFor="av-fact-pago-fecha">
              Fecha
              <input
                id="av-fact-pago-fecha"
                type="date"
                value={pagoFecha}
                onChange={(event) => setPagoFecha(event.target.value || todayBogota())}
                required
                disabled={pagoSubmitting}
              />
            </label>

            <section className="av-pago-partes">
              <div className="av-pago-partes-head">
                <h3>Cómo se recibió el pago</h3>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addPagoParte}
                  disabled={pagoSubmitting}
                >
                  <Plus size={14} strokeWidth={2} aria-hidden />
                  Dividir pago
                </button>
              </div>
              <p className="section-note">
                Puedes repartir el pago entre efectivo, cuentas bancarias y pasarela. La suma debe
                coincidir con el valor total.
              </p>

              {pagoPartes.map((parte, index) => (
                <div key={parte.id} className="av-pago-parte">
                  <div className="av-pago-parte-grid">
                    <label className="login-field" htmlFor={`av-fact-pago-tipo-${parte.id}`}>
                      Método {pagoPartes.length > 1 ? index + 1 : ''}
                      <select
                        id={`av-fact-pago-tipo-${parte.id}`}
                        value={parte.tipo}
                        onChange={(event) =>
                          updatePagoParte(parte.id, {
                            tipo: event.target.value as AvMetodoPagoTipo,
                          })
                        }
                        disabled={pagoSubmitting}
                      >
                        {(Object.keys(METODO_PAGO_LABEL) as AvMetodoPagoTipo[]).map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {METODO_PAGO_LABEL[tipo]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="login-field" htmlFor={`av-fact-pago-parte-valor-${parte.id}`}>
                      Valor
                      <input
                        id={`av-fact-pago-parte-valor-${parte.id}`}
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="1"
                        value={parte.valor}
                        onChange={(event) =>
                          updatePagoParte(parte.id, { valor: event.target.value })
                        }
                        placeholder="0"
                        required
                        disabled={pagoSubmitting}
                      />
                    </label>

                    {parte.tipo === 'cuenta_bancaria' ? (
                      <label
                        className="login-field av-ingresos-span-2"
                        htmlFor={`av-fact-pago-cuenta-${parte.id}`}
                      >
                        Cuenta bancaria
                        <input
                          id={`av-fact-pago-cuenta-${parte.id}`}
                          type="text"
                          value={parte.cuenta}
                          onChange={(event) =>
                            updatePagoParte(parte.id, { cuenta: event.target.value })
                          }
                          placeholder="Bancolombia, Nequi, Davivienda..."
                          required
                          disabled={pagoSubmitting}
                        />
                      </label>
                    ) : null}

                    {parte.tipo === 'pasarela' ? (
                      <label
                        className="login-field av-ingresos-span-2"
                        htmlFor={`av-fact-pago-pasarela-${parte.id}`}
                      >
                        Pasarela (opcional)
                        <input
                          id={`av-fact-pago-pasarela-${parte.id}`}
                          type="text"
                          value={parte.detalle}
                          onChange={(event) =>
                            updatePagoParte(parte.id, { detalle: event.target.value })
                          }
                          placeholder="Wompi, PayU, Mercado Pago..."
                          disabled={pagoSubmitting}
                        />
                      </label>
                    ) : null}
                  </div>

                  {pagoPartes.length > 1 ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => removePagoParte(parte.id)}
                      disabled={pagoSubmitting}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              ))}
            </section>

            <label className="login-field" htmlFor="av-fact-pago-ref">
              Referencia (opcional)
              <input
                id="av-fact-pago-ref"
                type="text"
                value={pagoReferencia}
                onChange={(event) => setPagoReferencia(event.target.value)}
                placeholder="N.º de comprobante"
                disabled={pagoSubmitting}
              />
            </label>

            <label className="login-field" htmlFor="av-fact-pago-notas">
              Notas (opcional)
              <input
                id="av-fact-pago-notas"
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
    )
  }

  if (vista === 'detalle' && detalle) {
    return (
      <div className="av-facturacion" role="tabpanel" aria-label="Detalle de factura">
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
              onClick={() => void handleDeleteFactura(detalle)}
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
              <p className="av-ingresos-kicker">Factura {detalle.numero || '—'}</p>
              <h3>{detalle.concepto || 'Sin concepto'}</h3>
              <p className="section-note">
                {detalle.cliente || '—'}
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
              <dd>{detalle.planNombre || '—'}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{ESTADO_LABEL[detalle.estado]}</dd>
            </div>
            <div>
              <dt>Emisión</dt>
              <dd>{formatYmd(detalle.fechaEmision)}</dd>
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
                      <td>{formatPagoPartes(pago.partes || [], pago.metodoPago)}</td>
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

        {renderPagoModal()}
      </div>
    )
  }

  return (
    <div className="av-facturacion" role="tabpanel" aria-label="Facturación">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Facturación</h3>
          <p className="section-note">Facturas de compra de créditos y registro de cobros.</p>
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
          <button type="button" className="btn-primary" onClick={() => void openNueva()}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Nueva factura
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

      <div className="av-ingresos-filters av-facturacion-filters">
        <label className="login-field" htmlFor="av-fact-filtro-cliente">
          Cliente
          <select
            id="av-fact-filtro-cliente"
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

        <label className="login-field" htmlFor="av-fact-filtro-estado">
          Estado
          <select
            id="av-fact-filtro-estado"
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

        <label className="login-field" htmlFor="av-fact-filtro-desde">
          Desde
          <input
            id="av-fact-filtro-desde"
            type="date"
            value={filtroDesde}
            max={filtroHasta || undefined}
            onChange={(event) => setFiltroDesde(event.target.value)}
          />
        </label>

        <label className="login-field" htmlFor="av-fact-filtro-hasta">
          Hasta
          <input
            id="av-fact-filtro-hasta"
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
          Cargando facturas...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && facturas.length === 0 ? (
        <div className="proyectos-empty">
          <Receipt size={28} strokeWidth={1.75} aria-hidden />
          <p>No hay facturas con estos filtros. Crea la primera para empezar.</p>
          <button type="button" className="btn-primary" onClick={() => void openNueva()}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Nueva factura
          </button>
        </div>
      ) : null}

      {!loading && !error && facturas.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>N.º</th>
                <th>Cliente</th>
                <th>Plan</th>
                <th>Créditos</th>
                <th>Valor</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {facturas.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button type="button" className="av-ingresos-link" onClick={() => openDetalle(item)}>
                      {item.numero || '—'}
                    </button>
                  </td>
                  <td>{item.cliente || '—'}</td>
                  <td>{item.planNombre || '—'}</td>
                  <td>{item.creditos ?? '—'}</td>
                  <td>{formatCop(item.valor)}</td>
                  <td>{formatCop(item.totalPagado)}</td>
                  <td>{formatCop(item.saldoPendiente)}</td>
                  <td>
                    <span className={`av-estado av-estado-${item.estado}`}>
                      {ESTADO_LABEL[item.estado]}
                    </span>
                  </td>
                  <td>
                    <div className="av-ingresos-row-actions">
                      <button type="button" className="btn-secondary" onClick={() => openDetalle(item)}>
                        Ver
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={deletingId === item.id}
                        aria-label="Eliminar factura"
                        onClick={() => void handleDeleteFactura(item)}
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

      {nuevaOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeNueva}>
          <div
            className="modal-panel av-factura-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-nueva-factura-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-nueva-factura-title">Nueva factura</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeNueva}
                disabled={nuevoSubmitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form className="modal-form" onSubmit={(event) => void handleCreateFactura(event)} noValidate>
              <p className="section-note">
                El número de factura se genera automáticamente (FAC-000001, FAC-000002…) y no se
                puede repetir.
              </p>

              <label className="login-field" htmlFor="av-fact-cliente">
                Cliente
                <select
                  id="av-fact-cliente"
                  value={nuevoClienteId}
                  onChange={(event) => setNuevoClienteId(event.target.value)}
                  required
                  disabled={nuevoSubmitting}
                  autoFocus
                >
                  <option value="">Selecciona un cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="login-field" htmlFor="av-fact-plan">
                Plan
                <select
                  id="av-fact-plan"
                  value={nuevoPlanId}
                  onChange={(event) => setNuevoPlanId(event.target.value)}
                  required
                  disabled={nuevoSubmitting}
                >
                  <option value="">Selecciona un plan</option>
                  {planesActivos.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.nombre} — {plan.creditos} créditos — {formatCop(plan.precio)}
                    </option>
                  ))}
                </select>
              </label>

              {planSeleccionado ? (
                <div className="av-fact-plan-preview" aria-live="polite">
                  <div>
                    <span>Precio</span>
                    <strong>{formatCop(planSeleccionado.precio)}</strong>
                  </div>
                  <div>
                    <span>Créditos</span>
                    <strong>{planSeleccionado.creditos}</strong>
                  </div>
                </div>
              ) : null}

              <label className="login-field" htmlFor="av-fact-emision">
                Fecha de emisión
                <input
                  id="av-fact-emision"
                  type="date"
                  value={nuevoEmision}
                  onChange={(event) => setNuevoEmision(event.target.value || todayBogota())}
                  required
                  disabled={nuevoSubmitting}
                />
              </label>

              <label className="login-field" htmlFor="av-fact-notas">
                Notas (opcional)
                <textarea
                  id="av-fact-notas"
                  value={nuevoNotas}
                  onChange={(event) => setNuevoNotas(event.target.value)}
                  rows={2}
                  disabled={nuevoSubmitting}
                  placeholder="Observaciones internas"
                />
              </label>

              {nuevoError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {nuevoError}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeNueva}
                  disabled={nuevoSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={nuevoSubmitting}>
                  {nuevoSubmitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : (
                    'Crear factura'
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
