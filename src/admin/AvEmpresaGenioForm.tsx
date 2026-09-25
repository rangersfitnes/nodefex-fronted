import { useEffect, useState, type FormEvent } from 'react'
import {
  getAvEmpresaGenio,
  saveAvEmpresaGenio,
  type AvEmpresaGenio,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, Building2, Check, LoaderCircle } from '../icons'

const EMPTY: AvEmpresaGenio = {
  nit: null,
  razonSocial: null,
  nombreComercial: null,
  correo: null,
  telefono: null,
  direccion: null,
  ciudad: null,
  sitioWeb: null,
  regimen: null,
  actualizadoEn: null,
  updatedBy: null,
  updatedByNombre: null,
}

type AvEmpresaGenioFormProps = {
  canEdit?: boolean
}

export function AvEmpresaGenioForm({ canEdit = false }: AvEmpresaGenioFormProps) {
  const { user } = useAuth()
  const [form, setForm] = useState<AvEmpresaGenio>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await getAvEmpresaGenio(token)
        if (!cancelled) {
          setForm({ ...EMPTY, ...data })
          const hasData = Boolean(data.nit || data.razonSocial || data.nombreComercial)
          setOpen(!hasData)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos')
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

  function updateField<K extends keyof AvEmpresaGenio>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setSuccess('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user || !canEdit || saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const token = await user.getIdToken()
      const saved = await saveAvEmpresaGenio(token, {
        nit: form.nit?.trim() || null,
        razonSocial: form.razonSocial?.trim() || null,
        nombreComercial: form.nombreComercial?.trim() || null,
        correo: form.correo?.trim() || null,
        telefono: form.telefono?.trim() || null,
        direccion: form.direccion?.trim() || null,
        ciudad: form.ciudad?.trim() || null,
        sitioWeb: form.sitioWeb?.trim() || null,
        regimen: form.regimen?.trim() || null,
      })
      setForm({ ...EMPTY, ...saved })
      setSuccess('Datos de empresa guardados.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="av-empresa-genio">
      <button
        type="button"
        className="av-empresa-genio-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <Building2 size={16} strokeWidth={2} aria-hidden />
        <span>Datos de empresa · El Genio</span>
        <span className="av-empresa-genio-toggle-meta">
          {form.razonSocial || form.nombreComercial || 'Sin configurar'}
          {open ? ' · Ocultar' : ' · Editar'}
        </span>
      </button>

      {open ? (
        <div className="av-empresa-genio-panel">
          <p className="section-note">
            Estos datos aparecen en las cotizaciones PDF. Configúralos una vez y actualízalos cuando
            cambien.
          </p>

          {loading ? (
            <div className="proyectos-status">
              <LoaderCircle className="spin" size={18} strokeWidth={2} aria-hidden />
              Cargando...
            </div>
          ) : (
            <form className="av-cliente-form" onSubmit={(event) => void handleSubmit(event)}>
              <div className="av-ingresos-form-grid">
                <label className="login-field" htmlFor="av-emp-nit">
                  NIT
                  <input
                    id="av-emp-nit"
                    value={form.nit || ''}
                    onChange={(e) => updateField('nit', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </label>
                <label className="login-field" htmlFor="av-emp-razon">
                  Razón social
                  <input
                    id="av-emp-razon"
                    value={form.razonSocial || ''}
                    onChange={(e) => updateField('razonSocial', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </label>
                <label className="login-field" htmlFor="av-emp-nombre">
                  Nombre comercial
                  <input
                    id="av-emp-nombre"
                    value={form.nombreComercial || ''}
                    onChange={(e) => updateField('nombreComercial', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </label>
                <label className="login-field" htmlFor="av-emp-correo">
                  Correo corporativo
                  <input
                    id="av-emp-correo"
                    type="email"
                    value={form.correo || ''}
                    onChange={(e) => updateField('correo', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </label>
                <label className="login-field" htmlFor="av-emp-tel">
                  Número corporativo
                  <input
                    id="av-emp-tel"
                    value={form.telefono || ''}
                    onChange={(e) => updateField('telefono', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </label>
                <label className="login-field" htmlFor="av-emp-ciudad">
                  Ciudad
                  <input
                    id="av-emp-ciudad"
                    value={form.ciudad || ''}
                    onChange={(e) => updateField('ciudad', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </label>
                <label className="login-field av-ingresos-span-2" htmlFor="av-emp-dir">
                  Dirección
                  <input
                    id="av-emp-dir"
                    value={form.direccion || ''}
                    onChange={(e) => updateField('direccion', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </label>
                <label className="login-field" htmlFor="av-emp-web">
                  Sitio web
                  <input
                    id="av-emp-web"
                    value={form.sitioWeb || ''}
                    onChange={(e) => updateField('sitioWeb', e.target.value)}
                    disabled={!canEdit || saving}
                  />
                </label>
                <label className="login-field" htmlFor="av-emp-regimen">
                  Régimen / tipo
                  <input
                    id="av-emp-regimen"
                    value={form.regimen || ''}
                    onChange={(e) => updateField('regimen', e.target.value)}
                    disabled={!canEdit || saving}
                    placeholder="Ej. Régimen común"
                  />
                </label>
              </div>

              {error ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {error}
                </p>
              ) : null}
              {success ? (
                <p className="av-cliente-success">
                  <Check size={16} strokeWidth={2} aria-hidden /> {success}
                </p>
              ) : null}

              {canEdit ? (
                <div className="av-ingresos-form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                        Guardando...
                      </>
                    ) : (
                      'Guardar datos de empresa'
                    )}
                  </button>
                </div>
              ) : (
                <p className="section-note">Solo visualización: pide acceso de gestión para editar.</p>
              )}
            </form>
          )}
        </div>
      ) : null}
    </div>
  )
}
