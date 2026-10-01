import { Fragment, useEffect, useState } from 'react'
import {
  ADMIN_ACCIONES_AUDIOVISUAL,
  formatCop,
  getAdministradorGanancias,
  liquidarAdministradorGanancias,
  type AdminAccion,
  type GananciaMovimiento,
} from '../api/administradores'
import {
  getAvFinanzasResumen,
  listAvAdministradoresProyecto,
  saveAvCrmVendedorAccesos,
  updateAvAdministradorRol,
  type AvAdministradorProyecto,
  type AvFinanzasResumen,
  type AvMetodoPagoTipo,
} from '../api/audiovisual'
import { esProyectoAudiovisual } from '../api/proyectos'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Banknote,
  ChevronDown,
  LoaderCircle,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  X,
} from '../icons'

type CapabilityMode = 'none' | 'view' | 'manage'

const STAFF_TABS = ADMIN_ACCIONES_AUDIOVISUAL

function emptyModes(): Record<AdminAccion, CapabilityMode> {
  const modes = {} as Record<AdminAccion, CapabilityMode>
  for (const tab of STAFF_TABS) modes[tab.id] = 'none'
  modes.av_crm = 'manage'
  return modes
}

function modesFromItem(item: AvAdministradorProyecto): Record<AdminAccion, CapabilityMode> {
  const modes = emptyModes()
  const accesos = item.accesos || {}
  for (const [key, value] of Object.entries(accesos)) {
    if (!esProyectoAudiovisual(key)) continue
    if (value.nivel === 'manage') {
      for (const tab of STAFF_TABS) modes[tab.id] = 'manage'
      break
    }
    if (value.nivel === 'view') {
      for (const tab of STAFF_TABS) modes[tab.id] = 'view'
      modes.av_crm = 'manage'
      break
    }
    for (const id of value.acciones || []) {
      if (modes[id as AdminAccion] !== undefined) modes[id as AdminAccion] = 'manage'
    }
    for (const id of value.visualizar || []) {
      if (modes[id as AdminAccion] === 'none') modes[id as AdminAccion] = 'view'
    }
  }
  modes.av_crm = 'manage'
  return modes
}

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

export function AvAdministradoresPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<AvAdministradorProyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [savingUid, setSavingUid] = useState('')
  const [expandedUid, setExpandedUid] = useState<string | null>(null)
  const [draftModes, setDraftModes] = useState<Record<AdminAccion, CapabilityMode>>(emptyModes)
  const [permisosSaving, setPermisosSaving] = useState(false)

  const [liquidarTarget, setLiquidarTarget] = useState<AvAdministradorProyecto | null>(null)
  const [movimientos, setMovimientos] = useState<GananciaMovimiento[]>([])
  const [pendienteTotal, setPendienteTotal] = useState(0)
  const [liquidarPartes, setLiquidarPartes] = useState<LiquidarParteForm[]>([
    newLiquidarParte({ valor: '' }),
  ])
  const [presupuesto, setPresupuesto] = useState<AvFinanzasResumen>(EMPTY_RESUMEN)
  const [presupuestoLoading, setPresupuestoLoading] = useState(false)
  const [liquidating, setLiquidating] = useState(false)
  const [liquidarError, setLiquidarError] = useState('')
  const [liquidarLoading, setLiquidarLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load(silent = false) {
      if (!user) return
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const token = await user.getIdToken()
        const data = await listAvAdministradoresProyecto(token)
        if (!cancelled) setItems(data)
      } catch (err) {
        if (!cancelled && !silent) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el equipo de El Genio',
          )
          setItems([])
        }
      } finally {
        if (!cancelled && !silent) setLoading(false)
      }
    }
    void load(refreshTick > 0)
    return () => {
      cancelled = true
    }
  }, [user, refreshTick])

  // Actualización en vivo de comisiones pendientes.
  useEffect(() => {
    if (!user) return
    const timer = window.setInterval(() => {
      setRefreshTick((n) => n + 1)
    }, 12000)
    return () => window.clearInterval(timer)
  }, [user])

  async function handleChangeRol(
    item: AvAdministradorProyecto,
    rol: 'admin' | 'vendedor',
  ) {
    if (!user || savingUid || item.proyectoRol === rol) return
    setSavingUid(item.uid)
    setError('')
    setSuccess('')
    try {
      const token = await user.getIdToken()
      const updated = await updateAvAdministradorRol(token, item.uid, rol)
      setItems((current) =>
        current
          .map((row) => (row.uid === updated.uid ? { ...row, ...updated } : row))
          .sort((a, b) => {
            if (a.proyectoRol !== b.proyectoRol) {
              return a.proyectoRol === 'admin' ? -1 : 1
            }
            return String(a.nombre || a.email || '').localeCompare(
              String(b.nombre || b.email || ''),
              'es',
            )
          }),
      )
      if (expandedUid === item.uid) {
        setDraftModes(modesFromItem({ ...item, ...updated }))
      }
      setSuccess(
        `Rol en El Genio actualizado: ${updated.nombre || updated.email} → ${
          updated.proyectoRol === 'admin' ? 'Administrador' : 'Vendedor'
        }`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el rol')
    } finally {
      setSavingUid('')
    }
  }

  function togglePermisos(item: AvAdministradorProyecto) {
    if (expandedUid === item.uid) {
      setExpandedUid(null)
      return
    }
    setExpandedUid(item.uid)
    setDraftModes(modesFromItem(item))
    setError('')
  }

  function setCapabilityMode(accion: AdminAccion, mode: CapabilityMode) {
    if (accion === 'av_crm') return
    setDraftModes((current) => ({ ...current, [accion]: mode }))
  }

  async function handleSavePermisos(item: AvAdministradorProyecto) {
    if (!user || permisosSaving) return
    setPermisosSaving(true)
    setError('')
    setSuccess('')
    try {
      const acciones: AdminAccion[] = []
      const visualizar: AdminAccion[] = []
      for (const tab of STAFF_TABS) {
        const mode = draftModes[tab.id] ?? 'none'
        if (tab.id === 'av_crm' || mode === 'manage') acciones.push(tab.id)
        else if (mode === 'view') visualizar.push(tab.id)
      }
      if (!acciones.includes('av_crm')) acciones.push('av_crm')

      const token = await user.getIdToken()
      const updated = await saveAvCrmVendedorAccesos(token, item.uid, acciones, visualizar)
      setItems((current) =>
        current.map((row) =>
          row.uid === item.uid
            ? {
                ...row,
                accesos: updated.accesos,
              }
            : row,
        ),
      )
      setDraftModes(
        modesFromItem({
          ...item,
          accesos: updated.accesos,
        }),
      )
      setSuccess(`Permisos actualizados para ${item.nombre || item.email}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los permisos')
    } finally {
      setPermisosSaving(false)
    }
  }

  async function openLiquidar(item: AvAdministradorProyecto) {
    if (!user || liquidating) return
    setLiquidarTarget(item)
    setLiquidarError('')
    setLiquidarLoading(true)
    setMovimientos([])
    setPendienteTotal(0)
    try {
      const token = await user.getIdToken()
      const [ganancias, resumen] = await Promise.all([
        getAdministradorGanancias(token, item.uid, { origen: 'venta' }),
        getAvFinanzasResumen(token).catch(() => EMPTY_RESUMEN),
      ])
      setMovimientos(ganancias.pendiente.movimientos)
      setPendienteTotal(ganancias.pendiente.total)
      setPresupuesto(resumen)
      setLiquidarPartes([
        newLiquidarParte({
          valor: ganancias.pendiente.total > 0 ? String(ganancias.pendiente.total) : '',
        }),
      ])
    } catch (err) {
      setLiquidarError(
        err instanceof Error ? err.message : 'No se pudieron cargar las comisiones',
      )
      setPresupuesto(EMPTY_RESUMEN)
    } finally {
      setLiquidarLoading(false)
      setPresupuestoLoading(false)
    }
  }

  function closeLiquidar() {
    if (liquidating) return
    setLiquidarTarget(null)
    setLiquidarError('')
    setMovimientos([])
  }

  function updateLiquidarParte(id: string, patch: Partial<LiquidarParteForm>) {
    setLiquidarPartes((current) =>
      current.map((parte) => (parte.id === id ? { ...parte, ...patch } : parte)),
    )
  }

  async function handleLiquidar() {
    if (!user || !liquidarTarget || liquidating) return
    if (pendienteTotal <= 0) {
      setLiquidarError('No hay comisiones pendientes.')
      return
    }

    const partesPayload: Array<{
      tipo: AvMetodoPagoTipo
      valor: number
      cuenta?: string
      detalle?: string
    }> = []

    for (const parte of liquidarPartes) {
      const valor = Number(String(parte.valor).replace(/,/g, '').trim())
      if (!Number.isFinite(valor) || valor <= 0) {
        setLiquidarError('Cada parte debe tener un valor mayor a 0.')
        return
      }
      if (parte.tipo === 'cuenta_bancaria' && !parte.cuenta.trim()) {
        setLiquidarError('Indica la cuenta bancaria.')
        return
      }
      partesPayload.push({
        tipo: parte.tipo,
        valor,
        cuenta: parte.tipo === 'cuenta_bancaria' ? parte.cuenta.trim() : undefined,
        detalle: parte.tipo === 'pasarela' ? parte.detalle.trim() || undefined : undefined,
      })
    }

    const suma = partesPayload.reduce((sum, parte) => sum + parte.valor, 0)
    if (Math.abs(suma - pendienteTotal) > 0.0001) {
      setLiquidarError(
        `La suma (${formatCop(suma)}) debe coincidir con el pendiente (${formatCop(pendienteTotal)}).`,
      )
      return
    }

    setLiquidating(true)
    setLiquidarError('')
    try {
      const token = await user.getIdToken()
      const result = await liquidarAdministradorGanancias(token, liquidarTarget.uid, {
        partes: partesPayload,
        beneficiarioNombre: liquidarTarget.nombre || liquidarTarget.email || undefined,
        origen: 'venta',
      })
      setItems((current) =>
        current.map((row) =>
          row.uid === liquidarTarget.uid
            ? {
                ...row,
                comisionVentasPendiente: result.administrador.comisionVentasPendiente || 0,
                gananciaTotal: result.administrador.gananciaTotal,
              }
            : row,
        ),
      )
      setSuccess(
        `Se liquidaron ${formatCop(pendienteTotal)} a ${
          liquidarTarget.nombre || liquidarTarget.email
        }. Pendiente reiniciado.`,
      )
      closeLiquidar()
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setLiquidarError(err instanceof Error ? err.message : 'No se pudo liquidar')
    } finally {
      setLiquidating(false)
    }
  }

  return (
    <div className="av-admins-proyecto" role="tabpanel" aria-label="Administradores El Genio">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Administradores y vendedores</h3>
          <p className="section-note">
            Cada venta acredita 10% al vendedor. Personaliza qué pestañas puede solo ver o
            gestionar, y liquida comisiones pendientes.
          </p>
        </div>
        <div className="av-ingresos-toolbar-actions">
          <button
            type="button"
            className="btn-secondary contable-refresh"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading || Boolean(savingUid)}
          >
            <RefreshCw
              size={16}
              strokeWidth={2}
              aria-hidden
              className={loading ? 'spin' : undefined}
            />
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando equipo...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && success ? (
        <div className="proyectos-status" role="status">
          <Shield size={18} strokeWidth={2} aria-hidden />
          {success}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="proyectos-empty">
          <Users size={28} strokeWidth={1.75} aria-hidden />
          <p>
            No hay administradores ni vendedores con El Genio asignado. Asigna el proyecto desde
            Administradores o créalos en CRM → Equipo.
          </p>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Cédula</th>
                <th>Rol en El Genio</th>
                <th>Comisión pendiente</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const pendiente = Number(item.comisionVentasPendiente) || 0
                const expanded = expandedUid === item.uid
                return (
                  <Fragment key={item.uid}>
                    <tr className={expanded ? 'av-admins-row-expanded' : undefined}>
                      <td>
                        <strong>{item.nombre || 'Sin nombre'}</strong>
                        <div className="section-note">{item.email || '—'}</div>
                      </td>
                      <td>{item.cedula || '—'}</td>
                      <td>
                        <div
                          className="av-admins-rol-switch"
                          role="group"
                          aria-label="Rol en El Genio"
                        >
                          <button
                            type="button"
                            className={
                              item.proyectoRol === 'admin'
                                ? 'av-admins-rol-btn is-active is-admin'
                                : 'av-admins-rol-btn'
                            }
                            disabled={Boolean(savingUid) || permisosSaving}
                            onClick={() => void handleChangeRol(item, 'admin')}
                          >
                            Administrador
                          </button>
                          <button
                            type="button"
                            className={
                              item.proyectoRol === 'vendedor'
                                ? 'av-admins-rol-btn is-active is-vendedor'
                                : 'av-admins-rol-btn'
                            }
                            disabled={Boolean(savingUid) || permisosSaving}
                            onClick={() => void handleChangeRol(item, 'vendedor')}
                          >
                            Vendedor
                          </button>
                        </div>
                      </td>
                      <td>
                        <strong>{formatCop(pendiente)}</strong>
                        <div className="section-note">10% de ventas</div>
                      </td>
                      <td>
                        <div className="av-admins-row-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            aria-expanded={expanded}
                            disabled={Boolean(savingUid) || permisosSaving}
                            onClick={() => togglePermisos(item)}
                          >
                            <ChevronDown
                              size={14}
                              strokeWidth={2}
                              aria-hidden
                              className={expanded ? 'av-admins-chevron is-open' : 'av-admins-chevron'}
                            />
                            Permisos
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={pendiente <= 0 || Boolean(savingUid) || permisosSaving}
                            onClick={() => void openLiquidar(item)}
                          >
                            <Banknote size={14} strokeWidth={2} aria-hidden />
                            Liquidar
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="av-admins-permisos-row">
                        <td colSpan={5}>
                          <div className="av-admins-permisos-panel">
                            <p className="section-note">
                              Define por pestaña si puede gestionar, solo visualizar o no tiene
                              acceso. CRM siempre queda en gestionar.
                            </p>
                            <div className="av-admins-permisos-list">
                              {STAFF_TABS.map((tab) => {
                                const mode = draftModes[tab.id] ?? 'none'
                                const locked = tab.id === 'av_crm'
                                return (
                                  <div key={tab.id} className="admin-capability-row">
                                    <span className="admin-capability-label">
                                      {tab.label}
                                      {locked ? ' (base)' : ''}
                                    </span>
                                    <div
                                      className="admin-capability-modes"
                                      role="radiogroup"
                                      aria-label={`Permiso ${tab.label}`}
                                    >
                                      <label>
                                        <input
                                          type="radio"
                                          name={`perm-${item.uid}-${tab.id}`}
                                          checked={mode === 'none'}
                                          disabled={locked || permisosSaving}
                                          onChange={() => setCapabilityMode(tab.id, 'none')}
                                        />
                                        Sin acceso
                                      </label>
                                      <label>
                                        <input
                                          type="radio"
                                          name={`perm-${item.uid}-${tab.id}`}
                                          checked={mode === 'view'}
                                          disabled={locked || permisosSaving}
                                          onChange={() => setCapabilityMode(tab.id, 'view')}
                                        />
                                        Solo visualizar
                                      </label>
                                      <label>
                                        <input
                                          type="radio"
                                          name={`perm-${item.uid}-${tab.id}`}
                                          checked={mode === 'manage'}
                                          disabled={locked || permisosSaving}
                                          onChange={() => setCapabilityMode(tab.id, 'manage')}
                                        />
                                        Puede gestionar
                                      </label>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            <div className="av-admins-permisos-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setExpandedUid(null)}
                                disabled={permisosSaving}
                              >
                                Cerrar
                              </button>
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => void handleSavePermisos(item)}
                                disabled={permisosSaving}
                              >
                                {permisosSaving ? (
                                  <>
                                    <LoaderCircle
                                      className="spin"
                                      size={16}
                                      strokeWidth={2}
                                      aria-hidden
                                    />
                                    Guardando...
                                  </>
                                ) : (
                                  'Guardar permisos'
                                )}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {liquidarTarget ? (
        <div className="modal-overlay" role="presentation" onClick={closeLiquidar}>
          <div
            className="modal-panel modal-panel-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-liquidar-comisiones-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-liquidar-comisiones-title">Liquidar comisiones de ventas</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeLiquidar}
                disabled={liquidating}
                aria-label="Cerrar"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <p className="modal-confirm-text">
              Se pagará a {liquidarTarget.nombre || liquidarTarget.email} las comisiones del 10%
              pendientes. Al confirmar, el pendiente se reinicia a $0.
            </p>

            {liquidarLoading ? (
              <div className="proyectos-status">
                <LoaderCircle className="spin" size={20} strokeWidth={2} aria-hidden />
                Cargando...
              </div>
            ) : (
              <>
                {movimientos.length === 0 ? (
                  <p className="admin-ganancia-empty">No hay comisiones pendientes.</p>
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
                    <p className="section-note">Cargando disponible…</p>
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
                        <label className="login-field" htmlFor={`av-liq-tipo-${parte.id}`}>
                          Almacenamiento {liquidarPartes.length > 1 ? index + 1 : ''}
                          <select
                            id={`av-liq-tipo-${parte.id}`}
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
                        <label className="login-field" htmlFor={`av-liq-valor-${parte.id}`}>
                          Valor
                          <input
                            id={`av-liq-valor-${parte.id}`}
                            inputMode="decimal"
                            value={parte.valor}
                            onChange={(event) =>
                              updateLiquidarParte(parte.id, { valor: event.target.value })
                            }
                            disabled={liquidating}
                          />
                        </label>
                        {parte.tipo === 'cuenta_bancaria' ? (
                          <label className="login-field" htmlFor={`av-liq-cuenta-${parte.id}`}>
                            Cuenta
                            <input
                              id={`av-liq-cuenta-${parte.id}`}
                              value={parte.cuenta}
                              onChange={(event) =>
                                updateLiquidarParte(parte.id, { cuenta: event.target.value })
                              }
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
                              current.filter((row) => row.id !== parte.id),
                            )
                          }
                          disabled={liquidating}
                        >
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  ))}
                </section>
              </>
            )}

            {liquidarError ? (
              <p className="login-error" role="alert">
                <AlertCircle size={16} strokeWidth={2} aria-hidden />
                {liquidarError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeLiquidar}
                disabled={liquidating}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleLiquidar()}
                disabled={liquidating || liquidarLoading || pendienteTotal <= 0}
              >
                {liquidating ? (
                  <>
                    <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                    Liquidando...
                  </>
                ) : (
                  <>
                    <Banknote size={16} strokeWidth={2} aria-hidden />
                    Confirmar liquidación
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
