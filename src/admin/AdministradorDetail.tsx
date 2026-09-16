import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ADMIN_ACCIONES_AUDIOVISUAL,
  ADMIN_ACCIONES_MEMBRESIA,
  formatCop,
  getAdministrador,
  getAdministradorGanancias,
  liquidarAdministradorGanancias,
  saveAdministradorAccesos,
  type AdminAccion,
  type Administrador,
  type GananciaLiquidacion,
  type GananciaMovimiento,
  type ProyectoAccesoConfig,
  type ProyectoAccesoNivel,
} from '../api/administradores'
import {
  esProyectoAudiovisual,
  esProyectoContable,
  listProyectos,
  type Proyecto,
} from '../api/proyectos'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  Hexagon,
  LoaderCircle,
  LogOut,
  Shield,
  Users,
  X,
} from '../icons'

type AccessChoice = 'none' | ProyectoAccesoNivel
type CapabilityMode = 'none' | 'view' | 'manage'

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function accionesDisponiblesParaProyecto(proyectoId: string): {
  id: AdminAccion
  label: string
}[] {
  if (esProyectoAudiovisual(proyectoId)) return ADMIN_ACCIONES_AUDIOVISUAL
  if (esProyectoContable(proyectoId)) return []
  return ADMIN_ACCIONES_MEMBRESIA
}

function modeFromAccess(
  access: ProyectoAccesoConfig | undefined,
  accion: AdminAccion,
): CapabilityMode {
  if (!access) return 'none'
  if (access.nivel === 'manage') return 'manage'
  if (access.nivel === 'view') return 'view'
  if (access.acciones?.includes(accion)) return 'manage'
  if (access.visualizar?.includes(accion)) return 'view'
  return 'none'
}

function emptyModesForProyecto(proyectoId: string): Record<AdminAccion, CapabilityMode> {
  const modes = {} as Record<AdminAccion, CapabilityMode>
  for (const accion of accionesDisponiblesParaProyecto(proyectoId)) {
    modes[accion.id] = 'none'
  }
  return modes
}

export function AdministradorDetail() {
  const { uid = '' } = useParams()
  const decodedUid = decodeURIComponent(uid)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [admin, setAdmin] = useState<Administrador | null>(null)
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [choices, setChoices] = useState<Record<string, AccessChoice>>({})
  const [capabilityModes, setCapabilityModes] = useState<
    Record<string, Partial<Record<AdminAccion, CapabilityMode>>>
  >({})
  const [gananciasOn, setGananciasOn] = useState<Record<string, boolean>>({})
  const [porcentajes, setPorcentajes] = useState<Record<string, string>>({})
  const [totales, setTotales] = useState<Record<string, number>>({})
  const [movimientos, setMovimientos] = useState<GananciaMovimiento[]>([])
  const [liquidaciones, setLiquidaciones] = useState<GananciaLiquidacion[]>([])
  const [pendienteTotal, setPendienteTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [liquidarOpen, setLiquidarOpen] = useState(false)
  const [liquidating, setLiquidating] = useState(false)
  const [liquidarError, setLiquidarError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user || !decodedUid) return
      setLoading(true)
      setError('')
      setSuccess('')
      try {
        const token = await user.getIdToken()
        const [profile, proyectosData, gananciasData] = await Promise.all([
          getAdministrador(token, decodedUid),
          listProyectos(token),
          getAdministradorGanancias(token, decodedUid).catch(() => ({
            pendiente: { total: 0, movimientos: [] as GananciaMovimiento[] },
            liquidaciones: [] as GananciaLiquidacion[],
          })),
        ])
        if (cancelled) return
        if (profile.rol === 'owner') {
          navigate('/admin/administradores', { replace: true })
          return
        }
        setAdmin(profile)
        setProyectos(proyectosData)
        const nextChoices: Record<string, AccessChoice> = {}
        const nextModes: Record<string, Partial<Record<AdminAccion, CapabilityMode>>> = {}
        const nextOn: Record<string, boolean> = {}
        const nextPct: Record<string, string> = {}
        const nextTotales: Record<string, number> = {}
        for (const proyecto of proyectosData) {
          const access = profile.accesos?.[proyecto.id]
          const ganancia = profile.ganancias?.[proyecto.id]
          nextChoices[proyecto.id] = access?.nivel ?? 'none'
          const modes = emptyModesForProyecto(proyecto.id)
          for (const accion of accionesDisponiblesParaProyecto(proyecto.id)) {
            modes[accion.id] = modeFromAccess(access, accion.id)
          }
          nextModes[proyecto.id] = modes
          nextOn[proyecto.id] = Boolean(ganancia?.activa)
          nextPct[proyecto.id] =
            ganancia?.porcentaje != null && ganancia.porcentaje > 0
              ? String(ganancia.porcentaje)
              : ''
          nextTotales[proyecto.id] = ganancia?.total ?? 0
        }
        setChoices(nextChoices)
        setCapabilityModes(nextModes)
        setGananciasOn(nextOn)
        setPorcentajes(nextPct)
        setTotales(nextTotales)
        setMovimientos(gananciasData.pendiente.movimientos)
        setPendienteTotal(gananciasData.pendiente.total)
        setLiquidaciones(gananciasData.liquidaciones)
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
    navigate('/admin', { replace: true })
  }

  function setChoice(proyectoId: string, value: AccessChoice) {
    setChoices((current) => ({ ...current, [proyectoId]: value }))
    if (value === 'custom') {
      setCapabilityModes((current) => ({
        ...current,
        [proyectoId]: current[proyectoId] ?? emptyModesForProyecto(proyectoId),
      }))
    }
    setSuccess('')
  }

  function setCapabilityMode(proyectoId: string, accion: AdminAccion, mode: CapabilityMode) {
    setCapabilityModes((current) => ({
      ...current,
      [proyectoId]: {
        ...(current[proyectoId] ?? emptyModesForProyecto(proyectoId)),
        [accion]: mode,
      },
    }))
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
          const modes = capabilityModes[proyectoId] ?? {}
          const acciones: AdminAccion[] = []
          const visualizar: AdminAccion[] = []
          for (const accion of accionesDisponiblesParaProyecto(proyectoId)) {
            const mode = modes[accion.id] ?? 'none'
            if (mode === 'manage') acciones.push(accion.id)
            if (mode === 'view') visualizar.push(accion.id)
          }
          if (acciones.length === 0 && visualizar.length === 0) {
            accesos[proyectoId] = { nivel: 'view', acciones: [], visualizar: [] }
          } else {
            accesos[proyectoId] = { nivel: 'custom', acciones, visualizar }
          }
          continue
        }
        accesos[proyectoId] = { nivel: choice, acciones: [], visualizar: [] }
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
      const nextModes: Record<string, Partial<Record<AdminAccion, CapabilityMode>>> = {}
      const nextOn: Record<string, boolean> = {}
      const nextPct: Record<string, string> = {}
      const nextTotales: Record<string, number> = {}
      for (const proyecto of proyectos) {
        const access = updated.accesos?.[proyecto.id]
        const ganancia = updated.ganancias?.[proyecto.id]
        nextChoices[proyecto.id] = access?.nivel ?? 'none'
        const modes = emptyModesForProyecto(proyecto.id)
        for (const accion of accionesDisponiblesParaProyecto(proyecto.id)) {
          modes[accion.id] = modeFromAccess(access, accion.id)
        }
        nextModes[proyecto.id] = modes
        nextOn[proyecto.id] = Boolean(ganancia?.activa)
        nextPct[proyecto.id] =
          ganancia?.porcentaje != null && ganancia.porcentaje > 0
            ? String(ganancia.porcentaje)
            : ''
        nextTotales[proyecto.id] = ganancia?.total ?? 0
      }
      setChoices(nextChoices)
      setCapabilityModes(nextModes)
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

  async function handleLiquidar() {
    if (!user || !admin || liquidating) return
    setLiquidating(true)
    setLiquidarError('')
    try {
      const token = await user.getIdToken()
      const { administrador, liquidacion } = await liquidarAdministradorGanancias(
        token,
        admin.uid,
      )
      setAdmin(administrador)
      const nextTotales: Record<string, number> = {}
      for (const proyecto of proyectos) {
        nextTotales[proyecto.id] = administrador.ganancias?.[proyecto.id]?.total ?? 0
      }
      setTotales(nextTotales)
      setMovimientos([])
      setPendienteTotal(0)
      setLiquidaciones((current) => [liquidacion, ...current].slice(0, 20))
      setLiquidarOpen(false)
      setSuccess(
        `Se liquidaron ${formatCop(liquidacion.monto)} y se reinició el acumulado de ganancias.`,
      )
    } catch (err) {
      setLiquidarError(err instanceof Error ? err.message : 'No se pudieron liquidar las ganancias')
    } finally {
      setLiquidating(false)
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
          <div className="dashboard-hero-row">
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
                  Ganancia pendiente: {formatCop(pendienteTotal || admin.gananciaTotal || 0)}
                </p>
              ) : null}
            </div>
            {admin && (pendienteTotal > 0 || (admin.gananciaTotal || 0) > 0) ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setLiquidarError('')
                  setLiquidarOpen(true)
                }}
              >
                <Banknote size={18} strokeWidth={2} aria-hidden />
                Liquidar ganancias
              </button>
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

        {!loading && success ? (
          <p className="renew-link-success" role="status">
            <Check size={16} strokeWidth={2} aria-hidden />
            {success}
          </p>
        ) : null}

        {!loading && admin ? (
          <>
            <section className="admin-ganancia-ledger" aria-label="Concepto de ganancias">
              <div className="admin-ganancia-ledger-head">
                <div>
                  <p className="dashboard-eyebrow">Ganancias pendientes</p>
                  <h2>Concepto y valor</h2>
                </div>
                <strong>{formatCop(pendienteTotal)}</strong>
              </div>
              {movimientos.length === 0 ? (
                <p className="admin-ganancia-empty">Aún no hay comisiones pendientes de liquidar.</p>
              ) : (
                <div className="admin-ganancia-table-wrap">
                  <table className="admin-ganancia-table">
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Fecha</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span>{item.concepto}</span>
                            {item.proyectoId ? (
                              <small>
                                {proyectos.find((p) => p.id === item.proyectoId)?.nombre ||
                                  item.proyectoId}
                              </small>
                            ) : null}
                          </td>
                          <td>{formatFecha(item.createdAt)}</td>
                          <td>{formatCop(item.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {liquidaciones.length > 0 ? (
              <section className="admin-ganancia-ledger" aria-label="Liquidaciones">
                <div className="admin-ganancia-ledger-head">
                  <div>
                    <p className="dashboard-eyebrow">Historial</p>
                    <h2>Liquidaciones</h2>
                  </div>
                </div>
                <ul className="admin-liquidacion-list">
                  {liquidaciones.map((item) => (
                    <li key={item.id}>
                      <span>
                        {formatFecha(item.createdAt)} · {item.conceptos.length} concepto
                        {item.conceptos.length === 1 ? '' : 's'}
                      </span>
                      <strong>{formatCop(item.monto)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <form className="admin-access-form" onSubmit={handleSave}>
            {proyectos.length === 0 ? (
              <div className="proyectos-empty">
                <p>Aún no hay proyectos para asignar.</p>
              </div>
            ) : (
              <div className="admin-access-list">
                {proyectos.map((proyecto) => {
                  const value = choices[proyecto.id] ?? 'none'
                  const modes = capabilityModes[proyecto.id] ?? emptyModesForProyecto(proyecto.id)
                  const capacidades = accionesDisponiblesParaProyecto(proyecto.id)
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
                          <legend>
                            {esProyectoAudiovisual(proyecto.id)
                              ? 'Permiso por pestaña'
                              : 'Permiso por acción'}
                          </legend>
                          <p className="section-note admin-access-hint">
                            Combina «Solo visualizar» (sin cambios) y «Puede gestionar» según lo que
                            necesite el administrador.
                          </p>
                          {capacidades.length === 0 ? (
                            <p className="section-note">
                              Para este proyecto usa «Solo visualizar» o «Todas las acciones».
                            </p>
                          ) : (
                            capacidades.map((accion) => {
                              const mode = modes[accion.id] ?? 'none'
                              return (
                                <div key={accion.id} className="admin-capability-row">
                                  <span className="admin-capability-label">{accion.label}</span>
                                  <div className="admin-capability-modes">
                                    <label>
                                      <input
                                        type="radio"
                                        name={`cap-${proyecto.id}-${accion.id}`}
                                        checked={mode === 'none'}
                                        onChange={() =>
                                          setCapabilityMode(proyecto.id, accion.id, 'none')
                                        }
                                        disabled={saving}
                                      />
                                      Sin acceso
                                    </label>
                                    <label>
                                      <input
                                        type="radio"
                                        name={`cap-${proyecto.id}-${accion.id}`}
                                        checked={mode === 'view'}
                                        onChange={() =>
                                          setCapabilityMode(proyecto.id, accion.id, 'view')
                                        }
                                        disabled={saving}
                                      />
                                      Solo visualizar
                                    </label>
                                    <label>
                                      <input
                                        type="radio"
                                        name={`cap-${proyecto.id}-${accion.id}`}
                                        checked={mode === 'manage'}
                                        onChange={() =>
                                          setCapabilityMode(proyecto.id, accion.id, 'manage')
                                        }
                                        disabled={saving}
                                      />
                                      Puede gestionar
                                    </label>
                                  </div>
                                </div>
                              )
                            })
                          )}
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
          </>
        ) : null}
      </main>

      {liquidarOpen && admin ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => {
            if (!liquidating) setLiquidarOpen(false)
          }}
        >
          <div
            className="modal-panel modal-panel-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="liquidar-ganancias-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="liquidar-ganancias-title">Liquidar ganancias</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setLiquidarOpen(false)}
                disabled={liquidating}
                aria-label="Cerrar"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <p className="modal-confirm-text">
              Se pagará a {admin.nombre || admin.email} el acumulado actual. Al liquidar se
              guarda el registro y el contador de ganancias vuelve a cero.
            </p>
            {movimientos.length === 0 ? (
              <p className="admin-ganancia-empty">No hay conceptos pendientes.</p>
            ) : (
              <ul className="liquidar-conceptos">
                {movimientos.map((item) => (
                  <li key={item.id}>
                    <span>{item.concepto}</span>
                    <strong>{formatCop(item.valor)}</strong>
                  </li>
                ))}
              </ul>
            )}
            <p className="liquidar-total">
              Total a liquidar
              <strong>{formatCop(pendienteTotal)}</strong>
            </p>
            {liquidarError ? (
              <p className="proyectos-status proyectos-status-error" role="alert">
                <AlertCircle size={16} strokeWidth={2} aria-hidden />
                {liquidarError}
              </p>
            ) : null}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setLiquidarOpen(false)}
                disabled={liquidating}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleLiquidar()}
                disabled={liquidating || movimientos.length === 0 || pendienteTotal <= 0}
              >
                {liquidating ? (
                  <>
                    <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                    Liquidando...
                  </>
                ) : (
                  <>
                    <Banknote size={16} strokeWidth={2} aria-hidden />
                    Liquidar
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
