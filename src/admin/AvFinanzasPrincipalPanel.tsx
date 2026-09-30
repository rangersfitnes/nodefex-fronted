import { useEffect, useState } from 'react'
import { formatCop } from '../api/administradores'
import { getAvFinanzasResumen, type AvFinanzasResumen } from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, LoaderCircle, RefreshCw } from '../icons'

const EMPTY_RESUMEN: AvFinanzasResumen = {
  ingresosTotales: 0,
  egresosTotales: 0,
  disponible: 0,
  cantidadIngresos: 0,
  cantidadEgresos: 0,
  porMetodo: [],
}

export function AvFinanzasPrincipalPanel() {
  const { user } = useAuth()
  const [resumen, setResumen] = useState<AvFinanzasResumen>(EMPTY_RESUMEN)
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
        const data = await getAvFinanzasResumen(token)
        if (!cancelled) setResumen(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen')
          setResumen(EMPTY_RESUMEN)
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
    <div className="av-finanzas-principal" role="tabpanel" aria-label="Principal">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Principal</h3>
          <p className="section-note">
            Resumen general y disponible por almacenamiento de presupuesto.
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
          Cargando resumen...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="av-finanzas-principal-grid">
          <div className="pagos-table-wrap">
            <table className="pagos-table av-resumen-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ingresos totales</td>
                  <td>{formatCop(resumen.ingresosTotales)}</td>
                </tr>
                <tr>
                  <td>Egresos totales</td>
                  <td>{formatCop(resumen.egresosTotales)}</td>
                </tr>
                <tr className="av-resumen-disponible">
                  <td>Disponible actualmente</td>
                  <td>{formatCop(resumen.disponible)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pagos-table-wrap">
            <table className="pagos-table av-resumen-table">
              <thead>
                <tr>
                  <th>Almacenamiento</th>
                  <th>Disponible</th>
                </tr>
              </thead>
              <tbody>
                {(resumen.porMetodo || []).map((item) => (
                  <tr key={item.tipo}>
                    <td>{item.label}</td>
                    <td>{formatCop(item.disponible)}</td>
                  </tr>
                ))}
                {(resumen.porMetodo || []).length === 0 ? (
                  <tr>
                    <td colSpan={2}>Sin movimientos por almacenamiento aún.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
