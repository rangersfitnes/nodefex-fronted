import { useEffect, useMemo, useState } from 'react'
import {
  getAvCrmClienteIntereses,
  listAvCrmClientes,
  type AvCrmCliente,
  type AvCrmClienteIntereses,
  type AvCrmFunnelEstado,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from '../icons'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const FUNNEL_FILTERS: Array<{ id: 'all' | AvCrmFunnelEstado; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'en_proceso', label: 'En proceso' },
  { id: 'interesado', label: 'Interesado' },
  { id: 'venta_cerrada', label: 'Venta cerrada' },
]

function funnelLabel(estado: AvCrmFunnelEstado | null | undefined): string {
  switch (estado) {
    case 'nuevo':
      return 'Nuevo'
    case 'en_proceso':
      return 'En proceso'
    case 'interesado':
      return 'Interesado'
    case 'venta_cerrada':
      return 'Venta cerrada'
    default:
      return 'Sin estado'
  }
}

export function AvClientesCrmPanel() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<AvCrmCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [funnelFilter, setFunnelFilter] = useState<'all' | AvCrmFunnelEstado>('all')

  const [interesesOpen, setInteresesOpen] = useState(false)
  const [interesesCliente, setInteresesCliente] = useState<AvCrmCliente | null>(null)
  const [intereses, setIntereses] = useState<AvCrmClienteIntereses | null>(null)
  const [interesesLoading, setInteresesLoading] = useState(false)
  const [interesesError, setInteresesError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvCrmClientes(token)
        if (!cancelled) setClientes(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes CRM')
          setClientes([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, refreshTick])

  const filteredClientes = useMemo(() => {
    if (funnelFilter === 'all') return clientes
    return clientes.filter((item) => (item.funnelEstado || null) === funnelFilter)
  }, [clientes, funnelFilter])

  async function openIntereses(cliente: AvCrmCliente, refresh = false) {
    if (!user) return
    setInteresesCliente(cliente)
    setInteresesOpen(true)
    setIntereses(null)
    setInteresesError('')
    setInteresesLoading(true)
    try {
      const token = await user.getIdToken()
      const data = await getAvCrmClienteIntereses(token, cliente.id, { refresh })
      if (data.cliente?.id && data.cliente.id !== cliente.id) {
        throw new Error('El análisis no corresponde a este cliente')
      }
      setIntereses(data)
    } catch (err) {
      setInteresesError(
        err instanceof Error ? err.message : 'No se pudo generar el análisis de intereses',
      )
    } finally {
      setInteresesLoading(false)
    }
  }

  function closeIntereses() {
    if (interesesLoading) return
    setInteresesOpen(false)
    setInteresesCliente(null)
    setIntereses(null)
    setInteresesError('')
  }

  return (
    <div className="av-clientes-crm" aria-label="Clientes CRM">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Clientes CRM</h3>
          <p className="section-note">
            Capturados al completar «Solicitar datos» en WhatsApp. Filtra por embudo de ventas.
          </p>
        </div>
        <div className="av-ingresos-toolbar-actions">
          <button
            type="button"
            className="btn-secondary contable-refresh"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading}
            aria-label="Actualizar"
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden className={loading ? 'spin' : undefined} />
            Actualizar
          </button>
        </div>
      </div>

      <div
        className="av-wa-funnel-filters av-clientes-crm-funnel"
        role="toolbar"
        aria-label="Filtro embudo"
      >
        {FUNNEL_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`av-wa-funnel-chip ${funnelFilter === filter.id ? 'is-active' : ''} is-${filter.id}`}
            onClick={() => setFunnelFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando clientes CRM...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && filteredClientes.length === 0 ? (
        <div className="proyectos-empty">
          <Users size={28} strokeWidth={1.75} aria-hidden />
          <p>
            {clientes.length === 0
              ? 'Aún no hay clientes CRM. Activa el recurso «Solicitar datos» en un chat de WhatsApp y espera a que el cliente responda nombre y empresa.'
              : 'No hay clientes en este estado del embudo.'}
          </p>
        </div>
      ) : null}

      {!loading && !error && filteredClientes.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Empresa</th>
                <th>Embudo</th>
                <th>Teléfono</th>
                <th>Recopilado</th>
                <th>Activado por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredClientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td>{cliente.nombreContacto || '—'}</td>
                  <td>{cliente.nombreEmpresa || '—'}</td>
                  <td>
                    <span className={`av-wa-funnel-badge is-${cliente.funnelEstado || 'none'}`}>
                      {funnelLabel(cliente.funnelEstado)}
                    </span>
                  </td>
                  <td>{cliente.phoneDisplay || cliente.phoneNumber || '—'}</td>
                  <td>{formatDate(cliente.recopiladoEn || cliente.actualizadoEn)}</td>
                  <td>{cliente.activatedByNombre || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void openIntereses(cliente)}
                    >
                      <Sparkles size={14} strokeWidth={2} aria-hidden />
                      Ver intereses
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {interesesOpen && interesesCliente ? (
        <div className="modal-overlay" role="presentation" onClick={closeIntereses}>
          <div
            className="modal-panel av-cliente-modal av-cliente-crm-intereses"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-crm-intereses-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-crm-intereses-title">
                Intereses — {interesesCliente.nombreContacto || 'Cliente'}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeIntereses}
                disabled={interesesLoading}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="av-cliente-crm-intereses-meta">
              <p>
                <strong>Empresa:</strong> {interesesCliente.nombreEmpresa || '—'}
              </p>
              <p>
                <strong>Teléfono:</strong>{' '}
                {interesesCliente.phoneDisplay || interesesCliente.phoneNumber || '—'}
              </p>
              <p>
                <strong>Embudo:</strong> {funnelLabel(interesesCliente.funnelEstado)}
              </p>
            </div>

            {interesesLoading ? (
              <div className="proyectos-status">
                <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                Analizando solo este chat con IA...
              </div>
            ) : null}

            {!interesesLoading && interesesError ? (
              <div className="proyectos-status proyectos-status-error" role="alert">
                <AlertCircle size={18} strokeWidth={2} aria-hidden />
                {interesesError}
              </div>
            ) : null}

            {!interesesLoading && intereses ? (
              <>
                {intereses.stats ? (
                  <p className="section-note av-cliente-crm-stats">
                    {intereses.stats.frecuenciaRespuesta}
                    {' · '}
                    Cliente {intereses.stats.mensajesCliente} msgs · Asesor{' '}
                    {intereses.stats.mensajesAsesor} msgs
                    {intereses.cached ? ' · Resumen en caché' : ''}
                  </p>
                ) : null}
                <div className="av-cliente-crm-resumen">{intereses.resumen}</div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void openIntereses(interesesCliente, true)}
                    disabled={interesesLoading}
                  >
                    <RefreshCw size={14} strokeWidth={2} aria-hidden />
                    Regenerar análisis
                  </button>
                  <button type="button" className="btn-primary" onClick={closeIntereses}>
                    Cerrar
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
