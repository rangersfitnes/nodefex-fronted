import { useEffect, useMemo, useState } from 'react'
import type { AdminAccion, ProyectoAccesoConfig } from '../api/administradores'
import { Banknote, Layers, Package, Users, Video } from '../icons'
import { AvClientesPanel } from './AvClientesPanel'
import { AvEgresosPanel } from './AvEgresosPanel'
import { AvFinanzasPrincipalPanel } from './AvFinanzasPrincipalPanel'
import { AvFacturacionPanel } from './AvFacturacionPanel'
import { AvIngresosPanel } from './AvIngresosPanel'
import { AvPlanesPanel } from './AvPlanesPanel'

type AudiovisualVista = 'finanzas' | 'planes' | 'equipos' | 'clientes'
type FinanzasSubvista = 'principal' | 'ingresos' | 'facturacion' | 'egresos'

const TABS: {
  id: AudiovisualVista
  label: string
  icon: typeof Banknote
  action: AdminAccion
}[] = [
  { id: 'finanzas', label: 'Finanzas', icon: Banknote, action: 'av_finanzas' },
  { id: 'planes', label: 'Planes', icon: Layers, action: 'av_planes' },
  { id: 'equipos', label: 'Equipos', icon: Package, action: 'av_equipos' },
  { id: 'clientes', label: 'Clientes', icon: Users, action: 'av_clientes' },
]

function canAccessAvTab(
  access: ProyectoAccesoConfig | null | undefined,
  action: AdminAccion,
): boolean {
  if (!access) return false
  if (access.nivel === 'manage' || access.nivel === 'view') return true
  if (access.nivel === 'custom') return access.acciones.includes(action)
  return false
}

type AudiovisualPanelProps = {
  access?: ProyectoAccesoConfig | null
}

export function AudiovisualPanel({ access = null }: AudiovisualPanelProps) {
  const allowedTabs = useMemo(
    () => TABS.filter((tab) => canAccessAvTab(access, tab.action)),
    [access],
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

      <div
        className="contable-tabs contable-page-tabs"
        role="tablist"
        aria-label="Secciones Nodefex Audio Visual"
      >
        {allowedTabs.map((tab) => {
          const Icon = tab.icon
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
            </button>
          )
        })}
      </div>

      {vista === 'finanzas' ? (
        <div className="av-finanzas" role="tabpanel" aria-label="Finanzas">
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
          {finanzasVista === 'ingresos' ? <AvIngresosPanel /> : null}
          {finanzasVista === 'egresos' ? <AvEgresosPanel /> : null}
          {finanzasVista === 'facturacion' ? <AvFacturacionPanel /> : null}
        </div>
      ) : null}

      {vista === 'planes' ? <AvPlanesPanel /> : null}

      {vista === 'equipos' ? (
        <div className="audiovisual-placeholder" role="tabpanel" aria-label="Equipos">
          <Package size={28} strokeWidth={1.75} aria-hidden />
          <h3>Equipos</h3>
          <p>Aquí controlaremos inventario, disponibilidad y asignación de equipos.</p>
        </div>
      ) : null}

      {vista === 'clientes' ? <AvClientesPanel /> : null}
    </section>
  )
}
