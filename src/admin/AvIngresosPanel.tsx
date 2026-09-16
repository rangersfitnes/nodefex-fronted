import { useEffect, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvIngresoCaja,
  deleteAvIngresoCaja,
  listAvFacturas,
  listAvIngresosCaja,
  updateAvIngresoCaja,
  type AvIngresoCaja,
  type AvMetodoPagoTipo,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  X,
} from '../icons'

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

type ModalMode = 'crear' | 'editar'

export function AvIngresosPanel() {
  const { user } = useAuth()
  const [ingresos, setIngresos] = useState<AvIngresoCaja[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvIngresoCaja | null>(null)
  const [fecha, setFecha] = useState(() => todayBogota())
  const [concepto, setConcepto] = useState('')
  const [valor, setValor] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [partes, setPartes] = useState<PagoParteForm[]>(() => [newPagoParte()])
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [facturasNumeros, setFacturasNumeros] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvIngresosCaja(token)
        if (cancelled) return
        setIngresos(data.ingresos)
        setTotal(data.resumen.total)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los ingresos')
          setIngresos([])
          setTotal(0)
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
      if (!user || !modalOpen) return
      try {
        const token = await user.getIdToken()
        const data = await listAvFacturas(token)
        if (cancelled) return
        const numeros = data.facturas
          .map((item) => item.numero)
          .filter((n): n is string => Boolean(n))
        setFacturasNumeros([...new Set(numeros)])
      } catch {
        if (!cancelled) setFacturasNumeros([])
      }
    }

    void loadFacturas()
    return () => {
      cancelled = true
    }
  }, [user, modalOpen])

  function openCreate() {
    setModalMode('crear')
    setEditing(null)
    setFecha(todayBogota())
    setConcepto('')
    setValor('')
    setNumeroFactura('')
    setPartes([newPagoParte()])
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item: AvIngresoCaja) {
    setModalMode('editar')
    setEditing(item)
    setFecha(item.fecha || todayBogota())
    setConcepto(item.concepto || '')
    setValor(String(item.valor || ''))
    setNumeroFactura(item.numeroFactura || '')
    if (item.partes && item.partes.length > 0) {
      setPartes(
        item.partes.map((parte) =>
          newPagoParte({
            tipo: parte.tipo,
            valor: String(parte.valor),
            cuenta: parte.cuenta || '',
            detalle: parte.detalle || '',
          }),
        ),
      )
    } else {
      setPartes([newPagoParte({ valor: String(item.valor || '') })])
    }
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setFormError('')
  }

  function updateParte(id: string, patch: Partial<PagoParteForm>) {
    setPartes((current) =>
      current.map((parte) => (parte.id === id ? { ...parte, ...patch } : parte)),
    )
  }

  function addParte() {
    setPartes((current) => [...current, newPagoParte()])
  }

  function removeParte(id: string) {
    setPartes((current) => (current.length <= 1 ? current : current.filter((p) => p.id !== id)))
  }

  function setValorAndSync(nextValor: string) {
    setValor(nextValor)
    setPartes((current) => {
      if (current.length !== 1) return current
      return [{ ...current[0], valor: nextValor }]
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const conceptoValue = concepto.trim()
    const valorValue = Number(String(valor).replace(/,/g, '').trim())
    const fechaValue = fecha || todayBogota()

    if (!conceptoValue) {
      setFormError('El concepto es obligatorio.')
      return
    }
    if (!Number.isFinite(valorValue) || valorValue <= 0) {
      setFormError('El valor debe ser un número mayor a 0.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaValue)) {
      setFormError('La fecha no es válida.')
      return
    }

    const partesPayload: Array<{
      tipo: AvMetodoPagoTipo
      valor: number
      cuenta?: string
      detalle?: string
    }> = []

    for (const parte of partes) {
      const parteValor = Number(String(parte.valor).replace(/,/g, '').trim())
      if (!Number.isFinite(parteValor) || parteValor <= 0) {
        setFormError('Cada método de pago debe tener un valor mayor a 0.')
        return
      }
      if (parte.tipo === 'cuenta_bancaria' && !parte.cuenta.trim()) {
        setFormError('Indica la cuenta bancaria para esa parte del pago.')
        return
      }
      partesPayload.push({
        tipo: parte.tipo,
        valor: parteValor,
        cuenta: parte.tipo === 'cuenta_bancaria' ? parte.cuenta.trim() : undefined,
        detalle: parte.tipo === 'pasarela' ? parte.detalle.trim() || undefined : undefined,
      })
    }

    if (partesPayload.length === 0) {
      setFormError('El método de pago es obligatorio.')
      return
    }

    const sumaPartes = partesPayload.reduce((sum, parte) => sum + parte.valor, 0)
    if (Math.abs(sumaPartes - valorValue) > 0.0001) {
      setFormError(
        `La suma de los métodos (${formatCop(sumaPartes)}) debe coincidir con el valor (${formatCop(valorValue)}).`,
      )
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      const payload = {
        fecha: fechaValue,
        concepto: conceptoValue,
        valor: valorValue,
        numeroFactura: numeroFactura.trim() || undefined,
        partes: partesPayload,
      }

      if (modalMode === 'crear') {
        await createAvIngresoCaja(token, payload)
      } else if (editing) {
        await updateAvIngresoCaja(token, editing.id, {
          ...payload,
          numeroFactura: numeroFactura.trim() || null,
        })
      }
      setModalOpen(false)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el ingreso')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item: AvIngresoCaja) {
    if (!user) return
    const ok = window.confirm(
      `¿Eliminar el ingreso "${item.concepto || item.id}" de ${formatCop(item.valor)}?`,
    )
    if (!ok) return
    setDeletingId(item.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvIngresoCaja(token, item.id)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el ingreso')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="av-ingresos" role="tabpanel" aria-label="Ingresos">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Ingresos</h3>
          <p className="section-note">Registro simple de ingresos en caja de Nodefex Audio Visual.</p>
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
            Nuevo ingreso
          </button>
        </div>
      </div>

      <div className="contable-summary">
        <div>
          <span>Total ingresos</span>
          <strong>{formatCop(total)}</strong>
        </div>
        <div>
          <span>Movimientos</span>
          <strong>{ingresos.length}</strong>
        </div>
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
          <p>Aún no hay ingresos. Registra el primero para ver el historial.</p>
          <button type="button" className="btn-primary" onClick={openCreate}>
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
                <th>Fecha</th>
                <th>Concepto</th>
                <th>N.º factura</th>
                <th>Método</th>
                <th>Valor</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {ingresos.map((item) => (
                <tr key={item.id}>
                  <td>{formatYmd(item.fecha)}</td>
                  <td>{item.concepto || '—'}</td>
                  <td>{item.numeroFactura || '—'}</td>
                  <td>{formatPagoPartes(item.partes || [], item.metodoPago)}</td>
                  <td>{formatCop(item.valor)}</td>
                  <td>
                    <div className="av-ingresos-row-actions">
                      <button type="button" className="btn-secondary" onClick={() => openEdit(item)}>
                        <Pencil size={14} strokeWidth={2} aria-hidden />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={deletingId === item.id}
                        aria-label="Eliminar ingreso"
                        onClick={() => void handleDelete(item)}
                      >
                        {deletingId === item.id ? (
                          <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                        ) : (
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                        )}
                        Eliminar
                      </button>
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
            className="modal-panel av-pago-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-ingreso-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-ingreso-modal-title">
                {modalMode === 'crear' ? 'Nuevo ingreso' : 'Editar ingreso'}
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
              <label className="login-field" htmlFor="av-ing-fecha">
                Fecha
                <input
                  id="av-ing-fecha"
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value || todayBogota())}
                  required
                  disabled={submitting}
                />
              </label>

              <label className="login-field" htmlFor="av-ing-concepto">
                Concepto
                <input
                  id="av-ing-concepto"
                  type="text"
                  value={concepto}
                  onChange={(event) => setConcepto(event.target.value)}
                  placeholder="Aporte, reembolso, cobro..."
                  required
                  disabled={submitting}
                  autoFocus
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
                  value={valor}
                  onChange={(event) => setValorAndSync(event.target.value)}
                  placeholder="100000"
                  required
                  disabled={submitting}
                />
              </label>

              <label className="login-field" htmlFor="av-ing-num-factura">
                Nº factura (si es compra de créditos)
                <select
                  id="av-ing-num-factura"
                  value={numeroFactura}
                  onChange={(event) => setNumeroFactura(event.target.value)}
                  disabled={submitting}
                >
                  <option value="">Sin factura</option>
                  {numeroFactura && !facturasNumeros.includes(numeroFactura) ? (
                    <option value={numeroFactura}>{numeroFactura}</option>
                  ) : null}
                  {facturasNumeros.map((numero) => (
                    <option key={numero} value={numero}>
                      {numero}
                    </option>
                  ))}
                </select>
              </label>

              <section className="av-pago-partes">
                <div className="av-pago-partes-head">
                  <h3>Método de pago</h3>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={addParte}
                    disabled={submitting}
                  >
                    <Plus size={14} strokeWidth={2} aria-hidden />
                    Dividir pago
                  </button>
                </div>
                <p className="section-note">
                  Obligatorio. Efectivo, cuenta bancaria o pasarela. Si divides, la suma debe
                  coincidir con el valor.
                </p>

                {partes.map((parte, index) => (
                  <div key={parte.id} className="av-pago-parte">
                    <div className="av-pago-parte-grid">
                      <label className="login-field" htmlFor={`av-ing-tipo-${parte.id}`}>
                        Método {partes.length > 1 ? index + 1 : ''}
                        <select
                          id={`av-ing-tipo-${parte.id}`}
                          value={parte.tipo}
                          onChange={(event) =>
                            updateParte(parte.id, {
                              tipo: event.target.value as AvMetodoPagoTipo,
                            })
                          }
                          disabled={submitting}
                        >
                          {(Object.keys(METODO_PAGO_LABEL) as AvMetodoPagoTipo[]).map((tipo) => (
                            <option key={tipo} value={tipo}>
                              {METODO_PAGO_LABEL[tipo]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="login-field" htmlFor={`av-ing-parte-valor-${parte.id}`}>
                        Valor
                        <input
                          id={`av-ing-parte-valor-${parte.id}`}
                          type="number"
                          inputMode="decimal"
                          min="1"
                          step="1"
                          value={parte.valor}
                          onChange={(event) =>
                            updateParte(parte.id, { valor: event.target.value })
                          }
                          placeholder="0"
                          required
                          disabled={submitting}
                        />
                      </label>

                      {parte.tipo === 'cuenta_bancaria' ? (
                        <label
                          className="login-field av-ingresos-span-2"
                          htmlFor={`av-ing-cuenta-${parte.id}`}
                        >
                          Cuenta bancaria
                          <input
                            id={`av-ing-cuenta-${parte.id}`}
                            type="text"
                            value={parte.cuenta}
                            onChange={(event) =>
                              updateParte(parte.id, { cuenta: event.target.value })
                            }
                            placeholder="Bancolombia, Nequi, Davivienda..."
                            required
                            disabled={submitting}
                          />
                        </label>
                      ) : null}

                      {parte.tipo === 'pasarela' ? (
                        <label
                          className="login-field av-ingresos-span-2"
                          htmlFor={`av-ing-pasarela-${parte.id}`}
                        >
                          Pasarela (opcional)
                          <input
                            id={`av-ing-pasarela-${parte.id}`}
                            type="text"
                            value={parte.detalle}
                            onChange={(event) =>
                              updateParte(parte.id, { detalle: event.target.value })
                            }
                            placeholder="Wompi, PayU, Mercado Pago..."
                            disabled={submitting}
                          />
                        </label>
                      ) : null}
                    </div>

                    {partes.length > 1 ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => removeParte(parte.id)}
                        disabled={submitting}
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                ))}
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
                  ) : modalMode === 'crear' ? (
                    'Guardar ingreso'
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
