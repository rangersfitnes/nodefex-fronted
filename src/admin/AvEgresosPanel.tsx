import { useEffect, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvEgreso,
  deleteAvEgreso,
  getAvFinanzasResumen,
  listAvEgresos,
  updateAvEgreso,
  type AvEgreso,
  type AvFinanzasResumen,
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
  cuenta_bancaria: 'Transferencia / cuenta',
  pasarela: 'Pasarela (Wompi)',
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

const EMPTY_RESUMEN: AvFinanzasResumen = {
  ingresosTotales: 0,
  egresosTotales: 0,
  disponible: 0,
  cantidadIngresos: 0,
  cantidadEgresos: 0,
  porMetodo: [],
}

export function AvEgresosPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [egresos, setEgresos] = useState<AvEgreso[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')
  const [presupuesto, setPresupuesto] = useState<AvFinanzasResumen>(EMPTY_RESUMEN)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvEgreso | null>(null)
  const [fecha, setFecha] = useState(() => todayBogota())
  const [concepto, setConcepto] = useState('')
  const [valor, setValor] = useState('')
  const [partes, setPartes] = useState<PagoParteForm[]>([newPagoParte()])
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
        const [data, resumen] = await Promise.all([
          listAvEgresos(token),
          getAvFinanzasResumen(token).catch(() => EMPTY_RESUMEN),
        ])
        if (cancelled) return
        setEgresos(data.egresos)
        setTotal(data.resumen.total)
        setPresupuesto(resumen)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los egresos')
          setEgresos([])
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

  function openCreate() {
    setModalMode('crear')
    setEditing(null)
    setFecha(todayBogota())
    setConcepto('')
    setValor('')
    setPartes([newPagoParte()])
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item: AvEgreso) {
    setModalMode('editar')
    setEditing(item)
    setFecha(item.fecha || todayBogota())
    setConcepto(item.concepto || '')
    setValor(String(item.valor || ''))
    setPartes(
      item.partes?.length
        ? item.partes.map((parte) =>
            newPagoParte({
              tipo: parte.tipo,
              valor: String(parte.valor || ''),
              cuenta: parte.cuenta || '',
              detalle: parte.detalle || '',
            }),
          )
        : [newPagoParte({ valor: String(item.valor || '') })],
    )
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setFormError('')
  }

  function updateParte(id: string, patch: Partial<PagoParteForm>) {
    setPartes((current) => current.map((parte) => (parte.id === id ? { ...parte, ...patch } : parte)))
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
        setFormError('Cada almacenamiento debe tener un valor mayor a 0.')
        return
      }
      if (parte.tipo === 'cuenta_bancaria' && !parte.cuenta.trim()) {
        setFormError('Indica la cuenta / transferencia para esa parte.')
        return
      }
      partesPayload.push({
        tipo: parte.tipo,
        valor: parteValor,
        cuenta: parte.tipo === 'cuenta_bancaria' ? parte.cuenta.trim() : undefined,
        detalle: parte.tipo === 'pasarela' ? parte.detalle.trim() || 'Wompi' : undefined,
      })
    }

    if (!partesPayload.length) {
      setFormError('Indica de qué almacenamientos sale el presupuesto.')
      return
    }

    const sumaPartes = partesPayload.reduce((sum, parte) => sum + parte.valor, 0)
    if (Math.abs(sumaPartes - valorValue) > 0.0001) {
      setFormError(
        `La suma de los almacenamientos (${formatCop(sumaPartes)}) debe coincidir con el valor (${formatCop(valorValue)}).`,
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
        partes: partesPayload,
      }

      if (modalMode === 'crear') {
        await createAvEgreso(token, payload)
      } else if (editing) {
        await updateAvEgreso(token, editing.id, payload)
      }
      setModalOpen(false)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el egreso')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item: AvEgreso) {
    if (!user) return
    const ok = window.confirm(
      `¿Eliminar el egreso "${item.concepto || item.id}" de ${formatCop(item.valor)}?`,
    )
    if (!ok) return
    setDeletingId(item.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvEgreso(token, item.id)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el egreso')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="av-egresos" role="tabpanel" aria-label="Egresos">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Egresos</h3>
          <p className="section-note">
            Registra egresos descontando presupuesto de efectivo, transferencia o pasarela.
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
              Nuevo egreso
            </button>
          ) : null}
        </div>
      </div>

      <div className="contable-summary">
        <div>
          <span>Total egresos</span>
          <strong>{formatCop(total)}</strong>
        </div>
        <div>
          <span>Movimientos</span>
          <strong>{egresos.length}</strong>
        </div>
      </div>

      {!loading && (presupuesto.porMetodo || []).length > 0 ? (
        <ul className="liquidar-presupuesto-saldos av-egresos-saldos">
          {(presupuesto.porMetodo || []).map((item) => (
            <li key={item.tipo}>
              <span>{item.label}</span>
              <strong>{formatCop(item.disponible)}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando egresos...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && egresos.length === 0 ? (
        <div className="proyectos-empty">
          <Receipt size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay egresos. Registra el primero para ver el historial.</p>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nuevo egreso
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && egresos.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Presupuesto</th>
                <th>Valor</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {egresos.map((item) => (
                <tr key={item.id}>
                  <td>{formatYmd(item.fecha)}</td>
                  <td>{item.concepto || '—'}</td>
                  <td>{formatPagoPartes(item.partes || [], item.metodoPago)}</td>
                  <td>{formatCop(item.valor)}</td>
                  <td>
                    {!readOnly ? (
                      <div className="av-ingresos-row-actions">
                        <button type="button" className="btn-secondary" onClick={() => openEdit(item)}>
                          <Pencil size={14} strokeWidth={2} aria-hidden />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={deletingId === item.id}
                          aria-label="Eliminar egreso"
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
            aria-labelledby="av-egreso-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-egreso-modal-title">
                {modalMode === 'crear' ? 'Nuevo egreso' : 'Editar egreso'}
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
              <label className="login-field" htmlFor="av-egreso-fecha">
                Fecha
                <input
                  id="av-egreso-fecha"
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value || todayBogota())}
                  required
                  disabled={submitting}
                />
              </label>

              <label className="login-field" htmlFor="av-egreso-concepto">
                Concepto
                <input
                  id="av-egreso-concepto"
                  type="text"
                  value={concepto}
                  onChange={(event) => setConcepto(event.target.value)}
                  placeholder="Nómina, proveedor, arriendo..."
                  required
                  disabled={submitting}
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="av-egreso-valor">
                Valor (COP)
                <input
                  id="av-egreso-valor"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={valor}
                  onChange={(event) => setValor(event.target.value)}
                  placeholder="100000"
                  required
                  disabled={submitting}
                />
              </label>

              <section className="av-pago-partes">
                <div className="av-pago-partes-head">
                  <h3>Sale de presupuesto</h3>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setPartes((current) => [...current, newPagoParte()])}
                    disabled={submitting}
                  >
                    <Plus size={14} strokeWidth={2} aria-hidden />
                    Dividir
                  </button>
                </div>
                <p className="section-note">
                  Elige efectivo, transferencia o pasarela. La suma debe coincidir con el valor y no
                  puede superar el disponible de cada almacenamiento.
                </p>
                <ul className="liquidar-presupuesto-saldos">
                  {(presupuesto.porMetodo || []).map((item) => (
                    <li key={item.tipo}>
                      <span>{item.label}</span>
                      <strong>{formatCop(item.disponible)}</strong>
                    </li>
                  ))}
                </ul>

                {partes.map((parte, index) => (
                  <div key={parte.id} className="av-pago-parte">
                    <div className="av-pago-parte-grid">
                      <label className="login-field" htmlFor={`av-eg-tipo-${parte.id}`}>
                        Almacenamiento {partes.length > 1 ? index + 1 : ''}
                        <select
                          id={`av-eg-tipo-${parte.id}`}
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
                      <label className="login-field" htmlFor={`av-eg-parte-valor-${parte.id}`}>
                        Valor
                        <input
                          id={`av-eg-parte-valor-${parte.id}`}
                          type="number"
                          inputMode="decimal"
                          min="1"
                          step="1"
                          value={parte.valor}
                          onChange={(event) => updateParte(parte.id, { valor: event.target.value })}
                          required
                          disabled={submitting}
                        />
                      </label>
                      {parte.tipo === 'cuenta_bancaria' ? (
                        <label
                          className="login-field av-ingresos-span-2"
                          htmlFor={`av-eg-cuenta-${parte.id}`}
                        >
                          Cuenta / transferencia
                          <input
                            id={`av-eg-cuenta-${parte.id}`}
                            type="text"
                            value={parte.cuenta}
                            onChange={(event) =>
                              updateParte(parte.id, { cuenta: event.target.value })
                            }
                            disabled={submitting}
                          />
                        </label>
                      ) : null}
                      {parte.tipo === 'pasarela' ? (
                        <label
                          className="login-field av-ingresos-span-2"
                          htmlFor={`av-eg-pasarela-${parte.id}`}
                        >
                          Pasarela
                          <input
                            id={`av-eg-pasarela-${parte.id}`}
                            type="text"
                            value={parte.detalle}
                            onChange={(event) =>
                              updateParte(parte.id, { detalle: event.target.value })
                            }
                            placeholder="Wompi"
                            disabled={submitting}
                          />
                        </label>
                      ) : null}
                    </div>
                    {partes.length > 1 ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setPartes((current) => current.filter((item) => item.id !== parte.id))
                        }
                        disabled={submitting}
                        aria-label="Quitar parte"
                      >
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
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
                    'Guardar egreso'
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
