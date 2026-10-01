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
  getAvFinanzasResumen,
  listAvVentas,
  type AvFinanzasResumen,
  type AvMetodoPagoTipo,
  type AvVenta,
} from '../api/audiovisual'
import {
  esProyectoAudiovisual,
  esProyectoContable,
  listProyectos,
  type Proyecto,
} from '../api/proyectos'
import { resolveAvAccess } from './avStaffPermisos'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  Hexagon,
  LoaderCircle,
  LogOut,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from '../icons'

type AccessChoice = 'none' | ProyectoAccesoNivel
type CapabilityMode = 'none' | 'view' | 'manage'

type LiquidarParteForm = {
  id: string
  tipo: AvMetodoPagoTipo
  valor: string
  cuenta: string
  detalle: string
}

const METODO_PAGO_LABEL: Record<AvMetodoPagoTipo, string> = {
  efectivo: 'Efectivo',
  cuenta_bancaria: 'Transferencia / cuenta',
  pasarela: 'Pasarela (Wompi)',
}

const EMPTY_RESUMEN: AvFinanzasResumen = {
  ingresosTotales: 0,
  egresosTotales: 0,
  disponible: 0,
  cantidadIngresos: 0,
  cantidadEgresos: 0,
  porMetodo: [],
}

function newLiquidarParte(partial?: Partial<LiquidarParteForm>): LiquidarParteForm {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo: 'efectivo',
    valor: '',
    cuenta: '',
    detalle: '',
    ...partial,
  }
}

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

function accessForProyecto(
  accesos: Record<string, ProyectoAccesoConfig> | null | undefined,
  proyectoId: string,
): ProyectoAccesoConfig | undefined {
  if (esProyectoAudiovisual(proyectoId)) return resolveAvAccess(accesos)
  return accesos?.[proyectoId]
}

function emptyModesForProyecto(proyectoId: string): Record<AdminAccion, CapabilityMode> {
  const modes = {} as Record<AdminAccion, CapabilityMode>
  for (const accion of accionesDisponiblesParaProyecto(proyectoId)) {
    modes[accion.id] = 'none'
  }
  if (esProyectoAudiovisual(proyectoId)) {
    modes.av_crm = 'manage'
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
  const [ventas, setVentas] = useState<AvVenta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [liquidarOpen, setLiquidarOpen] = useState(false)
  const [liquidating, setLiquidating] = useState(false)
  const [liquidarError, setLiquidarError] = useState('')
  const [liquidarPartes, setLiquidarPartes] = useState<LiquidarParteForm[]>([
    newLiquidarParte({ valor: '' }),
  ])
  const [presupuesto, setPresupuesto] = useState<AvFinanzasResumen>(EMPTY_RESUMEN)
  const [presupuestoLoading, setPresupuestoLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user || !decodedUid) return
      setLoading(true)
      setError('')
      setSuccess('')
      try {
        const token = await user.getIdToken()
        const [profile, proyectosData, gananciasData, ventasData] = await Promise.all([
          getAdministrador(token, decodedUid),
          listProyectos(token),
          getAdministradorGanancias(token, decodedUid).catch(() => ({
            pendiente: { total: 0, movimientos: [] as GananciaMovimiento[] },
            liquidaciones: [] as GananciaLiquidacion[],
          })),
          listAvVentas(token, { vendedorUid: decodedUid }).catch(() => [] as AvVenta[]),
        ])
        if (cancelled) return
        if (profile.rol === 'owner') {
          navigate('/admin/administradores', { replace: true })
          return
        }
        setAdmin(profile)
        setProyectos(proyectosData)
        setVentas(ventasData)
        const nextChoices: Record<string, AccessChoice> = {}
        const nextModes: Record<string, Partial<Record<AdminAccion, CapabilityMode>>> = {}
        const nextOn: Record<string, boolean> = {}
        const nextPct: Record<string, string> = {}
        const nextTotales: Record<string, number> = {}
        for (const proyecto of proyectosData) {
          const access = accessForProyecto(profile.accesos, proyecto.id)
          const ganancia = profile.ganancias?.[proyecto.id]
          nextChoices[proyecto.id] = access?.nivel ?? 'none'
          const modes = emptyModesForProyecto(proyecto.id)
          for (const accion of accionesDisponiblesParaProyecto(proyecto.id)) {
            modes[accion.id] = modeFromAccess(access, accion.id)
          }
          if (esProyectoAudiovisual(proyecto.id)) {
            modes.av_crm = 'manage'
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
    if (esProyectoAudiovisual(proyectoId) && accion === 'av_crm') return
    setCapabilityModes((current) => ({
      ...current,
      [proyectoId]: {
        ...(current[proyectoId] ?? emptyModesForProyecto(proyectoId)),
        [accion]: mode,
        ...(esProyectoAudiovisual(proyectoId) ? { av_crm: 'manage' as CapabilityMode } : {}),
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
        const previous = accessForProyecto(admin.accesos, proyectoId)
        const previousRol = previous?.rol
        const projectRol =
          previousRol === 'admin' || previousRol === 'vendedor'
            ? previousRol
            : admin.rol === 'vendedor'
              ? 'vendedor'
              : 'admin'
        if (choice === 'custom') {
          const modes = capabilityModes[proyectoId] ?? {}
          const acciones: AdminAccion[] = []
          const visualizar: AdminAccion[] = []
          for (const accion of accionesDisponiblesParaProyecto(proyectoId)) {
            const mode =
              esProyectoAudiovisual(proyectoId) && accion.id === 'av_crm'
                ? 'manage'
                : (modes[accion.id] ?? 'none')
            if (mode === 'manage') acciones.push(accion.id)
            if (mode === 'view') visualizar.push(accion.id)
          }
          if (esProyectoAudiovisual(proyectoId) && !acciones.includes('av_crm')) {
            acciones.push('av_crm')
          }
          if (acciones.length === 0 && visualizar.length === 0) {
            accesos[proyectoId] = {
              nivel: 'view',
              acciones: [],
              visualizar: [],
              rol: projectRol,
            }
          } else {
            accesos[proyectoId] = {
              nivel: 'custom',
              acciones,
              visualizar,
              rol: projectRol,
            }
          }
          continue
        }
        accesos[proyectoId] = {
          nivel: choice,
          acciones: [],
          visualizar: [],
          rol: projectRol,
        }
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
        const access = accessForProyecto(updated.accesos, proyecto.id)
        const ganancia = updated.ganancias?.[proyecto.id]
        nextChoices[proyecto.id] = access?.nivel ?? 'none'
        const modes = emptyModesForProyecto(proyecto.id)
        for (const accion of accionesDisponiblesParaProyecto(proyecto.id)) {
          modes[accion.id] = modeFromAccess(access, accion.id)
        }
        if (esProyectoAudiovisual(proyecto.id)) {
          modes.av_crm = 'manage'
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

  async function openLiquidarModal() {
    setLiquidarError('')
    setLiquidarPartes([
      newLiquidarParte({
        tipo: 'efectivo',
        valor: pendienteTotal > 0 ? String(Math.round(pendienteTotal)) : '',
      }),
    ])
    setLiquidarOpen(true)
    if (!user) return
    setPresupuestoLoading(true)
    try {
      const token = await user.getIdToken()
      const resumen = await getAvFinanzasResumen(token)
      setPresupuesto(resumen)
    } catch {
      setPresupuesto(EMPTY_RESUMEN)
    } finally {
      setPresupuestoLoading(false)
    }
  }

  function updateLiquidarParte(id: string, patch: Partial<LiquidarParteForm>) {
    setLiquidarPartes((current) =>
      current.map((parte) => (parte.id === id ? { ...parte, ...patch } : parte)),
    )
  }

  async function handleLiquidar() {
    if (!user || !admin || liquidating) return

    const partesPayload: Array<{
      tipo: AvMetodoPagoTipo
      valor: number
      cuenta?: string
      detalle?: string
    }> = []

    for (const parte of liquidarPartes) {
      const parteValor = Number(String(parte.valor).replace(/,/g, '').trim())
      if (!Number.isFinite(parteValor) || parteValor <= 0) {
        setLiquidarError('Cada almacenamiento debe tener un valor mayor a 0.')
        return
      }
      if (parte.tipo === 'cuenta_bancaria' && !parte.cuenta.trim()) {
        setLiquidarError('Indica la cuenta / transferencia para esa parte.')
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
      setLiquidarError('Indica de qué almacenamientos sale el presupuesto.')
      return
    }

    const suma = partesPayload.reduce((sum, parte) => sum + parte.valor, 0)
    if (Math.abs(suma - pendienteTotal) > 0.0001) {
      setLiquidarError(
        `La suma (${formatCop(suma)}) debe coincidir con el total a liquidar (${formatCop(pendienteTotal)}).`,
      )
      return
    }

    setLiquidating(true)
    setLiquidarError('')
    try {
      const token = await user.getIdToken()
      const { administrador, liquidacion } = await liquidarAdministradorGanancias(
        token,
        admin.uid,
        {
          partes: partesPayload,
          beneficiarioNombre: admin.nombre || admin.email || undefined,
        },
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
        `Se liquidó la nómina por ${formatCop(liquidacion.monto)} y se descontó el presupuesto (${liquidacion.metodoPago || 'varios almacenamientos'}).`,
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
                onClick={() => void openLiquidarModal()}
              >
                <Banknote size={18} strokeWidth={2} aria-hidden />
                Liquidar nómina
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
                        {item.metodoPago ? ` · ${item.metodoPago}` : ''}
                      </span>
                      <strong>{formatCop(item.monto)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="admin-ganancia-ledger" aria-label="Ventas del administrador">
              <div className="admin-ganancia-ledger-head">
                <div>
                  <p className="dashboard-eyebrow">Comercial</p>
                  <h2>Ventas registradas</h2>
                </div>
                <strong>
                  {ventas.length} ·{' '}
                  {formatCop(ventas.reduce((sum, item) => sum + (item.cotizacionSubtotal || 0), 0))}
                </strong>
              </div>
              {ventas.length === 0 ? (
                <p className="admin-ganancia-empty">
                  Aún no hay ventas asignadas a este administrador.
                </p>
              ) : (
                <div className="admin-ganancia-table-wrap">
                  <table className="admin-ganancia-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Cotización</th>
                        <th>Pago</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventas.map((venta) => (
                        <tr key={venta.id}>
                          <td>{formatFecha(venta.creadoEn)}</td>
                          <td>
                            <span>{venta.clienteNombre || '—'}</span>
                            {venta.clienteDocumento ? (
                              <small>Doc. {venta.clienteDocumento}</small>
                            ) : null}
                          </td>
                          <td>{venta.cotizacionNumero || '—'}</td>
                          <td>
                            {venta.metodoPagoTipo === 'efectivo'
                              ? 'Efectivo'
                              : venta.metodoPagoTipo === 'cuenta_bancaria'
                                ? venta.metodoPagoCuenta
                                  ? `Transferencia · ${venta.metodoPagoCuenta}`
                                  : 'Transferencia'
                                : venta.metodoPago || '—'}
                          </td>
                          <td>{formatCop(venta.cotizacionSubtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

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
                              const locked =
                                esProyectoAudiovisual(proyecto.id) && accion.id === 'av_crm'
                              const mode = locked ? 'manage' : (modes[accion.id] ?? 'none')
                              return (
                                <div key={accion.id} className="admin-capability-row">
                                  <span className="admin-capability-label">
                                    {accion.label}
                                    {locked ? ' (base)' : ''}
                                  </span>
                                  <div className="admin-capability-modes">
                                    <label>
                                      <input
                                        type="radio"
                                        name={`cap-${proyecto.id}-${accion.id}`}
                                        checked={mode === 'none'}
                                        onChange={() =>
                                          setCapabilityMode(proyecto.id, accion.id, 'none')
                                        }
                                        disabled={saving || locked}
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
                                        disabled={saving || locked}
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
                                        disabled={saving || locked}
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
              <h2 id="liquidar-ganancias-title">Liquidar nómina</h2>
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
              Se pagará a {admin.nombre || admin.email} el acumulado actual. Indica de qué
              almacenamientos de presupuesto sale el pago (efectivo, transferencia, Wompi…). La
              suma debe coincidir con el total y se descontará de cada caja.
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

            <section className="av-pago-partes liquidar-presupuesto">
              <div className="av-pago-partes-head">
                <h3>Presupuesto de salida</h3>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setLiquidarPartes((current) => [...current, newLiquidarParte()])
                  }
                  disabled={liquidating}
                >
                  <Plus size={14} strokeWidth={2} aria-hidden />
                  Dividir
                </button>
              </div>

              {presupuestoLoading ? (
                <p className="section-note">Cargando disponible por almacenamiento…</p>
              ) : (
                <ul className="liquidar-presupuesto-saldos">
                  {(presupuesto.porMetodo || []).map((item) => (
                    <li key={item.tipo}>
                      <span>{item.label}</span>
                      <strong>{formatCop(item.disponible)}</strong>
                    </li>
                  ))}
                </ul>
              )}

              {liquidarPartes.map((parte, index) => (
                <div key={parte.id} className="av-pago-parte">
                  <div className="av-pago-parte-grid">
                    <label className="login-field" htmlFor={`liq-tipo-${parte.id}`}>
                      Almacenamiento {liquidarPartes.length > 1 ? index + 1 : ''}
                      <select
                        id={`liq-tipo-${parte.id}`}
                        value={parte.tipo}
                        onChange={(event) =>
                          updateLiquidarParte(parte.id, {
                            tipo: event.target.value as AvMetodoPagoTipo,
                          })
                        }
                        disabled={liquidating}
                      >
                        {(Object.keys(METODO_PAGO_LABEL) as AvMetodoPagoTipo[]).map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {METODO_PAGO_LABEL[tipo]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="login-field" htmlFor={`liq-valor-${parte.id}`}>
                      Valor
                      <input
                        id={`liq-valor-${parte.id}`}
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="1"
                        value={parte.valor}
                        onChange={(event) =>
                          updateLiquidarParte(parte.id, { valor: event.target.value })
                        }
                        disabled={liquidating}
                        required
                      />
                    </label>
                    {parte.tipo === 'cuenta_bancaria' ? (
                      <label
                        className="login-field av-ingresos-span-2"
                        htmlFor={`liq-cuenta-${parte.id}`}
                      >
                        Cuenta / transferencia
                        <input
                          id={`liq-cuenta-${parte.id}`}
                          type="text"
                          value={parte.cuenta}
                          onChange={(event) =>
                            updateLiquidarParte(parte.id, { cuenta: event.target.value })
                          }
                          placeholder="Bancolombia ahorros…"
                          disabled={liquidating}
                        />
                      </label>
                    ) : null}
                    {parte.tipo === 'pasarela' ? (
                      <label
                        className="login-field av-ingresos-span-2"
                        htmlFor={`liq-pasarela-${parte.id}`}
                      >
                        Pasarela
                        <input
                          id={`liq-pasarela-${parte.id}`}
                          type="text"
                          value={parte.detalle}
                          onChange={(event) =>
                            updateLiquidarParte(parte.id, { detalle: event.target.value })
                          }
                          placeholder="Wompi"
                          disabled={liquidating}
                        />
                      </label>
                    ) : null}
                  </div>
                  {liquidarPartes.length > 1 ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setLiquidarPartes((current) =>
                          current.filter((item) => item.id !== parte.id),
                        )
                      }
                      disabled={liquidating}
                      aria-label="Quitar parte"
                    >
                      <Trash2 size={14} strokeWidth={2} aria-hidden />
                    </button>
                  ) : null}
                </div>
              ))}
            </section>

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
                    Liquidar y descontar
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
