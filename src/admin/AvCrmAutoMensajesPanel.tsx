import { useEffect, useState, type FormEvent } from 'react'
import {
  getAvCrmMensajesAutomaticos,
  saveAvCrmMensajesAutomaticos,
  type AvCrmAutoMensajesConfig,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, LoaderCircle } from '../icons'

const DIAS_SEMANA = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

function Switch({
  checked,
  onChange,
  disabled,
  labelOn = 'Activo',
  labelOff = 'Apagado',
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  labelOn?: string
  labelOff?: string
}) {
  return (
    <label className={`access-switch ${checked ? 'is-on' : 'is-off'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="access-switch-track" aria-hidden>
        <span className="access-switch-thumb" />
      </span>
      <span className="access-switch-label">{checked ? labelOn : labelOff}</span>
    </label>
  )
}

export function AvCrmAutoMensajesPanel() {
  const { user } = useAuth()
  const [config, setConfig] = useState<AvCrmAutoMensajesConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedOk, setSavedOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await getAvCrmMensajesAutomaticos(token)
        if (!cancelled) setConfig(data)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'No se pudo cargar la configuración',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user || !config || saving) return
    setSaving(true)
    setError('')
    setSavedOk(false)
    try {
      const token = await user.getIdToken()
      const saved = await saveAvCrmMensajesAutomaticos(token, config)
      setConfig(saved)
      setSavedOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  function toggleDia(day: number) {
    if (!config) return
    const current = config.fueraHorario.dias
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b)
    setConfig({
      ...config,
      fueraHorario: { ...config.fueraHorario, dias: next },
    })
  }

  if (loading) {
    return (
      <div className="proyectos-status">
        <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
        Cargando…
      </div>
    )
  }

  if (!config) {
    return (
      <div className="proyectos-status proyectos-status-error" role="alert">
        <AlertCircle size={18} strokeWidth={2} aria-hidden />
        {error || 'No hay configuración'}
      </div>
    )
  }

  return (
    <form className="av-crm-auto-form" onSubmit={(event) => void handleSubmit(event)}>
      <p className="section-note">
        Se envían solos cuando un cliente escribe por WhatsApp. Activa solo los que necesites.
      </p>

      <article className="av-crm-auto-card">
        <header>
          <div>
            <h4>{config.primerContacto.titulo}</h4>
            <span>Cuando escribe por primera vez</span>
          </div>
          <Switch
            checked={config.primerContacto.activo}
            disabled={saving}
            onChange={(activo) =>
              setConfig({
                ...config,
                primerContacto: { ...config.primerContacto, activo },
              })
            }
          />
        </header>
        <textarea
          value={config.primerContacto.texto}
          disabled={saving}
          rows={3}
          maxLength={2000}
          onChange={(event) =>
            setConfig({
              ...config,
              primerContacto: { ...config.primerContacto, texto: event.target.value },
            })
          }
        />
      </article>

      <article className="av-crm-auto-card">
        <header>
          <div>
            <h4>{config.reapertura.titulo}</h4>
            <span>Cuando vuelve a escribir tras una conversación previa</span>
          </div>
          <Switch
            checked={config.reapertura.activo}
            disabled={saving}
            onChange={(activo) =>
              setConfig({
                ...config,
                reapertura: { ...config.reapertura, activo },
              })
            }
          />
        </header>
        <label className="login-field av-crm-auto-inline">
          Horas de inactividad
          <input
            type="number"
            min={1}
            max={168}
            value={config.reapertura.horasInactividad}
            disabled={saving}
            onChange={(event) =>
              setConfig({
                ...config,
                reapertura: {
                  ...config.reapertura,
                  horasInactividad: Number(event.target.value) || 12,
                },
              })
            }
          />
        </label>
        <textarea
          value={config.reapertura.texto}
          disabled={saving}
          rows={3}
          maxLength={2000}
          onChange={(event) =>
            setConfig({
              ...config,
              reapertura: { ...config.reapertura, texto: event.target.value },
            })
          }
        />
      </article>

      <article className="av-crm-auto-card">
        <header>
          <div>
            <h4>{config.fueraHorario.titulo}</h4>
            <span>Fuera del horario de atención (Bogotá)</span>
          </div>
          <Switch
            checked={config.fueraHorario.activo}
            disabled={saving}
            onChange={(activo) =>
              setConfig({
                ...config,
                fueraHorario: { ...config.fueraHorario, activo },
              })
            }
          />
        </header>
        <div className="av-crm-auto-hours">
          <label className="login-field">
            Desde
            <input
              type="time"
              value={config.fueraHorario.horaInicio}
              disabled={saving}
              onChange={(event) =>
                setConfig({
                  ...config,
                  fueraHorario: { ...config.fueraHorario, horaInicio: event.target.value },
                })
              }
            />
          </label>
          <label className="login-field">
            Hasta
            <input
              type="time"
              value={config.fueraHorario.horaFin}
              disabled={saving}
              onChange={(event) =>
                setConfig({
                  ...config,
                  fueraHorario: { ...config.fueraHorario, horaFin: event.target.value },
                })
              }
            />
          </label>
        </div>
        <div className="av-crm-auto-days" role="group" aria-label="Días laborables">
          {DIAS_SEMANA.map((dia) => {
            const on = config.fueraHorario.dias.includes(dia.value)
            return (
              <button
                key={dia.value}
                type="button"
                className={`av-crm-auto-day ${on ? 'is-on' : ''}`}
                disabled={saving}
                aria-pressed={on}
                onClick={() => toggleDia(dia.value)}
              >
                {dia.label}
              </button>
            )
          })}
        </div>
        <textarea
          value={config.fueraHorario.texto}
          disabled={saving}
          rows={3}
          maxLength={2000}
          onChange={(event) =>
            setConfig({
              ...config,
              fueraHorario: { ...config.fueraHorario, texto: event.target.value },
            })
          }
        />
      </article>

      <article className="av-crm-auto-card">
        <header>
          <div>
            <h4>{config.modoAusente.titulo}</h4>
            <span>Respuesta fija mientras el equipo no está disponible</span>
          </div>
          <Switch
            checked={config.modoAusente.activo}
            disabled={saving}
            onChange={(activo) =>
              setConfig({
                ...config,
                modoAusente: { ...config.modoAusente, activo },
              })
            }
          />
        </header>
        <textarea
          value={config.modoAusente.texto}
          disabled={saving}
          rows={3}
          maxLength={2000}
          onChange={(event) =>
            setConfig({
              ...config,
              modoAusente: { ...config.modoAusente, texto: event.target.value },
            })
          }
        />
      </article>

      {error ? (
        <p className="login-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden />
          {error}
        </p>
      ) : null}
      {savedOk ? <p className="section-note">Configuración guardada.</p> : null}

      <div className="modal-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? (
            <>
              <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
              Guardando…
            </>
          ) : (
            'Guardar'
          )}
        </button>
      </div>
    </form>
  )
}
