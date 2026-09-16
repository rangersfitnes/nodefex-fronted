import { useEffect, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvEgreso,
  deleteAvEgreso,
  listAvEgresos,
  updateAvEgreso,
  type AvEgreso,
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

export function AvEgresosPanel() {
  const { user } = useAuth()
  const [egresos, setEgresos] = useState<AvEgreso[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvEgreso | null>(null)
  const [fecha, setFecha] = useState(() => todayBogota())
  const [concepto, setConcepto] = useState('')
  const [valor, setValor] = useState('')
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
        const data = await listAvEgresos(token)
        if (cancelled) return
        setEgresos(data.egresos)
        setTotal(data.resumen.total)
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
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item: AvEgreso) {
    setModalMode('editar')
    setEditing(item)
    setFecha(item.fecha || todayBogota())
    setConcepto(item.concepto || '')
    setValor(String(item.valor || ''))
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

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      if (modalMode === 'crear') {
        await createAvEgreso(token, {
          fecha: fechaValue,
          concepto: conceptoValue,
          valor: valorValue,
        })
      } else if (editing) {
        await updateAvEgreso(token, editing.id, {
          fecha: fechaValue,
          concepto: conceptoValue,
          valor: valorValue,
        })
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
          <p className="section-note">Registra y administra los egresos de Nodefex Audio Visual.</p>
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
            Nuevo egreso
          </button>
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
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Nuevo egreso
          </button>
        </div>
      ) : null}

      {!loading && !error && egresos.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Valor</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {egresos.map((item) => (
                <tr key={item.id}>
                  <td>{formatYmd(item.fecha)}</td>
                  <td>{item.concepto || '—'}</td>
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
            className="modal-panel"
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
                  placeholder="Pago proveedor, arriendo, insumos..."
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
