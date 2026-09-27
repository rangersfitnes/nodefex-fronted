import { useEffect, useState, type FormEvent } from 'react'
import {
  createAvEquipo,
  deleteAvEquipo,
  listAvEquipos,
  updateAvEquipo,
  type AvEquipo,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from '../icons'

type ModalMode = 'crear' | 'editar'

type ItemRow = {
  key: string
  id?: string
  nombre: string
}

function newItemRow(partial?: Partial<ItemRow>): ItemRow {
  return {
    key: `ir-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    id: partial?.id,
    nombre: partial?.nombre || '',
  }
}

export function AvEquiposPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [equipos, setEquipos] = useState<AvEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvEquipo | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [items, setItems] = useState<ItemRow[]>([])
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
        const data = await listAvEquipos(token)
        if (!cancelled) setEquipos(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los equipos')
          setEquipos([])
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
    setItems([newItemRow()])
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(equipo: AvEquipo) {
    setModalMode('editar')
    setEditing(equipo)
    setNombre(equipo.nombre || '')
    setDescripcion(equipo.descripcion || '')
    const nextItems =
      Array.isArray(equipo.itemsRevision) && equipo.itemsRevision.length > 0
        ? equipo.itemsRevision.map((item) =>
            newItemRow({ id: item.id, nombre: item.nombre }),
          )
        : [newItemRow()]
    setItems(nextItems)
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
    const itemsPayload = items
      .map((item) => ({
        id: item.id,
        nombre: item.nombre.trim(),
      }))
      .filter((item) => item.nombre)

    if (!nombreValue) {
      setFormError('El nombre del equipo es obligatorio.')
      return
    }

    const nombres = itemsPayload.map((item) => item.nombre.toLowerCase())
    if (new Set(nombres).size !== nombres.length) {
      setFormError('Hay ítems de revisión duplicados.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      if (modalMode === 'crear') {
        const created = await createAvEquipo(token, {
          nombre: nombreValue,
          descripcion: descripcionValue || null,
          itemsRevision: itemsPayload,
        })
        setEquipos((current) => [created, ...current])
      } else if (editing) {
        const updated = await updateAvEquipo(token, editing.id, {
          nombre: nombreValue,
          descripcion: descripcionValue || null,
          itemsRevision: itemsPayload,
        })
        setEquipos((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      }
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el equipo')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(equipo: AvEquipo) {
    if (!user || readOnly || deletingId) return
    const ok = window.confirm(
      `¿Eliminar el equipo «${equipo.nombre || 'sin nombre'}»?`,
    )
    if (!ok) return

    setDeletingId(equipo.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvEquipo(token, equipo.id)
      setEquipos((current) => current.filter((item) => item.id !== equipo.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el equipo')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="av-equipos" role="tabpanel" aria-label="Equipos">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Equipos</h3>
          <p className="section-note">
            Catálogo de equipos con ítems de revisión (ej. cámara → lente, correa, batería).
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
              Crear equipo
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando equipos...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && equipos.length === 0 ? (
        <div className="proyectos-empty">
          <Package size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay equipos. Crea el primero con sus ítems de revisión.</p>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Crear equipo
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && equipos.length > 0 ? (
        <div className="av-equipos-list" role="list">
          {equipos.map((equipo) => (
            <article key={equipo.id} className="av-equipo-card" role="listitem">
              <div className="av-equipo-card-head">
                <h4>{equipo.nombre || 'Sin nombre'}</h4>
                <span className="av-equipo-items-count">
                  {(equipo.itemsRevision || []).length} ítem
                  {(equipo.itemsRevision || []).length === 1 ? '' : 's'}
                </span>
              </div>
              {equipo.descripcion ? (
                <p className="av-equipo-card-desc">{equipo.descripcion}</p>
              ) : null}
              {(equipo.itemsRevision || []).length > 0 ? (
                <ul className="av-equipo-items-preview">
                  {equipo.itemsRevision.map((item) => (
                    <li key={item.id}>{item.nombre}</li>
                  ))}
                </ul>
              ) : (
                <p className="av-equipo-card-empty">Sin ítems de revisión</p>
              )}
              {!readOnly ? (
                <div className="av-ingresos-row-actions av-equipo-card-actions">
                  <button type="button" className="btn-secondary" onClick={() => openEdit(equipo)}>
                    <Pencil size={14} strokeWidth={2} aria-hidden />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={deletingId === equipo.id}
                    onClick={() => void handleDelete(equipo)}
                  >
                    {deletingId === equipo.id ? (
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
            className="modal-panel av-equipo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-equipo-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-equipo-modal-title">
                {modalMode === 'crear' ? 'Crear equipo' : 'Editar equipo'}
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
              <label className="login-field" htmlFor="av-equipo-nombre">
                Nombre del equipo
                <input
                  id="av-equipo-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Ej. Cámara"
                  required
                  disabled={submitting}
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="av-equipo-descripcion">
                Descripción <span className="av-equipo-optional">(opcional)</span>
                <textarea
                  id="av-equipo-descripcion"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  rows={3}
                  placeholder="Detalle del equipo"
                  disabled={submitting}
                />
              </label>

              <fieldset className="av-equipo-items" disabled={submitting}>
                <legend>Ítems de revisión</legend>
                <p className="section-note">
                  Agrega lo que se debe revisar con el equipo (ej. lente, correa, batería).
                </p>

                <div className="av-equipo-items-list">
                  {items.map((item, index) => (
                    <div key={item.key} className="av-equipo-item-row">
                      <label className="login-field">
                        Ítem {index + 1}
                        <input
                          type="text"
                          value={item.nombre}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((row) =>
                                row.key === item.key
                                  ? { ...row, nombre: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="Ej. Lente"
                          disabled={submitting}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-secondary av-equipo-item-remove"
                        onClick={() =>
                          setItems((current) => {
                            const next = current.filter((row) => row.key !== item.key)
                            return next.length > 0 ? next : [newItemRow()]
                          })
                        }
                        disabled={submitting}
                        aria-label="Quitar ítem"
                      >
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setItems((current) => [...current, newItemRow()])}
                  disabled={submitting}
                >
                  <Plus size={14} strokeWidth={2} aria-hidden />
                  Agregar ítem
                </button>
              </fieldset>

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
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !nombre.trim()}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : modalMode === 'crear' ? (
                    'Crear equipo'
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
