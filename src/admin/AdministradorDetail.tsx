import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ADMIN_ACCIONES,
  formatCop,
  getAdministrador,
  saveAdministradorAccesos,
  type AdminAccion,
  type Administrador,
  type ProyectoAccesoConfig,
  type ProyectoAccesoNivel,
} from '../api/administradores'
import { listProyectos, type Proyecto } from '../api/proyectos'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Hexagon,
  LoaderCircle,
  LogOut,
  Shield,
  Users,
} from '../icons'

type AccessChoice = 'none' | ProyectoAccesoNivel

export function AdministradorDetail() {
  const { uid = '' } = useParams()
  const decodedUid = decodeURIComponent(uid)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [admin, setAdmin] = useState<Administrador | null>(null)
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [choices, setChoices] = useState<Record<string, AccessChoice>>({})
  const [accionesByProject, setAccionesByProject] = useState<Record<string, AdminAccion[]>>({})
  const [gananciasOn, setGananciasOn] = useState<Record<string, boolean>>({})
  const [porcentajes, setPorcentajes] = useState<Record<string, string>>({})
  const [totales, setTotales] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user || !decodedUid) return
      setLoading(true)
      setError('')
      setSuccess('')
      try {
        const token = await user.getIdToken()
        const [profile, proyectosData] = await Promise.all([
          getAdministrador(token, decodedUid),
          listProyectos(token),
        ])
        if (cancelled) return
        if (profile.rol === 'owner') {
          navigate('/admin/administradores', { replace: true })
          return
        }
        setAdmin(profile)
        setProyectos(proyectosData)
        const nextChoices: Record<string, AccessChoice> = {}
        const nextAcciones: Record<string, AdminAccion[]> = {}
        const nextOn: Record<string, boolean> = {}
        const nextPct: Record<string, string> = {}
        const nextTotales: Record<string, number> = {}
        for (const proyecto of proyectosData) {
          const access = profile.accesos?.[proyecto.id]
          const ganancia = profile.ganancias?.[proyecto.id]
          nextChoices[proyecto.id] = access?.nivel ?? 'none'
          nextAcciones[proyecto.id] = access?.acciones ?? []
          nextOn[proyecto.id] = Boolean(ganancia?.activa)
          nextPct[proyecto.id] =
            ganancia?.porcentaje != null && ganancia.porcentaje > 0
              ? String(ganancia.porcentaje)
              : ''
          nextTotales[proyecto.id] = ganancia?.total ?? 0
        }
        setChoices(nextChoices)
        setAccionesByProject(nextAcciones)
        setGananciasOn(nextOn)
        setPorcentajes(nextPct)
        setTotales(nextTotales)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el administrador')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, decodedUid, navigate])

  async function handleLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  function setChoice(proyectoId: string, value: AccessChoice) {
    setChoices((current) => ({ ...current, [proyectoId]: value }))
    setSuccess('')
  }

  function toggleAccion(proyectoId: string, accion: AdminAccion, enabled: boolean) {
    setAccionesByProject((current) => {
      const list = current[proyectoId] ?? []
      const next = enabled ? [...new Set([...list, accion])] : list.filter((item) => item !== accion)
      return { ...current, [proyectoId]: next }
    })
    setChoices((current) => ({ ...current, [proyectoId]: 'custom' }))
    setSuccess('')
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !admin) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const token = await user.getIdToken()
      const accesos: Record<string, ProyectoAccesoConfig> = {}
      const ganancias: Record<string, { activa: boolean; porcentaje: number }> = {}
      for (const [proyectoId, choice] of Object.entries(choices)) {
        if (choice === 'none') continue
        if (choice === 'custom') {
          const acciones = accionesByProject[proyectoId] ?? []
          if (acciones.length === 0) {
            accesos[proyectoId] = { nivel: 'view', acciones: [] }
          } else {
            accesos[proyectoId] = { nivel: 'custom', acciones }
          }
          continue
        }
        accesos[proyectoId] = { nivel: choice, acciones: [] }
      }
      for (const proyecto of proyectos) {
        const activa = Boolean(gananciasOn[proyecto.id])
        const porcentaje = Number(porcentajes[proyecto.id] || 0)
        if (activa && (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 100)) {
          throw new Error(`Indica un porcentaje válido (1 a 100) para ${proyecto.nombre}`)
        }
        ganancias[proyecto.id] = {
          activa,
          porcentaje: Number.isFinite(porcentaje) ? porcentaje : 0,
        }
      }
      const updated = await saveAdministradorAccesos(token, admin.uid, accesos, ganancias)
      setAdmin(updated)
      const nextChoices: Record<string, AccessChoice> = {}
      const nextAcciones: Record<string, AdminAccion[]> = {}
      const nextOn: Record<string, boolean> = {}
      const nextPct: Record<string, string> = {}
      const nextTotales: Record<string, number> = {}
      for (const proyecto of proyectos) {
        const access = updated.accesos?.[proyecto.id]
        const ganancia = updated.ganancias?.[proyecto.id]
        nextChoices[proyecto.id] = access?.nivel ?? 'none'
        nextAcciones[proyecto.id] = access?.acciones ?? []
        nextOn[proyecto.id] = Boolean(ganancia?.activa)
        nextPct[proyecto.id] =
          ganancia?.porcentaje != null && ganancia.porcentaje > 0
            ? String(ganancia.porcentaje)
            : ''
        nextTotales[proyecto.id] = ganancia?.total ?? 0
      }
      setChoices(nextChoices)
      setAccionesByProject(nextAcciones)
      setGananciasOn(nextOn)
      setPorcentajes(nextPct)
      setTotales(nextTotales)
      setSuccess('Accesos, acciones y ganancias guardados en el perfil del administrador')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los accesos')
    } finally {
      setSaving(false)
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
        <Link to="/admin/administradores" className="back-link">
          <ArrowRight size={16} strokeWidth={2} className="back-link-icon" aria-hidden />
          Volver a administradores
        </Link>

        <section className="dashboard-hero">
          <p className="dashboard-eyebrow">
            <Users size={14} strokeWidth={2} aria-hidden />
            Accesos del administrador
          </p>
          <div>
            <h1>{admin?.nombre || admin?.email || 'Administrador'}</h1>
            <p className="dashboard-copy">
              {admin?.email}
              {admin?.cedula ? ` · C.C. ${admin.cedula}` : ''}. Asigna acceso, acciones y un
              porcentaje de ganancia por mensualidad. El acumulado se actualiza en cada pago
              aprobado.
            </p>
            {admin ? (
              <p className="admin-ganancia-hero">
                Ganancia total: {formatCop(admin.gananciaTotal || 0)}
              </p>
            ) : null}
          </div>
        </section>

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

        {!loading && admin ? (
          <form className="admin-access-form" onSubmit={handleSave}>
            {proyectos.length === 0 ? (
              <div className="proyectos-empty">
                <p>Aún no hay proyectos para asignar.</p>
              </div>
            ) : (
              <div className="admin-access-list">
                {proyectos.map((proyecto) => {
                  const value = choices[proyecto.id] ?? 'none'
                  const selected = accionesByProject[proyecto.id] ?? []
                  return (
                    <article key={proyecto.id} className="admin-access-card">
                      <div>
                        <h3>{proyecto.nombre}</h3>
                        <p>{proyecto.descripcion}</p>
                      </div>
                      <fieldset className="admin-access-options">
                        <legend className="sr-only">Acceso a {proyecto.nombre}</legend>
                        <label>
                          <input
                            type="radio"
                            name={`acceso-${proyecto.id}`}
                            checked={value === 'none'}
                            onChange={() => setChoice(proyecto.id, 'none')}
                            disabled={saving}
                          />
                          Sin acceso
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`acceso-${proyecto.id}`}
                            checked={value === 'view'}
                            onChange={() => setChoice(proyecto.id, 'view')}
                            disabled={saving}
                          />
                          Solo visualizar
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`acceso-${proyecto.id}`}
                            checked={value === 'custom'}
                            onChange={() => setChoice(proyecto.id, 'custom')}
                            disabled={saving}
                          />
                          Acciones personalizadas
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`acceso-${proyecto.id}`}
                            checked={value === 'manage'}
                            onChange={() => setChoice(proyecto.id, 'manage')}
                            disabled={saving}
                          />
                          Todas las acciones
                        </label>
                      </fieldset>

                      {value === 'custom' ? (
                        <fieldset className="admin-action-options">
                          <legend>Acciones permitidas</legend>
                          {ADMIN_ACCIONES.map((accion) => (
                            <label key={accion.id}>
                              <input
                                type="checkbox"
                                checked={selected.includes(accion.id)}
                                onChange={(event) =>
                                  toggleAccion(proyecto.id, accion.id, event.target.checked)
                                }
                                disabled={saving}
                              />
                              {accion.label}
                            </label>
                          ))}
                        </fieldset>
                      ) : null}

                      <div className="admin-ganancia-box">
                        <label
                          className={`access-switch ${gananciasOn[proyecto.id] ? 'is-on' : 'is-off'}`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(gananciasOn[proyecto.id])}
                            disabled={saving}
                            onChange={(event) => {
                              const enabled = event.target.checked
                              setGananciasOn((current) => ({
                                ...current,
                                [proyecto.id]: enabled,
                              }))
                              setSuccess('')
                            }}
                          />
                          <span className="access-switch-track" aria-hidden>
                            <span className="access-switch-thumb" />
                          </span>
                          <span className="access-switch-label">
                            {gananciasOn[proyecto.id] ? 'Ganancias activas' : 'Ganancias apagadas'}
                          </span>
                        </label>

                        {gananciasOn[proyecto.id] ? (
                          <label className="admin-ganancia-pct" htmlFor={`pct-${proyecto.id}`}>
                            % de cada mensualidad
                            <input
                              id={`pct-${proyecto.id}`}
                              type="number"
                              min={1}
                              max={100}
                              step={0.5}
                              inputMode="decimal"
                              value={porcentajes[proyecto.id] ?? ''}
                              disabled={saving}
                              onChange={(event) => {
                                setPorcentajes((current) => ({
                                  ...current,
                                  [proyecto.id]: event.target.value,
                                }))
                                setSuccess('')
                              }}
                              placeholder="10"
                            />
                          </label>
                        ) : null}

                        <p className="admin-ganancia-total">
                          Acumulado: {formatCop(totales[proyecto.id] ?? 0)}
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {success ? (
              <p className="renew-link-success" role="status">
                <Check size={16} strokeWidth={2} aria-hidden />
                {success}
              </p>
            ) : null}

            <div className="modal-actions">
              <button type="submit" className="btn-primary" disabled={saving || proyectos.length === 0}>
                {saving ? (
                  <>
                    <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Shield size={16} strokeWidth={2} aria-hidden />
                    Guardar accesos
                  </>
                )}
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  )
}
