import { useEffect, useMemo, useState } from 'react'
import {
  listAvEquiposHistorial,
  type AvEquipo,
  type AvEquipoMovimiento,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ChevronDown,
  History,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  X,
} from '../icons'

type Props = {
  open: boolean
  onClose: () => void
  equipos: AvEquipo[]
  initialEquipoId?: string | null
}

function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function rolLabel(rol: string | null | undefined): string {
  if (rol === 'vendedor') return 'vendedor'
  if (rol === 'admin') return 'admin'
  if (rol === 'owner') return 'owner'
  return rol || ''
}

export function AvEquiposHistorialModal({
  open,
  onClose,
  equipos,
  initialEquipoId = null,
}: Props) {
  const { user } = useAuth()
  const [movimientos, setMovimientos] = useState<AvEquipoMovimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [tipoFilter, setTipoFilter] = useState<'all' | 'salida' | 'ingreso'>('all')
  const [equipoFilter, setEquipoFilter] = useState(initialEquipoId || '')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEquipoFilter(initialEquipoId || '')
    setTipoFilter('all')
    setQuery('')
    setExpandedId(null)
  }, [open, initialEquipoId])

  useEffect(() => {
    if (!open || !user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const token = await user!.getIdToken()
        const data = await listAvEquiposHistorial(token, {
          limit: 150,
          tipo: tipoFilter === 'all' ? '' : tipoFilter,
          equipoId: equipoFilter || undefined,
        })
        if (!cancelled) setMovimientos(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el historial')
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
  }, [open, user, refreshTick, tipoFilter, equipoFilter])

  const equiposOrdenados = useMemo(
    () =>
      [...equipos].sort((a, b) =>
        String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'),
      ),
    [equipos],
  )

  const movimientosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return movimientos
    return movimientos.filter((mov) => {
      const haystack = [
        mov.tipo,
        mov.responsableNombre,
        mov.responsableRol,
        mov.createdByNombre,
        ...(mov.equipos || []).flatMap((equipo) => [
          equipo.nombre,
          equipo.codigo,
          equipo.responsableNombre,
          ...(equipo.items || []).flatMap((item) => [item.nombre, item.observacion]),
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [movimientos, query])

  if (!open) return null

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel av-equipo-historial-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="av-equipo-historial-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="av-equipo-historial-title">
            <History size={18} strokeWidth={2} aria-hidden />
            Historial de equipos
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <p className="section-note">
          Registro de salidas a producción e ingresos a bodega, con responsable, revisión y quién
          registró el movimiento.
        </p>

        <div className="av-equipo-historial-filters">
          <label className="login-field" htmlFor="av-hist-tipo">
            Tipo
            <select
              id="av-hist-tipo"
              value={tipoFilter}
              onChange={(event) =>
                setTipoFilter(event.target.value as 'all' | 'salida' | 'ingreso')
              }
            >
              <option value="all">Todos</option>
              <option value="salida">Solo salidas</option>
              <option value="ingreso">Solo ingresos</option>
            </select>
          </label>

          <label className="login-field" htmlFor="av-hist-equipo">
            Equipo
            <select
              id="av-hist-equipo"
              value={equipoFilter}
              onChange={(event) => setEquipoFilter(event.target.value)}
            >
              <option value="">Todos los equipos</option>
              {equiposOrdenados.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.codigo ? `${equipo.codigo} · ` : ''}
                  {equipo.nombre || 'Sin nombre'}
                </option>
              ))}
            </select>
          </label>

          <label className="login-field av-equipo-historial-search" htmlFor="av-hist-q">
            Buscar
            <span className="av-cotizacion-buscar-wrap">
              <Search size={16} strokeWidth={2} aria-hidden />
              <input
                id="av-hist-q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Responsable, equipo, observación…"
                autoComplete="off"
              />
            </span>
          </label>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw size={15} strokeWidth={2} aria-hidden className={loading ? 'spin' : undefined} />
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="proyectos-status">
            <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
            Cargando historial...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="proyectos-status proyectos-status-error" role="alert">
            <AlertCircle size={18} strokeWidth={2} aria-hidden />
            {error}
          </div>
        ) : null}

        {!loading && !error && movimientosFiltrados.length === 0 ? (
          <div className="proyectos-empty">
            <Package size={28} strokeWidth={1.75} aria-hidden />
            <p>No hay movimientos registrados con estos filtros.</p>
          </div>
        ) : null}

        {!loading && !error && movimientosFiltrados.length > 0 ? (
          <ul className="av-equipo-historial-list">
            {movimientosFiltrados.map((mov) => {
              const expanded = expandedId === mov.id
              const isSalida = mov.tipo === 'salida'
              const equiposCount = mov.equipos?.length || 0
              return (
                <li
                  key={`${mov.tipo}-${mov.id}`}
                  className={`av-equipo-historial-card ${isSalida ? 'is-salida' : 'is-ingreso'}`}
                >
                  <button
                    type="button"
                    className="av-equipo-historial-toggle"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : mov.id)}
                  >
                    <span className="av-equipo-historial-toggle-main">
                      <span
                        className={`av-equipo-historial-badge ${isSalida ? 'is-salida' : 'is-ingreso'}`}
                      >
                        {isSalida ? 'Salida' : 'Ingreso'}
                      </span>
                      <strong>{formatFechaHora(mov.creadoEn)}</strong>
                      <span className="av-equipo-historial-meta">
                        {equiposCount} equipo{equiposCount === 1 ? '' : 's'}
                        {mov.responsableNombre
                          ? ` · ${mov.responsableNombre}${
                              mov.responsableRol ? ` (${rolLabel(mov.responsableRol)})` : ''
                            }`
                          : ''}
                      </span>
                      {mov.createdByNombre ? (
                        <span className="av-equipo-historial-meta">
                          Registró: {mov.createdByNombre}
                        </span>
                      ) : null}
                    </span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden
                      className={`av-servicio-card-chevron ${expanded ? 'is-open' : ''}`}
                    />
                  </button>

                  {expanded ? (
                    <div className="av-equipo-historial-detail">
                      {(mov.equipos || []).map((equipo) => (
                        <article key={`${mov.id}-${equipo.equipoId}`} className="av-equipo-historial-equipo">
                          <header>
                            <strong>{equipo.nombre || 'Equipo'}</strong>
                            {equipo.codigo ? (
                              <span className="av-credito-ref">{equipo.codigo}</span>
                            ) : null}
                          </header>
                          {!isSalida && equipo.responsableNombre ? (
                            <p className="av-equipo-historial-meta">
                              Venía a cargo de {equipo.responsableNombre}
                              {equipo.responsableRol
                                ? ` (${rolLabel(equipo.responsableRol)})`
                                : ''}
                            </p>
                          ) : null}
                          {(equipo.items || []).length > 0 ? (
                            <ul className="av-equipo-historial-items">
                              {equipo.items.map((item) => (
                                <li key={`${equipo.equipoId}-${item.itemId || item.nombre}`}>
                                  <span>
                                    {item.ok ? '✓' : '·'} {item.nombre}
                                  </span>
                                  {item.observacion ? (
                                    <em>{item.observacion}</em>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="av-equipo-historial-meta">Sin ítems de revisión</p>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
