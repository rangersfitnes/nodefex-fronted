import { useState } from 'react'
import { Banknote, Layers, Package, Users, Video } from '../icons'
import { AvClientesPanel } from './AvClientesPanel'
import { AvIngresosPanel } from './AvIngresosPanel'
import { AvPlanesPanel } from './AvPlanesPanel'

type AudiovisualVista = 'finanzas' | 'planes' | 'equipos' | 'clientes'
type FinanzasSubvista = 'ingresos'

const TABS: { id: AudiovisualVista; label: string; icon: typeof Banknote }[] = [
  { id: 'finanzas', label: 'Finanzas', icon: Banknote },
  { id: 'planes', label: 'Planes', icon: Layers },
  { id: 'equipos', label: 'Equipos', icon: Package },
  { id: 'clientes', label: 'Clientes', icon: Users },
]

export function AudiovisualPanel() {
  const [vista, setVista] = useState<AudiovisualVista>('finanzas')
  const [finanzasVista, setFinanzasVista] = useState<FinanzasSubvista>('ingresos')

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
        {TABS.map((tab) => {
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
              aria-selected={finanzasVista === 'ingresos'}
              className={finanzasVista === 'ingresos' ? 'is-active' : ''}
              onClick={() => setFinanzasVista('ingresos')}
            >
              Ingresos
            </button>
          </div>

          {finanzasVista === 'ingresos' ? <AvIngresosPanel /> : null}
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
