import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createAdministrador,
  deleteAdministrador,
  formatCop,
  listAdministradores,
  type Administrador,
} from '../api/administradores'
import { listProyectos, type Proyecto } from '../api/proyectos'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowRight,
  Filter,
  Hexagon,
  LoaderCircle,
  Link2,
  LogOut,
  Mail,
  Plus,
  Shield,
  Trash2,
  User,
  Users,
  X,
} from '../icons'

type ProyectoFilter = 'all' | 'none' | string

function adminProjectIds(admin: Administrador): string[] {
  return Object.keys(admin.accesos || {})
}

export function Administradores() {
  const { user, administrador, logout } = useAuth()
  const navigate = useNavigate()
  const [admins, setAdmins] = useState<Administrador[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [proyectoFilter, setProyectoFilter] = useState<ProyectoFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [adminAEliminar, setAdminAEliminar] = useState<Administrador | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const [adminsData, proyectosData] = await Promise.all([
          listAdministradores(token),
          listProyectos(token),
        ])
        if (cancelled) return
        setAdmins(adminsData)
        setProyectos(proyectosData)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'No se pudieron cargar los administradores',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  const proyectoNombreById = useMemo(() => {
    const map = new Map<string, string>()
    for (const proyecto of proyectos) {
      map.set(proyecto.id, proyecto.nombre || proyecto.id)
    }
    return map
  }, [proyectos])

  const filteredAdmins = useMemo(() => {
    return admins.filter((item) => {
      if (item.rol === 'owner') {
        return proyectoFilter === 'all'
      }
      const ids = adminProjectIds(item)
      if (proyectoFilter === 'all') return true
      if (proyectoFilter === 'none') return ids.length === 0
      return ids.includes(proyectoFilter)
    })
  }, [admins, proyectoFilter])

  async function handleLogout() {
    await logout()
    navigate('/admin', { replace: true })
  }

  function openModal() {
    setEmail('')
    setPassword('')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    setFormError('')
    setSubmitting(true)

    try {
      const token = await user.getIdToken()
      const created = await createAdministrador(token, {
        email: email.trim(),
        password,
      })
      setAdmins((current) =>
        [...current, created].sort((a, b) => {
          if (a.rol === 'owner' && b.rol !== 'owner') return -1
          if (a.rol !== 'owner' && b.rol === 'owner') return 1
          return String(a.email || '').localeCompare(String(b.email || ''))
        }),
      )
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el administrador')
    } finally {
      setSubmitting(false)
    }
  }

  function openDeleteConfirm(item: Administrador) {
    setDeleteError('')
    setAdminAEliminar(item)
  }

  function closeDeleteConfirm() {
    if (deleting) return
    setAdminAEliminar(null)
    setDeleteError('')
  }

  async function handleDeleteConfirm() {
    if (!user || !adminAEliminar) return
    setDeleting(true)
    setDeleteError('')
    try {
      const token = await user.getIdToken()
      await deleteAdministrador(token, adminAEliminar.uid)
      setAdmins((current) => current.filter((item) => item.uid !== adminAEliminar.uid))
      setAdminAEliminar(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el administrador')
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
          <button type="button" className="dashboard-logout" onClick={() => void handleLogout()}>
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <Link to="/admin/dashboard" className="back-link">
          <ArrowRight size={16} strokeWidth={2} className="back-link-icon" aria-hidden />
          Volver al dashboard
        </Link>

        <section className="dashboard-hero">
          <p className="dashboard-eyebrow">
            <Users size={14} strokeWidth={2} aria-hidden />
            Administradores
          </p>
          <div className="dashboard-hero-row">
            <div>
              <h1>Gestionar administradores</h1>
              <p className="dashboard-copy">
                Cuentas en Firebase Auth de Nodefex. Se guardan en la colección{' '}
                <code>administradores</code> con rol <strong>admin</strong>.{' '}
                {administrador?.email} es el propietario.
              </p>
            </div>
            <div className="hero-actions">
              <Link to="/registroadmin" className="btn-secondary" target="_blank" rel="noreferrer">
                <Link2 size={18} strokeWidth={2} aria-hidden />
                Página de registro
              </Link>
              <button type="button" className="btn-primary" onClick={openModal}>
                <Plus size={18} strokeWidth={2} aria-hidden />
                Crear administrador
              </button>
            </div>
          </div>
        </section>

        <section className="usuarios-section" aria-label="Lista de administradores">
          {!loading && !error && admins.length > 0 ? (
            <div className="admins-filters" role="group" aria-label="Filtrar por proyecto">
              <div className="admins-filters-label">
                <Filter size={16} strokeWidth={2} aria-hidden />
                <span>Proyecto</span>
              </div>
              <div className="admins-filter-chips">
                <button
                  type="button"
                  className={proyectoFilter === 'all' ? 'is-active' : ''}
                  onClick={() => setProyectoFilter('all')}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={proyectoFilter === 'none' ? 'is-active' : ''}
                  onClick={() => setProyectoFilter('none')}
                >
                  Sin proyectos
                </button>
                {proyectos.map((proyecto) => (
                  <button
                    key={proyecto.id}
                    type="button"
                    className={proyectoFilter === proyecto.id ? 'is-active' : ''}
                    onClick={() => setProyectoFilter(proyecto.id)}
                  >
                    {proyecto.nombre || proyecto.id}
                  </button>
                ))}
              </div>
              <p className="admins-filters-count section-note">
                {filteredAdmins.length} de {admins.length}
              </p>
            </div>
          ) : null}

          {loading ? (
            <div className="proyectos-status">
              <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
              Cargando administradores...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="proyectos-status proyectos-status-error" role="alert">
              <AlertCircle size={18} strokeWidth={2} aria-hidden />
              {error}
            </div>
          ) : null}

          {!loading && !error && admins.length === 0 ? (
            <div className="proyectos-empty">
              <User size={28} strokeWidth={1.75} aria-hidden />
              <p>No hay administradores registrados todavía.</p>
            </div>
          ) : null}

          {!loading && !error && admins.length > 0 && filteredAdmins.length === 0 ? (
            <div className="proyectos-empty">
              <Filter size={28} strokeWidth={1.75} aria-hidden />
              <p>Ningún administrador coincide con este filtro de proyecto.</p>
              <button type="button" className="btn-secondary" onClick={() => setProyectoFilter('all')}>
                Ver todos
              </button>
            </div>
          ) : null}

          {!loading && !error && filteredAdmins.length > 0 ? (
            <div className="usuarios-list">
              {filteredAdmins.map((item) => {
                const projectIds = adminProjectIds(item)
                return (
                  <article
                    key={item.uid}
                    className={`usuario-row ${item.rol === 'admin' ? 'usuario-row-clickable' : ''}`}
                    onClick={() => {
                      if (item.rol === 'admin') {
                        navigate(`/admin/administradores/${encodeURIComponent(item.uid)}`)
                      }
                    }}
                    onKeyDown={(event) => {
                      if (item.rol !== 'admin') return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        navigate(`/admin/administradores/${encodeURIComponent(item.uid)}`)
                      }
                    }}
                    role={item.rol === 'admin' ? 'link' : undefined}
                    tabIndex={item.rol === 'admin' ? 0 : undefined}
                  >
                    <div className="usuario-avatar" aria-hidden>
                      <Mail size={18} strokeWidth={1.75} />
                    </div>
                    <div className="usuario-info">
                      <h3>{item.nombre || item.email || 'Sin correo'}</h3>
                      <p>
                        {item.rol === 'admin'
                          ? [
                              item.nombre ? item.email : null,
                              item.cedula ? `C.C. ${item.cedula}` : null,
                              `Ganancia ${formatCop(item.gananciaTotal || 0)}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : 'UID: ' + item.uid}
                      </p>
                      {item.rol === 'admin' ? (
                        <div className="admin-project-tags">
                          {projectIds.length === 0 ? (
                            <span className="admin-project-tag is-empty">Sin proyectos</span>
                          ) : (
                            projectIds.map((id) => (
                              <span key={id} className="admin-project-tag">
                                {proyectoNombreById.get(id) || id}
                              </span>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div
                      className="usuario-actions"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <span
                        className={`admin-role-badge ${item.rol === 'owner' ? 'is-owner' : 'is-admin'}`}
                      >
                        <Shield size={14} strokeWidth={2} aria-hidden />
                        {item.rol === 'owner' ? 'Owner' : 'Admin'}
                      </span>
                      {item.rol === 'admin' ? (
                        <button
                          type="button"
                          className="proyecto-delete"
                          onClick={() => openDeleteConfirm(item)}
                          aria-label={`Eliminar administrador ${item.email || item.nombre || item.uid}`}
                        >
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </section>
      </main>

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crear-admin-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="crear-admin-title">Crear administrador</h2>
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
              <label className="login-field" htmlFor="admin-email">
                Correo
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  autoFocus
                  autoComplete="off"
                />
              </label>
              <label className="login-field" htmlFor="admin-password">
                Contraseña
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={submitting}
                  autoComplete="new-password"
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
                      Creando…
                    </>
                  ) : (
                    'Crear'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {adminAEliminar ? (
        <div className="modal-overlay" role="presentation" onClick={closeDeleteConfirm}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eliminar-admin-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="eliminar-admin-title">Eliminar administrador</h2>
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
            <p className="section-note">
              ¿Eliminar a <strong>{adminAEliminar.email || adminAEliminar.nombre}</strong>? Esta
              acción no se puede deshacer.
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
                className="btn-primary"
                onClick={() => void handleDeleteConfirm()}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                    Eliminando…
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
