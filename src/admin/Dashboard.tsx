import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createProyecto,
  deleteProyecto,
  listProyectos,
  type Proyecto,
} from '../api/proyectos'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Hexagon,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Package,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from '../icons'

export function Dashboard() {
  const { user, logout, isOwner, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [proyectoAEliminar, setProyectoAEliminar] = useState<Proyecto | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user || (!isOwner && !isAdmin)) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listProyectos(token)
        if (!cancelled) setProyectos(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los proyectos')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, isOwner, isAdmin])

  async function handleLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  function openModal() {
    setNombre('')
    setDescripcion('')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
  }

  function openDeleteConfirm(proyecto: Proyecto) {
    setDeleteError('')
    setProyectoAEliminar(proyecto)
  }

  function closeDeleteConfirm() {
    if (deleting) return
    setProyectoAEliminar(null)
    setDeleteError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    setFormError('')
    setSubmitting(true)

    try {
      const token = await user.getIdToken()
      const proyecto = await createProyecto(token, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
      })
      setProyectos((current) => [proyecto, ...current])
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el proyecto')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!user || !proyectoAEliminar) return

    setDeleteError('')
    setDeleting(true)

    try {
      const token = await user.getIdToken()
      await deleteProyecto(token, proyectoAEliminar.id)
      setProyectos((current) => current.filter((p) => p.id !== proyectoAEliminar.id))
      setProyectoAEliminar(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el proyecto')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="login-mark" aria-hidden>
            <Hexagon size={20} strokeWidth={2.25} />
          </span>
          <span>Nodefex Tecnology</span>
        </div>
        <div className="dashboard-user">
          <span className="dashboard-email">{user?.email}</span>
          <button type="button" className="dashboard-logout" onClick={handleLogout}>
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-hero">
          <p className="dashboard-eyebrow">
            <LayoutDashboard size={14} strokeWidth={2} aria-hidden />
            Panel admin
          </p>
          <div className="dashboard-hero-row">
            <div>
              <h1>Nodefex Tecnology</h1>
              <p className="dashboard-copy">
                {isAdmin
                  ? 'Estos son los proyectos que el propietario te asignó.'
                  : 'Gestiona los proyectos del sitio. Solo el servidor escribe en Firestore.'}
              </p>
            </div>
            {isOwner ? (
              <button type="button" className="btn-primary" onClick={openModal}>
                <Plus size={18} strokeWidth={2} aria-hidden />
                Agregar proyecto
              </button>
            ) : null}
          </div>
        </section>

        {isAdmin ? (
          <section className="proyectos-section" aria-label="Proyectos asignados">
            <p className="dashboard-eyebrow">Proyectos</p>
            {loading ? (
              <div className="proyectos-status">
                <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                Cargando proyectos...
              </div>
            ) : null}
            {!loading && error ? (
              <div className="proyectos-status proyectos-status-error" role="alert">
                <AlertCircle size={18} strokeWidth={2} aria-hidden />
                {error}
              </div>
            ) : null}
            {!loading && !error && proyectos.length === 0 ? (
              <div className="proyectos-empty">
                <Shield size={28} strokeWidth={1.75} aria-hidden />
                <p>Aún no tienes proyectos asignados.</p>
              </div>
            ) : null}
            {!loading && !error && proyectos.length > 0 ? (
              <div className="proyectos-grid">
                {proyectos.map((proyecto) => (
                  <article
                    key={proyecto.id}
                    className="proyecto-card proyecto-card-clickable"
                    onClick={() =>
                      navigate(`/admin/proyectos/${encodeURIComponent(proyecto.id)}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        navigate(`/admin/proyectos/${encodeURIComponent(proyecto.id)}`)
                      }
                    }}
                    role="link"
                    tabIndex={0}
                  >
                    <div className="proyecto-card-top">
                      <div className="proyecto-card-icon" aria-hidden>
                        <Package size={20} strokeWidth={1.75} />
                      </div>
                      <span
                        className={`admin-role-badge ${
                          proyecto.acceso?.nivel === 'manage'
                            ? 'is-owner'
                            : proyecto.acceso?.nivel === 'custom'
                              ? 'is-custom'
                              : 'is-admin'
                        }`}
                      >
                        {proyecto.acceso?.nivel === 'manage'
                          ? 'Gestionar'
                          : proyecto.acceso?.nivel === 'custom'
                            ? 'Personalizado'
                            : 'Solo ver'}
                      </span>
                    </div>
                    <h2>{proyecto.nombre}</h2>
                    <p>{proyecto.descripcion}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {isOwner ? (
          <>
            <section className="proyectos-section" aria-label="Gestión de Nodefex">
              <p className="dashboard-eyebrow">Gestión</p>
              <div className="proyectos-grid">
                <article
                  className="proyecto-card proyecto-card-clickable"
                  onClick={() => navigate('/admin/administradores')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate('/admin/administradores')
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  <div className="proyecto-card-top">
                    <div className="proyecto-card-icon" aria-hidden>
                      <Users size={20} strokeWidth={1.75} />
                    </div>
                  </div>
                  <h2>Administradores</h2>
                  <p>Crear y gestionar cuentas admin de Nodefex. No es un proyecto.</p>
                </article>
              </div>
            </section>

            <section className="proyectos-section" aria-label="Lista de proyectos">
              <p className="dashboard-eyebrow">Proyectos</p>
          {loading ? (
            <div className="proyectos-status">
              <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
              Cargando proyectos...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="proyectos-status proyectos-status-error" role="alert">
              <AlertCircle size={18} strokeWidth={2} aria-hidden />
              {error}
            </div>
          ) : null}

          {!loading && !error && proyectos.length === 0 ? (
            <div className="proyectos-empty">
              <Package size={28} strokeWidth={1.75} aria-hidden />
              <p>Aún no hay proyectos. Crea el primero para iniciar la colección en Firestore.</p>
            </div>
          ) : null}

          {!loading && !error && proyectos.length > 0 ? (
            <div className="proyectos-grid">
              {proyectos.map((proyecto) => (
                <article
                  key={proyecto.id}
                  className="proyecto-card proyecto-card-clickable"
                  onClick={() =>
                    navigate(`/admin/proyectos/${encodeURIComponent(proyecto.id)}`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(`/admin/proyectos/${encodeURIComponent(proyecto.id)}`)
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  <div className="proyecto-card-top">
                    <div className="proyecto-card-icon" aria-hidden>
                      <Package size={20} strokeWidth={1.75} />
                    </div>
                    <button
                      type="button"
                      className="proyecto-delete"
                      onClick={(event) => {
                        event.stopPropagation()
                        openDeleteConfirm(proyecto)
                      }}
                      aria-label={`Eliminar proyecto ${proyecto.nombre}`}
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                  <h2>{proyecto.nombre}</h2>
                  <p>{proyecto.descripcion}</p>
                </article>
              ))}
            </div>
          ) : null}
            </section>
          </>
        ) : null}
      </main>

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="proyecto-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="proyecto-modal-title">Agregar proyecto</h2>
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

            <form className="modal-form" onSubmit={handleSubmit} noValidate>
              <label className="login-field" htmlFor="proyecto-nombre">
                Nombre
                <input
                  id="proyecto-nombre"
                  name="nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  disabled={submitting}
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="proyecto-descripcion">
                Descripción
                <textarea
                  id="proyecto-descripcion"
                  name="descripcion"
                  rows={4}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
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
                    <>
                      <Plus size={16} strokeWidth={2} aria-hidden />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {proyectoAEliminar ? (
        <div className="modal-overlay" role="presentation" onClick={closeDeleteConfirm}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eliminar-proyecto-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="eliminar-proyecto-title">Eliminar proyecto</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeDeleteConfirm}
                disabled={deleting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <p className="modal-confirm-text">
              ¿Seguro que quieres eliminar <strong>{proyectoAEliminar.nombre}</strong>? Esta acción
              no se puede deshacer y se borrará de Firestore.
            </p>

            {deleteError ? (
              <p className="login-error" role="alert">
                <AlertCircle size={16} strokeWidth={2} aria-hidden />
                {deleteError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeDeleteConfirm}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} strokeWidth={2} aria-hidden />
                    Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
