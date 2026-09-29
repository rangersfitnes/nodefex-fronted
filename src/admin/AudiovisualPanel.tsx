import { useEffect, useMemo, useState } from 'react'
import type { AdminAccion, ProyectoAccesoConfig } from '../api/administradores'
import { esProyectoAudiovisual } from '../api/proyectos'
import { useAuth } from '../contexts/AuthContext'
import { Banknote, Bell, Coins, FileText, Key, Layers, MessageCircle, Package, User, Users, Video } from '../icons'
import { AvAccesosPanel } from './AvAccesosPanel'
import { AvClientesPanel } from './AvClientesPanel'
import { AvCotizacionesPanel } from './AvCotizacionesPanel'
import { AvCreditosPanel } from './AvCreditosPanel'
import { AvCrmPanel } from './AvCrmPanel'
import { AvEgresosPanel } from './AvEgresosPanel'
import { AvEmpresaGenioForm } from './AvEmpresaGenioForm'
import { AvEquiposAsignadosAviso } from './AvEquiposAsignadosAviso'
import { AvEquiposPanel } from './AvEquiposPanel'
import { AvFinanzasPrincipalPanel } from './AvFinanzasPrincipalPanel'
import { AvFacturacionPanel } from './AvFacturacionPanel'
import { AvIngresosPanel } from './AvIngresosPanel'
import { AvMiPerfilPanel } from './AvMiPerfilPanel'
import { AvMovimientosPanel } from './AvMovimientosPanel'
import { AvOwnerGestionPanel } from './AvOwnerGestionPanel'
import { AvPlanesPanel } from './AvPlanesPanel'

type AudiovisualVista =
  | 'finanzas'
  | 'planes'
  | 'equipos'
  | 'clientes'
  | 'accesos'
  | 'creditos'
  | 'cotizaciones'
  | 'crm'
  | 'movimientos'
  | 'mi-perfil'
  | 'contrato-avisos'
type FinanzasSubvista = 'principal' | 'ingresos' | 'facturacion' | 'egresos'

const TABS: {
  id: AudiovisualVista
  label: string
  icon: typeof Banknote
  action: AdminAccion | null
  ownerOnly?: boolean
  adminOnly?: boolean
  shared?: boolean
}[] = [
  // CRM primero: admins con muchas pestañas no lo pierden fuera del scroll.
  { id: 'crm', label: 'CRM', icon: MessageCircle, action: 'av_crm' },
  { id: 'clientes', label: 'Clientes', icon: Users, action: 'av_clientes' },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText, action: 'av_cotizaciones' },
  { id: 'finanzas', label: 'Finanzas', icon: Banknote, action: 'av_finanzas' },
  { id: 'planes', label: 'Planes', icon: Layers, action: 'av_planes' },
  { id: 'equipos', label: 'Equipos', icon: Package, action: 'av_equipos' },
  { id: 'creditos', label: 'Servicios', icon: Coins, action: 'av_creditos' },
  { id: 'accesos', label: 'Accesos', icon: Key, action: 'av_accesos', shared: true },
  {
    id: 'movimientos',
    label: 'Movimientos',
    icon: FileText,
    action: null,
    ownerOnly: true,
  },
  {
    id: 'contrato-avisos',
    label: 'Contrato y avisos',
    icon: Bell,
    action: null,
    ownerOnly: true,
  },
  {
    id: 'mi-perfil',
    label: 'Mi perfil',
    icon: User,
    action: null,
    adminOnly: true,
  },
]

function asAdminAcciones(raw: unknown): AdminAccion[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is AdminAccion => typeof item === 'string' && item.length > 0)
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw).filter(
      (item): item is AdminAccion => typeof item === 'string' && item.length > 0,
    )
  }
  return []
}

function mergeAvAccess(
  a: ProyectoAccesoConfig | null | undefined,
  b: ProyectoAccesoConfig | null | undefined,
): ProyectoAccesoConfig | null {
  if (!a) return b ?? null
  if (!b) return a
  if (a.nivel === 'manage' || b.nivel === 'manage') {
    return { nivel: 'manage', acciones: [], visualizar: [] }
  }
  if (a.nivel === 'view' || b.nivel === 'view') {
    return { nivel: 'view', acciones: [], visualizar: [] }
  }

  const acciones = Array.from(
    new Set([...asAdminAcciones(a.acciones), ...asAdminAcciones(b.acciones)]),
  )
  const visualizar = Array.from(
    new Set([...asAdminAcciones(a.visualizar), ...asAdminAcciones(b.visualizar)]),
  ).filter((item) => !acciones.includes(item))

  if (acciones.length === 0 && visualizar.length === 0) {
    return { nivel: 'view', acciones: [], visualizar: [] }
  }
  return { nivel: 'custom', acciones, visualizar }
}

function canViewAvTab(
  access: ProyectoAccesoConfig | null | undefined,
  action: AdminAccion,
): boolean {
  if (!access) return false
  if (access.nivel === 'manage' || access.nivel === 'view') return true
  if (access.nivel === 'custom') {
    const acciones = asAdminAcciones(access.acciones)
    const visualizar = asAdminAcciones(access.visualizar)
    return acciones.includes(action) || visualizar.includes(action)
  }
  return false
}

function canEditAvTab(
  access: ProyectoAccesoConfig | null | undefined,
  action: AdminAccion,
): boolean {
  if (!access) return false
  if (access.nivel === 'manage') return true
  if (access.nivel === 'view') return false
  if (access.nivel === 'custom') {
    return asAdminAcciones(access.acciones).includes(action)
  }
  return false
}

type AudiovisualPanelProps = {
  access?: ProyectoAccesoConfig | null
  proyectoId?: string | null
}

export function AudiovisualPanel({
  access: accessProp = null,
  proyectoId = null,
}: AudiovisualPanelProps) {
  const { isOwner, isAdmin, isVendedor, user, administrador, getProjectAccess } = useAuth()

  // Unir prop + todas las claves AV del perfil (evita perder av_crm por alias duplicado).
  const access = useMemo(() => {
    if (administrador?.rol === 'owner') {
      return { nivel: 'manage' as const, acciones: [], visualizar: [] }
    }

    let merged: ProyectoAccesoConfig | null = accessProp ?? null

    if (proyectoId) {
      merged = mergeAvAccess(merged, getProjectAccess(proyectoId))
    }

    const accesos = administrador?.accesos || {}
    for (const [key, value] of Object.entries(accesos)) {
      if (!esProyectoAudiovisual(key)) continue
      merged = mergeAvAccess(merged, value)
    }

    if (!merged) {
      merged =
        getProjectAccess('nodefex audio visual') ||
        getProjectAccess('nodefex-audio-visual') ||
        null
    }

    return merged
  }, [accessProp, administrador, getProjectAccess, proyectoId])

  const allowedTabs = useMemo(
    () =>
      TABS.filter((tab) => {
        if (tab.ownerOnly) return isOwner
        if (tab.adminOnly) return isAdmin && !isOwner
        // Accesos: solo quien tiene av_accesos / view / manage (no inflar la barra).
        if (tab.shared) return isOwner || canViewAvTab(access, 'av_accesos')
        if (!tab.action) return false
        return canViewAvTab(access, tab.action)
      }),
    [access, isOwner, isAdmin],
  )

  const [vista, setVista] = useState<AudiovisualVista>(
    () => allowedTabs[0]?.id ?? 'crm',
  )
  const [finanzasVista, setFinanzasVista] = useState<FinanzasSubvista>('principal')

  useEffect(() => {
    if (allowedTabs.length === 0) return
    if (!allowedTabs.some((tab) => tab.id === vista)) {
      setVista(allowedTabs[0].id)
    }
  }, [allowedTabs, vista])

  const finanzasReadOnly = !canEditAvTab(access, 'av_finanzas')
  const planesReadOnly = !canEditAvTab(access, 'av_planes')
  const equiposReadOnly = !canEditAvTab(access, 'av_equipos')
  const clientesReadOnly = !canEditAvTab(access, 'av_clientes')
  const creditosReadOnly = !canEditAvTab(access, 'av_creditos')
  const cotizacionesReadOnly = !canEditAvTab(access, 'av_cotizaciones')
  const crmReadOnly = !canEditAvTab(access, 'av_crm')
  const canEditEmpresa = isOwner || canEditAvTab(access, 'av_cotizaciones')
  const showEquiposAviso = Boolean(user) && (isAdmin || isOwner || isVendedor || Boolean(access))
  const hasCrmTab = allowedTabs.some((tab) => tab.id === 'crm')

  if (allowedTabs.length === 0) {
    return (
      <section className="usuarios-section audiovisual-panel" aria-label="Nodefex Audio Visual">
        <div className="section-heading">
          <Video size={18} strokeWidth={2} aria-hidden />
          <h2>Nodefex Audio Visual</h2>
        </div>
        <div className="proyectos-empty">
          <Package size={28} strokeWidth={1.75} aria-hidden />
          <p>No tienes pestañas asignadas en este proyecto. Pide al owner que personalice tu acceso.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="usuarios-section audiovisual-panel" aria-label="Nodefex Audio Visual">
      <div className="section-heading">
        <Video size={18} strokeWidth={2} aria-hidden />
        <h2>Nodefex Audio Visual</h2>
      </div>
      <p className="section-note">
        Panel de operación de Nodefex Audio Visual. Elige una pestaña para gestionar cada área.
      </p>

      <AvEmpresaGenioForm canEdit={canEditEmpresa} />

      {showEquiposAviso ? (
        <AvEquiposAsignadosAviso
          onGoEquipos={
            allowedTabs.some((tab) => tab.id === 'equipos')
              ? () => setVista('equipos')
              : undefined
          }
        />
      ) : null}

      <div
        className="contable-tabs contable-page-tabs"
        role="tablist"
        aria-label="Secciones Nodefex Audio Visual"
      >
        {allowedTabs.map((tab) => {
          const Icon = tab.icon
          const readOnlyTab = tab.action ? !canEditAvTab(access, tab.action) : false
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={vista === tab.id}
              className={vista === tab.id ? 'is-active' : ''}
              onClick={() => setVista(tab.id)}
            >
              <Icon size={16} strokeWidth={2} aria-hidden />
              {tab.label}
              {readOnlyTab && !tab.ownerOnly ? (
                <span className="av-tab-readonly">Solo ver</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {vista === 'finanzas' ? (
        <div className="av-finanzas" role="tabpanel" aria-label="Finanzas">
          {finanzasReadOnly ? (
            <p className="section-note av-readonly-banner">
              Modo solo visualización: puedes consultar, pero no crear ni editar movimientos.
            </p>
          ) : null}
          <div
            className="contable-tabs contable-period-tabs"
            role="tablist"
            aria-label="Subsecciones de finanzas"
          >
            <button
              type="button"
              role="tab"
              aria-selected={finanzasVista === 'principal'}
              className={finanzasVista === 'principal' ? 'is-active' : ''}
              onClick={() => setFinanzasVista('principal')}
            >
              Principal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={finanzasVista === 'ingresos'}
              className={finanzasVista === 'ingresos' ? 'is-active' : ''}
              onClick={() => setFinanzasVista('ingresos')}
            >
              Ingresos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={finanzasVista === 'egresos'}
              className={finanzasVista === 'egresos' ? 'is-active' : ''}
              onClick={() => setFinanzasVista('egresos')}
            >
              Egresos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={finanzasVista === 'facturacion'}
              className={finanzasVista === 'facturacion' ? 'is-active' : ''}
              onClick={() => setFinanzasVista('facturacion')}
            >
              Facturación
            </button>
          </div>

          {finanzasVista === 'principal' ? <AvFinanzasPrincipalPanel /> : null}
          {finanzasVista === 'ingresos' ? <AvIngresosPanel readOnly={finanzasReadOnly} /> : null}
          {finanzasVista === 'egresos' ? <AvEgresosPanel readOnly={finanzasReadOnly} /> : null}
          {finanzasVista === 'facturacion' ? (
            <AvFacturacionPanel readOnly={finanzasReadOnly} />
          ) : null}
        </div>
      ) : null}

      {vista === 'planes' ? <AvPlanesPanel readOnly={planesReadOnly} /> : null}

      {vista === 'equipos' ? <AvEquiposPanel readOnly={equiposReadOnly} /> : null}

      {vista === 'clientes' ? <AvClientesPanel readOnly={clientesReadOnly} /> : null}

      {vista === 'accesos' ? <AvAccesosPanel canManage={isOwner} /> : null}

      {vista === 'creditos' ? <AvCreditosPanel readOnly={creditosReadOnly} /> : null}

      {vista === 'cotizaciones' ? (
        <AvCotizacionesPanel readOnly={cotizacionesReadOnly} />
      ) : null}

      {vista === 'crm' && hasCrmTab ? <AvCrmPanel readOnly={crmReadOnly && !isOwner} /> : null}

      {vista === 'movimientos' && isOwner ? <AvMovimientosPanel /> : null}

      {vista === 'contrato-avisos' && isOwner ? <AvOwnerGestionPanel /> : null}

      {vista === 'mi-perfil' && isAdmin && !isOwner ? (
        <AvMiPerfilPanel access={access} />
      ) : null}
    </section>
  )
}
