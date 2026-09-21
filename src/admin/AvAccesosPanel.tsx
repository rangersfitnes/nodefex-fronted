import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createAvAcceso,
  deleteAvAcceso,
  listAvAccesos,
  updateAvAcceso,
  type AvAccesoCategoria,
  type AvAccesoCredencial,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Key,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from '../icons'

const CATEGORIA_LABEL: Record<AvAccesoCategoria, string> = {
  redes: 'Redes',
  computadores: 'Computadores',
  otros: 'Otros',
}

const POLL_MS = 5000

type ModalMode = 'crear' | 'editar'

function emptyForm() {
  return {
    nombre: '',
    usuario: '',
    clave: '',
    categoria: 'redes' as AvAccesoCategoria,
    notas: '',
  }
}

type AvAccesosPanelProps = {
  canManage?: boolean
}

export function AvAccesosPanel({ canManage = false }: AvAccesosPanelProps) {
  const { user } = useAuth()
  const [accesos, setAccesos] = useState<AvAccesoCredencial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvAccesoCredencial | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    async function load(silent = false) {
      if (!user) return
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const token = await user.getIdToken()
        const data = await listAvAccesos(token)
        if (!cancelled) setAccesos(data)
      } catch (err) {
        if (!cancelled && !silent) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los accesos')
          setAccesos([])
        }
      } finally {
        if (!cancelled && !silent) setLoading(false)
      }
    }

    void load(false)
    timer = window.setInterval(() => {
      void load(true)
    }, POLL_MS)

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
    }
  }, [user, refreshTick])

  const grouped = useMemo(() => {
    const order: AvAccesoCategoria[] = ['redes', 'computadores', 'otros']
    return order
      .map((categoria) => ({
        categoria,
        items: accesos.filter((item) => item.categoria === categoria),
      }))
      .filter((group) => group.items.length > 0)
  }, [accesos])

  function openCreate() {
    setModalMode('crear')
    setEditing(null)
    setForm(emptyForm())
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item: AvAccesoCredencial) {
    setModalMode('editar')
    setEditing(item)
    setForm({
      nombre: item.nombre || '',
      usuario: item.usuario || '',
      clave: item.clave || '',
      categoria: item.categoria || 'otros',
      notas: item.notas || '',
    })
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
    if (!user || !canManage) return

    const nombre = form.nombre.trim()
    const usuario = form.usuario.trim()
    const clave = form.clave.trim()
    const notas = form.notas.trim()

    if (!nombre) {
      setFormError('El nombre es obligatorio.')
      return
    }
    if (!usuario) {
      setFormError('El usuario es obligatorio.')
      return
    }
    if (!clave) {
      setFormError('La clave es obligatoria.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      if (modalMode === 'crear') {
        const created = await createAvAcceso(token, {
          nombre,
          usuario,
          clave,
          categoria: form.categoria,
          notas: notas || undefined,
        })
        setAccesos((current) => {
          const next = current.filter((item) => item.id !== created.id)
          return [...next, created]
        })
      } else if (editing) {
        const updated = await updateAvAcceso(token, editing.id, {
          nombre,
          usuario,
          clave,
          categoria: form.categoria,
          notas: notas || null,
        })
        setAccesos((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      }
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el acceso')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item: AvAccesoCredencial) {
    if (!user || !canManage || deletingId) return
    const ok = window.confirm(`¿Eliminar el acceso «${item.nombre || item.id}»?`)
    if (!ok) return

    setDeletingId(item.id)
    try {
      const token = await user.getIdToken()
      await deleteAvAcceso(token, item.id)
      setAccesos((current) => current.filter((row) => row.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el acceso')
    } finally {
      setDeletingId('')
    }
  }

  async function copyText(id: string, value: string | null) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(''), 1500)
    } catch {
      setError('No se pudo copiar al portapapeles')
    }
  }

  return (
    <div className="av-accesos" role="tabpanel" aria-label="Accesos">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Accesos</h3>
          <p className="section-note">
            Credenciales de redes, computadores y otros. Se actualizan en tiempo real.
            {!canManage ? ' Solo el propietario puede crear o editar.' : ''}
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
          {canManage ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nuevo acceso
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando accesos...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && accesos.length === 0 ? (
        <div className="proyectos-empty">
          <Key size={28} strokeWidth={1.75} aria-hidden />
          <p>
            {canManage
              ? 'Aún no hay accesos. Crea el primero con nombre, usuario y clave.'
              : 'Aún no hay accesos publicados por el propietario.'}
          </p>
          {canManage ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nuevo acceso
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error
        ? grouped.map((group) => (
            <section key={group.categoria} className="av-accesos-group">
              <h4>{CATEGORIA_LABEL[group.categoria]}</h4>
              <div className="av-accesos-grid">
                {group.items.map((item) => {
                  const showClave = Boolean(revealed[item.id])
                  return (
                    <article key={item.id} className="av-acceso-card">
                      <div className="av-acceso-card-head">
                        <div>
                          <p className="av-ingresos-kicker">{CATEGORIA_LABEL[item.categoria]}</p>
                          <h5>{item.nombre || 'Sin nombre'}</h5>
                        </div>
                        {canManage ? (
                          <div className="av-ingresos-row-actions">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => openEdit(item)}
                              aria-label="Editar acceso"
                            >
                              <Pencil size={14} strokeWidth={2} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={deletingId === item.id}
                              onClick={() => void handleDelete(item)}
                              aria-label="Eliminar acceso"
                            >
                              {deletingId === item.id ? (
                                <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                              ) : (
                                <Trash2 size={14} strokeWidth={2} aria-hidden />
                              )}
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <dl className="av-acceso-fields">
                        <div>
                          <dt>Usuario</dt>
                          <dd>
                            <span>{item.usuario || '—'}</span>
                            {item.usuario ? (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => void copyText(`${item.id}-user`, item.usuario)}
                              >
                                <Copy size={14} strokeWidth={2} aria-hidden />
                                {copiedId === `${item.id}-user` ? 'Copiado' : 'Copiar'}
                              </button>
                            ) : null}
                          </dd>
                        </div>
                        <div>
                          <dt>Clave</dt>
                          <dd>
                            <span className="av-acceso-clave">
                              {showClave ? item.clave || '—' : '••••••••'}
                            </span>
                            <div className="av-ingresos-row-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() =>
                                  setRevealed((current) => ({
                                    ...current,
                                    [item.id]: !current[item.id],
                                  }))
                                }
                              >
                                {showClave ? (
                                  <EyeOff size={14} strokeWidth={2} aria-hidden />
                                ) : (
                                  <Eye size={14} strokeWidth={2} aria-hidden />
                                )}
                                {showClave ? 'Ocultar' : 'Ver'}
                              </button>
                              {item.clave ? (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => void copyText(`${item.id}-clave`, item.clave)}
                                >
                                  <Copy size={14} strokeWidth={2} aria-hidden />
                                  {copiedId === `${item.id}-clave` ? 'Copiado' : 'Copiar'}
                                </button>
                              ) : null}
                            </div>
                          </dd>
                        </div>
                      </dl>

                      {item.notas ? <p className="section-note">{item.notas}</p> : null}
                    </article>
                  )
                })}
              </div>
            </section>
          ))
        : null}

      {modalOpen && canManage ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-acceso-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-acceso-modal-title">
                {modalMode === 'crear' ? 'Nuevo acceso' : 'Editar acceso'}
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
              <label className="login-field" htmlFor="av-acceso-nombre">
                Nombre
                <input
                  id="av-acceso-nombre"
                  type="text"
                  value={form.nombre}
                  onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))}
                  placeholder="Instagram, PC oficina, etc."
                  required
                  disabled={submitting}
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="av-acceso-categoria">
                Categoría
                <select
                  id="av-acceso-categoria"
                  value={form.categoria}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      categoria: event.target.value as AvAccesoCategoria,
                    }))
                  }
                  disabled={submitting}
                >
                  {(Object.keys(CATEGORIA_LABEL) as AvAccesoCategoria[]).map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {CATEGORIA_LABEL[categoria]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="login-field" htmlFor="av-acceso-usuario">
                Usuario
                <input
                  id="av-acceso-usuario"
                  type="text"
                  value={form.usuario}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, usuario: event.target.value }))
                  }
                  required
                  disabled={submitting}
                  autoComplete="off"
                />
              </label>

              <label className="login-field" htmlFor="av-acceso-clave">
                Clave
                <input
                  id="av-acceso-clave"
                  type="text"
                  value={form.clave}
                  onChange={(event) => setForm((current) => ({ ...current, clave: event.target.value }))}
                  required
                  disabled={submitting}
                  autoComplete="off"
                />
              </label>

              <label className="login-field" htmlFor="av-acceso-notas">
                Notas (opcional)
                <textarea
                  id="av-acceso-notas"
                  value={form.notas}
                  onChange={(event) => setForm((current) => ({ ...current, notas: event.target.value }))}
                  rows={2}
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
                    'Crear acceso'
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
