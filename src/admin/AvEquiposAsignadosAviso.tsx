import { useEffect, useMemo, useState } from 'react'
import { listAvEquipos, type AvEquipo } from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, Clock, Package } from '../icons'

function parseSalidaMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (days > 0) return `${days}d ${hh}:${mm}:${ss}`
  return `${hh}:${mm}:${ss}`
}

type Props = {
  onGoEquipos?: () => void
}

export function AvEquiposAsignadosAviso({ onGoEquipos }: Props) {
  const { user } = useAuth()
  const [equipos, setEquipos] = useState<AvEquipo[]>([])
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) {
        setEquipos([])
        setLoaded(true)
        return
      }
      try {
        const token = await user.getIdToken()
        const data = await listAvEquipos(token)
        if (cancelled) return
        setEquipos(
          data.filter(
            (item) =>
              (item.estado || 'bodega') === 'produccion' &&
              item.responsableUid &&
              item.responsableUid === user.uid,
          ),
        )
      } catch {
        if (!cancelled) setEquipos([])
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    void load()
    const refreshId = window.setInterval(() => {
      void load()
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(refreshId)
    }
  }, [user])

  useEffect(() => {
    if (equipos.length === 0) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [equipos.length])

  const items = useMemo(
    () =>
      equipos
        .map((equipo) => {
          const since = parseSalidaMs(equipo.ultimaSalidaEn) || parseSalidaMs(equipo.actualizadoEn)
          return {
            equipo,
            since,
            elapsedMs: since != null ? Math.max(0, now - since) : 0,
          }
        })
        .sort((a, b) => (b.elapsedMs || 0) - (a.elapsedMs || 0)),
    [equipos, now],
  )

  if (!loaded || items.length === 0) return null

  const count = items.length

  return (
    <aside className="av-equipos-aviso" role="status" aria-live="polite">
      <div className="av-equipos-aviso-head">
        <span className="av-equipos-aviso-icon" aria-hidden>
          <AlertCircle size={22} strokeWidth={2.25} />
        </span>
        <div className="av-equipos-aviso-copy">
          <p className="av-equipos-aviso-title">
            Tienes {count} equipo{count === 1 ? '' : 's'} en producción
          </p>
          <p className="av-equipos-aviso-sub">
            Debes devolverlos a bodega con el botón Ingreso cuando termines.
          </p>
        </div>
        {onGoEquipos ? (
          <button type="button" className="btn-secondary av-equipos-aviso-cta" onClick={onGoEquipos}>
            <Package size={15} strokeWidth={2} aria-hidden />
            Ver equipos
          </button>
        ) : null}
      </div>

      <ul className="av-equipos-aviso-list">
        {items.map(({ equipo, since, elapsedMs }) => (
          <li key={equipo.id} className="av-equipos-aviso-item">
            <div className="av-equipos-aviso-item-main">
              <strong>{equipo.nombre || 'Equipo'}</strong>
              {equipo.codigo ? (
                <span className="av-equipos-aviso-codigo">{equipo.codigo}</span>
              ) : null}
            </div>
            <div className="av-equipos-aviso-timer" title={since ? new Date(since).toLocaleString('es-CO') : undefined}>
              <Clock size={15} strokeWidth={2.25} aria-hidden />
              <span className="av-equipos-aviso-timer-label">Llevas</span>
              <time className="av-equipos-aviso-chrono" dateTime={equipo.ultimaSalidaEn || undefined}>
                {since != null ? formatDuration(elapsedMs) : '—'}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
