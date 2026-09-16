import { useEffect, useState } from 'react'
import { listAvMovimientos, type AvMovimiento } from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, FileText, LoaderCircle, RefreshCw } from '../icons'

const TIPO_LABEL: Record<string, string> = {
  plan: 'Plan',
  cliente: 'Cliente',
  factura: 'Factura',
  pago: 'Pago',
  ingreso: 'Ingreso',
  egreso: 'Egreso',
}

const ACCION_LABEL: Record<string, string> = {
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  activar: 'Activar',
  desactivar: 'Desactivar',
  registrar_pago: 'Registrar pago',
}

function formatFechaHora(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function adminLabel(item: AvMovimiento): string {
  if (item.adminNombre?.trim()) return item.adminNombre.trim()
  if (item.adminEmail?.trim()) return item.adminEmail.trim()
  if (item.adminUid) return item.adminUid
  return '—'
}

export function AvMovimientosPanel() {
  const { user } = useAuth()
  const [movimientos, setMovimientos] = useState<AvMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvMovimientos(token, { limit: 300 })
        if (!cancelled) setMovimientos(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los movimientos')
          setMovimientos([])
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

  return (
    <div className="av-movimientos" role="tabpanel" aria-label="Movimientos globales">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Movimientos globales</h3>
          <p className="section-note">
            Auditoría de acciones realizadas por administradores en Nodefex Audio Visual.
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

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando movimientos...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && movimientos.length === 0 ? (
        <div className="proyectos-empty">
          <FileText size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay movimientos registrados.</p>
        </div>
      ) : null}

      {!loading && !error && movimientos.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Administrador</th>
                <th>Tipo</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((item) => (
                <tr key={item.id}>
                  <td>{formatFechaHora(item.creadoEn)}</td>
                  <td>
                    <div className="av-movimiento-admin">
                      <strong>{adminLabel(item)}</strong>
                      {item.adminEmail && item.adminNombre ? (
                        <span>{item.adminEmail}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{(item.tipo && TIPO_LABEL[item.tipo]) || item.tipo || '—'}</td>
                  <td>{(item.accion && ACCION_LABEL[item.accion]) || item.accion || '—'}</td>
                  <td>{item.resumen || item.entidadLabel || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
