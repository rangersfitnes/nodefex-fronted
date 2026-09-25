import { useEffect, useState, type FormEvent } from 'react'
import {
  createAvServicioCredito,
  deleteAvServicioCredito,
  listAvServiciosCreditos,
  updateAvServicioCredito,
  type AvServicioCredito,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Coins,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from '../icons'

type ModalMode = 'crear' | 'editar'

export function AvCreditosPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [servicios, setServicios] = useState<AvServicioCredito[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvServicioCredito | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [creditos, setCreditos] = useState('')
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
        const data = await listAvServiciosCreditos(token)
        if (!cancelled) setServicios(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los servicios')
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
    setCreditos('')
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(servicio: AvServicioCredito) {
    setModalMode('editar')
    setEditing(servicio)
    setNombre(servicio.nombre || '')
    setDescripcion(servicio.descripcion || '')
    setCreditos(String(servicio.creditos || ''))
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

    const nombreValue = nombre.trim()
    const descripcionValue = descripcion.trim()
    const creditosValue = Number(String(creditos).trim())

    if (!nombreValue) {
      setFormError('El nombre del servicio es obligatorio.')
      return
    }
    if (!descripcionValue) {
      setFormError('La descripción es obligatoria.')
      return
    }
    if (!Number.isInteger(creditosValue) || creditosValue <= 0) {
      setFormError('Los créditos deben ser un entero mayor a 0.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      if (modalMode === 'crear') {
        const created = await createAvServicioCredito(token, {
          nombre: nombreValue,
          descripcion: descripcionValue,
          creditos: creditosValue,
        })
        setServicios((current) => [created, ...current])
      } else if (editing) {
        const updated = await updateAvServicioCredito(token, editing.id, {
          nombre: nombreValue,
          descripcion: descripcionValue,
          creditos: creditosValue,
        })
        setServicios((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      }
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el servicio')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(servicio: AvServicioCredito) {
    if (!user || readOnly || deletingId) return
    const ok = window.confirm(
      `¿Eliminar el servicio «${servicio.nombre || 'sin nombre'}» (ref ${servicio.referencia || '—'})?`,
    )
    if (!ok) return

    setDeletingId(servicio.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvServicioCredito(token, servicio.id)
      setServicios((current) => current.filter((item) => item.id !== servicio.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el servicio')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="av-creditos" role="tabpanel" aria-label="Créditos">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Créditos</h3>
          <p className="section-note">
            Define servicios y cuántos créditos consume cada uno. Al crear un servicio se genera una
            referencia de 4 dígitos única.
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
              Nuevo servicio
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando servicios...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && servicios.length === 0 ? (
        <div className="proyectos-empty">
          <Coins size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay servicios de créditos. Crea el primero para asignar consumos.</p>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nuevo servicio
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && servicios.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Servicio</th>
                <th>Descripción</th>
                <th>Créditos</th>
                {!readOnly ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {servicios.map((servicio) => (
                <tr key={servicio.id}>
                  <td>
                    <span className="av-credito-ref">{servicio.referencia || '—'}</span>
                  </td>
                  <td>{servicio.nombre || '—'}</td>
                  <td>{servicio.descripcion || '—'}</td>
                  <td>{servicio.creditos}</td>
                  {!readOnly ? (
                    <td>
                      <div className="av-ingresos-row-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openEdit(servicio)}
                        >
                          <Pencil size={14} strokeWidth={2} aria-hidden />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={deletingId === servicio.id}
                          onClick={() => void handleDelete(servicio)}
                        >
                          {deletingId === servicio.id ? (
                            <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                          ) : (
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                          )}
                          Eliminar
                        </button>
                      </div>
                    </td>
                  ) : null}
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
            aria-labelledby="av-credito-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-credito-modal-title">
                {modalMode === 'crear' ? 'Nuevo servicio' : 'Editar servicio'}
              </h2>
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
              {modalMode === 'editar' && editing?.referencia ? (
                <p className="section-note">
                  Referencia: <strong className="av-credito-ref">{editing.referencia}</strong> (no
                  cambia al editar)
                </p>
              ) : (
                <p className="section-note">
                  Al guardar se generará automáticamente un número de referencia de 4 dígitos único.
                </p>
              )}

              <label className="login-field" htmlFor="av-credito-nombre">
                Nombre del servicio
                <input
                  id="av-credito-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  disabled={submitting}
                  required
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="av-credito-descripcion">
                Descripción
                <textarea
                  id="av-credito-descripcion"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  rows={3}
                  disabled={submitting}
                  required
                />
              </label>

              <label className="login-field" htmlFor="av-credito-creditos">
                Créditos que consume
                <input
                  id="av-credito-creditos"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={creditos}
                  onChange={(event) => setCreditos(event.target.value)}
                  disabled={submitting}
                  required
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
                  ) : modalMode === 'crear' ? (
                    'Crear servicio'
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
