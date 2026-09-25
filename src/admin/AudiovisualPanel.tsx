import { useEffect, useMemo, useState } from 'react'
import type { AdminAccion, ProyectoAccesoConfig } from '../api/administradores'
import { useAuth } from '../contexts/AuthContext'
import { Banknote, Bell, Coins, FileText, Key, Layers, MessageCircle, Package, User, Users, Video } from '../icons'
import { AvAccesosPanel } from './AvAccesosPanel'
import { AvClientesPanel } from './AvClientesPanel'
import { AvCotizacionesPanel } from './AvCotizacionesPanel'
import { AvCreditosPanel } from './AvCreditosPanel'
import { AvCrmPanel } from './AvCrmPanel'
import { AvEgresosPanel } from './AvEgresosPanel'
import { AvEmpresaGenioForm } from './AvEmpresaGenioForm'
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
  { id: 'finanzas', label: 'Finanzas', icon: Banknote, action: 'av_finanzas' },
  { id: 'planes', label: 'Planes', icon: Layers, action: 'av_planes' },
  { id: 'equipos', label: 'Equipos', icon: Package, action: 'av_equipos' },
  { id: 'clientes', label: 'Clientes', icon: Users, action: 'av_clientes' },
  { id: 'accesos', label: 'Accesos', icon: Key, action: 'av_accesos', shared: true },
  { id: 'creditos', label: 'Créditos', icon: Coins, action: 'av_creditos' },
  { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText, action: 'av_cotizaciones' },
  { id: 'crm', label: 'CRM', icon: MessageCircle, action: 'av_crm' },
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

function canViewAvTab(
  access: ProyectoAccesoConfig | null | undefined,
  action: AdminAccion,
): boolean {
  if (!access) return false
  if (access.nivel === 'manage' || access.nivel === 'view') return true
  if (access.nivel === 'custom') {
    return (
      access.acciones.includes(action) || (access.visualizar || []).includes(action)
    )
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
  if (access.nivel === 'custom') return access.acciones.includes(action)
  return false
}

type AudiovisualPanelProps = {
  access?: ProyectoAccesoConfig | null
}

export function AudiovisualPanel({ access = null }: AudiovisualPanelProps) {
  const { isOwner, isAdmin } = useAuth()

  const allowedTabs = useMemo(
    () =>
      TABS.filter((tab) => {
        if (tab.ownerOnly) return isOwner
        if (tab.adminOnly) return isAdmin && !isOwner
        if (tab.shared) return isOwner || Boolean(access)
        if (!tab.action) return false
        return canViewAvTab(access, tab.action)
      }),
    [access, isOwner, isAdmin],
  )

  const [vista, setVista] = useState<AudiovisualVista>(
    () => allowedTabs[0]?.id ?? 'finanzas',
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
  const clientesReadOnly = !canEditAvTab(access, 'av_clientes')
  const creditosReadOnly = !canEditAvTab(access, 'av_creditos')
  const cotizacionesReadOnly = !canEditAvTab(access, 'av_cotizaciones')
  const crmReadOnly = !canEditAvTab(access, 'av_crm')
  const canEditEmpresa = isOwner || canEditAvTab(access, 'av_cotizaciones')

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
          <div className="contable-tabs contable-period-tabs" role="tablist" aria-label="Finanzas">
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

      {vista === 'equipos' ? (
        <div className="audiovisual-placeholder" role="tabpanel" aria-label="Equipos">
          <Package size={28} strokeWidth={1.75} aria-hidden />
          <h3>Equipos</h3>
          <p>Aquí controlaremos inventario, disponibilidad y asignación de equipos.</p>
        </div>
      ) : null}

      {vista === 'clientes' ? <AvClientesPanel readOnly={clientesReadOnly} /> : null}

      {vista === 'accesos' ? <AvAccesosPanel canManage={isOwner} /> : null}

      {vista === 'creditos' ? <AvCreditosPanel readOnly={creditosReadOnly} /> : null}

      {vista === 'cotizaciones' ? (
        <AvCotizacionesPanel readOnly={cotizacionesReadOnly} />
      ) : null}

      {vista === 'crm' ? <AvCrmPanel readOnly={crmReadOnly && !isOwner} /> : null}

      {vista === 'movimientos' && isOwner ? <AvMovimientosPanel /> : null}

      {vista === 'contrato-avisos' && isOwner ? <AvOwnerGestionPanel /> : null}

      {vista === 'mi-perfil' && isAdmin && !isOwner ? (
        <AvMiPerfilPanel access={access} />
      ) : null}
    </section>
  )
}
