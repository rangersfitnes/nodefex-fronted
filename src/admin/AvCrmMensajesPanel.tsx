import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createAvCrmMensajePredeterminado,
  deleteAvCrmMensajePredeterminado,
  listAvCrmMensajesPredeterminados,
  updateAvCrmMensajePredeterminado,
  type AvCrmMensajeAlcance,
  type AvCrmMensajePredeterminado,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  StickyNote,
  Trash2,
  X,
} from '../icons'

type ModalMode = 'crear' | 'editar'

type AvCrmMensajesPanelProps = {
  canManageGlobal?: boolean
  canManagePersonal?: boolean
}

export function AvCrmMensajesPanel({
  canManageGlobal = false,
  canManagePersonal = false,
}: AvCrmMensajesPanelProps) {
  const { user } = useAuth()
  const [mensajes, setMensajes] = useState<AvCrmMensajePredeterminado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvCrmMensajePredeterminado | null>(null)
  const [createAlcance, setCreateAlcance] = useState<AvCrmMensajeAlcance>('global')
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const globales = useMemo(
    () => mensajes.filter((item) => item.alcance !== 'personal'),
    [mensajes],
  )
  const personales = useMemo(
    () => mensajes.filter((item) => item.alcance === 'personal'),
    [mensajes],
  )

  const canCreate = canManageGlobal || canManagePersonal

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvCrmMensajesPredeterminados(token)
        if (!cancelled) setMensajes(data)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'No se pudieron cargar los mensajes predeterminados',
          )
          setMensajes([])
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

  function canEditMensaje(mensaje: AvCrmMensajePredeterminado): boolean {
    if (mensaje.alcance === 'personal') return canManagePersonal
    return canManageGlobal
  }

  function openCreate(alcance: AvCrmMensajeAlcance) {
    if (alcance === 'global' && !canManageGlobal) return
    if (alcance === 'personal' && !canManagePersonal) return
    setModalMode('crear')
    setEditing(null)
    setCreateAlcance(alcance)
    setTitulo('')
    setTexto('')
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(mensaje: AvCrmMensajePredeterminado) {
    if (!canEditMensaje(mensaje)) return
    setModalMode('editar')
    setEditing(mensaje)
    setCreateAlcance(mensaje.alcance === 'personal' ? 'personal' : 'global')
    setTitulo(mensaje.titulo || '')
    setTexto(mensaje.texto || '')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user || submitting) return
    if (modalMode === 'crear' && !canCreate) return
    if (modalMode === 'editar' && editing && !canEditMensaje(editing)) return

    const cleanTitulo = titulo.trim()
    const cleanTexto = texto.trim()
    if (!cleanTitulo || !cleanTexto) {
      setFormError('El título y el mensaje son obligatorios')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      if (modalMode === 'editar' && editing) {
        const updated = await updateAvCrmMensajePredeterminado(token, editing.id, {
          titulo: cleanTitulo,
          texto: cleanTexto,
        })
        setMensajes((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      } else {
        const created = await createAvCrmMensajePredeterminado(token, {
          titulo: cleanTitulo,
          texto: cleanTexto,
        })
        setMensajes((current) => [...current, created])
      }
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el mensaje')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(mensaje: AvCrmMensajePredeterminado) {
    if (!user || !canEditMensaje(mensaje) || deletingId) return
    const ok = window.confirm(`¿Eliminar el mensaje «${mensaje.titulo}»?`)
    if (!ok) return
    setDeletingId(mensaje.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvCrmMensajePredeterminado(token, mensaje.id)
      setMensajes((current) => current.filter((item) => item.id !== mensaje.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el mensaje')
    } finally {
      setDeletingId('')
    }
  }

  function renderList(
    items: AvCrmMensajePredeterminado[],
    emptyText: string,
    manage: boolean,
    createAlcanceTarget: AvCrmMensajeAlcance,
  ) {
    if (items.length === 0) {
      return (
        <div className="av-mensajes-rapidos-empty">
          <p>{emptyText}</p>
          {manage ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => openCreate(createAlcanceTarget)}
            >
              <Plus size={16} strokeWidth={2} aria-hidden />
              Agregar mensaje
            </button>
          ) : null}
        </div>
      )
    }

    return (
      <ul className="av-mensajes-rapidos-list">
        {items.map((mensaje) => {
          const editable = canEditMensaje(mensaje)
          return (
            <li key={mensaje.id}>
              <div className="av-mensajes-rapidos-body">
                <strong>{mensaje.titulo}</strong>
                <p>{mensaje.texto}</p>
              </div>
              {editable ? (
                <div className="av-mensajes-rapidos-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openEdit(mensaje)}
                    disabled={Boolean(deletingId)}
                  >
                    <Pencil size={14} strokeWidth={2} aria-hidden />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void handleDelete(mensaje)}
                    disabled={deletingId === mensaje.id}
                    aria-label={`Eliminar ${mensaje.titulo}`}
                  >
                    {deletingId === mensaje.id ? (
                      <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                    ) : (
                      <Trash2 size={14} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  const modalTitle =
    modalMode === 'editar'
      ? 'Editar mensaje rápido'
      : createAlcance === 'personal'
        ? 'Nuevo mensaje personal'
        : 'Nuevo mensaje global'

  return (
    <div className="av-ingresos" role="tabpanel" aria-label="Mensajes rápidos">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Mensajes rápidos</h3>
        </div>
        <div className="av-ingresos-toolbar-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden />
            Actualizar
          </button>
          {canManageGlobal ? (
            <button type="button" className="btn-primary" onClick={() => openCreate('global')}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Agregar global
            </button>
          ) : null}
          {canManagePersonal ? (
            <button type="button" className="btn-primary" onClick={() => openCreate('personal')}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Agregar mío
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando mensajes...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && mensajes.length === 0 && !canCreate ? (
        <div className="proyectos-empty">
          <StickyNote size={28} strokeWidth={1.75} aria-hidden />
          <p>No hay mensajes predeterminados.</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="av-mensajes-rapidos-sections">
          <section className="av-mensajes-rapidos-section" aria-label="Mensajes globales">
            <div className="av-mensajes-rapidos-section-head">
              <h4>Globales</h4>
            </div>
            {renderList(
              globales,
              'No hay mensajes globales.',
              canManageGlobal,
              'global',
            )}
          </section>

          {canManagePersonal || personales.length > 0 ? (
            <section className="av-mensajes-rapidos-section" aria-label="Mensajes personales">
              <div className="av-mensajes-rapidos-section-head">
                <h4>Mis mensajes</h4>
              </div>
              {renderList(
                personales,
                'No tienes mensajes personales.',
                canManagePersonal,
                'personal',
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-mensaje-rapido-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-mensaje-rapido-title">{modalTitle}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                aria-label="Cerrar"
                disabled={submitting}
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <form className="modal-form" onSubmit={(event) => void handleSubmit(event)}>
              <label className="login-field" htmlFor="av-mensaje-rapido-titulo">
                Título
                <input
                  id="av-mensaje-rapido-titulo"
                  value={titulo}
                  onChange={(event) => setTitulo(event.target.value)}
                  disabled={submitting}
                  required
                  maxLength={80}
                  placeholder="Ej. Saludo inicial"
                />
              </label>
              <label className="login-field" htmlFor="av-mensaje-rapido-texto">
                Mensaje
                <textarea
                  id="av-mensaje-rapido-texto"
                  value={texto}
                  onChange={(event) => setTexto(event.target.value)}
                  disabled={submitting}
                  required
                  rows={5}
                  maxLength={2000}
                  placeholder="Texto que se enviará por WhatsApp"
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
                      Guardando…
                    </>
                  ) : (
                    'Guardar'
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
