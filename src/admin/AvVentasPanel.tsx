import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvVenta,
  deleteAvVenta,
  listAvClientes,
  listAvCotizaciones,
  listAvCrmVendedores,
  listAvVentas,
  type AvCliente,
  type AvCotizacion,
  type AvCrmVendedor,
  type AvVenta,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  LoaderCircle,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  X,
} from '../icons'

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function clienteLabel(cliente: AvCliente): string {
  const parts = [
    cliente.nombre || 'Sin nombre',
    cliente.documento ? `Doc. ${cliente.documento}` : null,
    cliente.telefono || null,
  ].filter(Boolean)
  return parts.join(' · ')
}

function cotizacionLabel(cotizacion: AvCotizacion): string {
  return `${cotizacion.numero || cotizacion.id} · ${cotizacion.clienteNombre || 'Cliente'} · ${formatCop(cotizacion.subtotal)}`
}

function vendedorLabel(vendedor: AvCrmVendedor): string {
  const rol = vendedor.rol === 'vendedor' ? 'Vendedor' : 'Admin'
  return `${vendedor.nombre || 'Sin nombre'} · C.C. ${vendedor.cedula || '—'} · ${rol}`
}

function metodoPagoVentaLabel(
  tipo: AvVenta['metodoPagoTipo'],
  cuenta: string | null,
  fallback: string | null,
): string {
  if (tipo === 'efectivo') return 'Efectivo'
  if (tipo === 'cuenta_bancaria') {
    return cuenta ? `Transferencia · ${cuenta}` : 'Transferencia a cuenta bancaria'
  }
  return fallback || '—'
}

export function AvVentasPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user, administrador } = useAuth()
  const [ventas, setVentas] = useState<AvVenta[]>([])
  const [clientes, setClientes] = useState<AvCliente[]>([])
  const [cotizaciones, setCotizaciones] = useState<AvCotizacion[]>([])
  const [vendedores, setVendedores] = useState<AvCrmVendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [cotizacionId, setCotizacionId] = useState('')
  const [vendedorUid, setVendedorUid] = useState('')
  const [metodoPagoTipo, setMetodoPagoTipo] = useState<'efectivo' | 'cuenta_bancaria' | ''>('')
  const [metodoPagoCuenta, setMetodoPagoCuenta] = useState('')
  const [notas, setNotas] = useState('')
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
        const [ventasData, clientesData, cotizacionesData, vendedoresData] = await Promise.all([
          listAvVentas(token),
          listAvClientes(token),
          listAvCotizaciones(token),
          listAvCrmVendedores(token).catch(() => [] as AvCrmVendedor[]),
        ])
        if (cancelled) return
        setVentas(ventasData)
        setClientes(clientesData)
        setCotizaciones(cotizacionesData)
        setVendedores(
          vendedoresData.filter(
            (item) =>
              (item.rol === 'vendedor' || item.rol === 'admin') &&
              Boolean(item.nombre) &&
              Boolean(item.cedula),
          ),
        )
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las ventas')
          setVentas([])
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

  const clienteSeleccionado = useMemo(
    () => clientes.find((item) => item.id === clienteId) || null,
    [clientes, clienteId],
  )

  const cotizacionesFiltradas = useMemo(() => {
    if (!clienteSeleccionado) return cotizaciones
    const doc = String(clienteSeleccionado.documento || '').replace(/\D/g, '')
    const nombre = String(clienteSeleccionado.nombre || '').trim().toLowerCase()
    return cotizaciones.filter((item) => {
      if (item.clienteId && item.clienteId === clienteSeleccionado.id) return true
      // Compat: cotizaciones antiguas sin clienteId
      if (item.clienteId) return false
      const itemDoc = String(item.clienteDocumento || '').replace(/\D/g, '')
      const itemNombre = String(item.clienteNombre || '').trim().toLowerCase()
      if (doc && itemDoc && doc === itemDoc) return true
      if (nombre && itemNombre && itemNombre === nombre) return true
      return false
    })
  }, [cotizaciones, clienteSeleccionado])

  const cotizacionSeleccionada = useMemo(
    () => cotizaciones.find((item) => item.id === cotizacionId) || null,
    [cotizaciones, cotizacionId],
  )

  const vendedorSeleccionado = useMemo(
    () => vendedores.find((item) => item.uid === vendedorUid) || null,
    [vendedores, vendedorUid],
  )

  function openCreate() {
    setClienteId('')
    setCotizacionId('')
    setVendedorUid(
      administrador?.uid &&
        (administrador.rol === 'admin' || administrador.rol === 'vendedor') &&
        administrador.nombre &&
        administrador.cedula
        ? administrador.uid
        : '',
    )
    setMetodoPagoTipo('')
    setMetodoPagoCuenta('')
    setNotas('')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setFormError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || submitting) return

    if (!clienteId) {
      setFormError('Selecciona un cliente.')
      return
    }
    if (!cotizacionId) {
      setFormError('Selecciona una cotización.')
      return
    }
    if (!vendedorUid) {
      setFormError('Selecciona el vendedor por número de cédula.')
      return
    }
    if (!vendedorSeleccionado?.cedula) {
      setFormError('El vendedor debe tener cédula registrada.')
      return
    }
    if (metodoPagoTipo !== 'efectivo' && metodoPagoTipo !== 'cuenta_bancaria') {
      setFormError('Indica si el pago fue en efectivo o por transferencia.')
      return
    }
    if (metodoPagoTipo === 'cuenta_bancaria' && !metodoPagoCuenta.trim()) {
      setFormError('Indica la cuenta bancaria de la transferencia.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      const created = await createAvVenta(token, {
        clienteId,
        cotizacionId,
        vendedorUid,
        metodoPagoTipo,
        metodoPagoCuenta:
          metodoPagoTipo === 'cuenta_bancaria' ? metodoPagoCuenta.trim() : undefined,
        notas: notas.trim() || undefined,
      })
      setVentas((current) => [created, ...current])
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la venta')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(venta: AvVenta) {
    if (!user || readOnly || deletingId) return
    const ok = window.confirm(
      `¿Eliminar la venta ${venta.cotizacionNumero || ''} de «${venta.clienteNombre || 'cliente'}»?`,
    )
    if (!ok) return
    setDeletingId(venta.id)
    try {
      const token = await user.getIdToken()
      await deleteAvVenta(token, venta.id)
      setVentas((current) => current.filter((item) => item.id !== venta.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la venta')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="av-ventas" role="tabpanel" aria-label="Ventas">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Ventas</h3>
          <p className="section-note">
            Registra ventas ligando cliente, cotización, vendedor y forma de pago. El valor se suma
            automáticamente a Finanzas → Ingresos.
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
              Nueva venta
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando ventas...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && ventas.length === 0 ? (
        <div className="proyectos-empty">
          <Receipt size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay ventas registradas.</p>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nueva venta
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && ventas.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Cotización</th>
                <th>Vendedor</th>
                <th>Pago</th>
                <th>Valor</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {ventas.map((venta) => (
                <tr key={venta.id}>
                  <td>{formatFecha(venta.creadoEn)}</td>
                  <td>
                    <strong>{venta.clienteNombre || '—'}</strong>
                    {venta.clienteDocumento ? (
                      <div className="section-note">Doc. {venta.clienteDocumento}</div>
                    ) : null}
                  </td>
                  <td>{venta.cotizacionNumero || '—'}</td>
                  <td>
                    <strong>{venta.vendedorNombre || '—'}</strong>
                    <div className="section-note">C.C. {venta.vendedorCedula || '—'}</div>
                  </td>
                  <td>
                    {metodoPagoVentaLabel(
                      venta.metodoPagoTipo,
                      venta.metodoPagoCuenta,
                      venta.metodoPago,
                    )}
                  </td>
                  <td>{formatCop(venta.cotizacionSubtotal)}</td>
                  <td>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={deletingId === venta.id}
                        onClick={() => void handleDelete(venta)}
                      >
                        {deletingId === venta.id ? (
                          <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                        ) : (
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                        )}
                        Eliminar
                      </button>
                    ) : null}
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
            className="modal-panel modal-panel-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-venta-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-venta-modal-title">Nueva venta</h2>
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
              <label className="login-field" htmlFor="av-venta-cliente">
                Cliente
                <select
                  id="av-venta-cliente"
                  value={clienteId}
                  onChange={(event) => {
                    setClienteId(event.target.value)
                    setCotizacionId('')
                  }}
                  required
                  disabled={submitting || clientes.length === 0}
                >
                  <option value="">Selecciona un cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {clienteLabel(cliente)}
                    </option>
                  ))}
                </select>
              </label>

              {clienteSeleccionado ? (
                <div className="av-venta-cliente-info" aria-live="polite">
                  <p>
                    <strong>{clienteSeleccionado.nombre}</strong>
                  </p>
                  <p className="section-note">
                    {[
                      clienteSeleccionado.documento
                        ? `Documento ${clienteSeleccionado.documento}`
                        : null,
                      clienteSeleccionado.telefono,
                      clienteSeleccionado.correo,
                      clienteSeleccionado.ciudad,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ) : null}

              <label className="login-field" htmlFor="av-venta-cotizacion">
                Cotización
                <select
                  id="av-venta-cotizacion"
                  value={cotizacionId}
                  onChange={(event) => setCotizacionId(event.target.value)}
                  required
                  disabled={submitting || !clienteId || cotizacionesFiltradas.length === 0}
                >
                  <option value="">
                    {!clienteId
                      ? 'Primero selecciona un cliente'
                      : cotizacionesFiltradas.length === 0
                        ? 'No hay cotizaciones para este cliente'
                        : 'Selecciona una cotización'}
                  </option>
                  {cotizacionesFiltradas.map((cotizacion) => (
                    <option key={cotizacion.id} value={cotizacion.id}>
                      {cotizacionLabel(cotizacion)}
                    </option>
                  ))}
                </select>
              </label>

              {cotizacionSeleccionada ? (
                <p className="section-note">
                  Subtotal {formatCop(cotizacionSeleccionada.subtotal)}
                  {cotizacionSeleccionada.resumen
                    ? ` · ${cotizacionSeleccionada.resumen.slice(0, 160)}`
                    : ''}
                </p>
              ) : null}

              <label className="login-field" htmlFor="av-venta-vendedor">
                Vendedor (C.C.)
                <select
                  id="av-venta-vendedor"
                  value={vendedorUid}
                  onChange={(event) => setVendedorUid(event.target.value)}
                  required
                  disabled={submitting || vendedores.length === 0}
                >
                  <option value="">
                    {vendedores.length === 0
                      ? 'No hay vendedores/admins con nombre y cédula'
                      : 'Selecciona por cédula'}
                  </option>
                  {vendedores.map((vendedor) => (
                    <option key={vendedor.uid} value={vendedor.uid}>
                      {vendedorLabel(vendedor)}
                    </option>
                  ))}
                </select>
              </label>

              {vendedorSeleccionado ? (
                <p className="section-note">
                  Responsable: {vendedorSeleccionado.nombre} · C.C.{' '}
                  {vendedorSeleccionado.cedula}
                </p>
              ) : null}

              <fieldset className="av-venta-pago-fieldset">
                <legend>Forma de pago</legend>
                <p className="section-note">
                  El valor de la cotización se registrará como ingreso en Finanzas según este método.
                </p>
                <div className="av-venta-pago-options" role="radiogroup" aria-label="Forma de pago">
                  <label className="av-venta-pago-option">
                    <input
                      type="radio"
                      name="av-venta-metodo"
                      value="efectivo"
                      checked={metodoPagoTipo === 'efectivo'}
                      onChange={() => {
                        setMetodoPagoTipo('efectivo')
                        setMetodoPagoCuenta('')
                      }}
                      disabled={submitting}
                    />
                    Efectivo
                  </label>
                  <label className="av-venta-pago-option">
                    <input
                      type="radio"
                      name="av-venta-metodo"
                      value="cuenta_bancaria"
                      checked={metodoPagoTipo === 'cuenta_bancaria'}
                      onChange={() => setMetodoPagoTipo('cuenta_bancaria')}
                      disabled={submitting}
                    />
                    Transferencia a cuenta bancaria
                  </label>
                </div>
                {metodoPagoTipo === 'cuenta_bancaria' ? (
                  <label className="login-field" htmlFor="av-venta-cuenta">
                    Cuenta bancaria
                    <input
                      id="av-venta-cuenta"
                      value={metodoPagoCuenta}
                      onChange={(event) => setMetodoPagoCuenta(event.target.value)}
                      disabled={submitting}
                      placeholder="Ej. Bancolombia ahorros ****1234"
                      required
                    />
                  </label>
                ) : null}
              </fieldset>

              <label className="login-field" htmlFor="av-venta-notas">
                Notas (opcional)
                <textarea
                  id="av-venta-notas"
                  value={notas}
                  onChange={(event) => setNotas(event.target.value)}
                  rows={3}
                  disabled={submitting}
                  placeholder="Observaciones de la venta"
                />
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
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : (
                    'Guardar venta'
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
