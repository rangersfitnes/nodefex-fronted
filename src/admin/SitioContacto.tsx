import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getSitioContacto,
  saveSitioContacto,
  type SitioContacto,
  type SitioContactoTipo,
} from '../api/sitio'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Hexagon,
  LoaderCircle,
  LogOut,
  MessageCircle,
} from '../icons'

export function SitioContactoPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activo, setActivo] = useState(false)
  const [etiqueta, setEtiqueta] = useState('Contactar')
  const [tipo, setTipo] = useState<SitioContactoTipo>('whatsapp')
  const [valor, setValor] = useState('')
  const [previewHref, setPreviewHref] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await getSitioContacto()
        if (cancelled) return
        applyContacto(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el contacto')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function applyContacto(data: SitioContacto) {
    setActivo(data.activo)
    setEtiqueta(data.etiqueta || 'Contactar')
    setTipo(data.tipo || 'whatsapp')
    setValor(data.valor || '')
    setPreviewHref(data.href || '')
  }

  async function handleLogout() {
    await logout()
    navigate('/admin', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const token = await user.getIdToken()
      const saved = await saveSitioContacto(token, {
        activo,
        etiqueta: etiqueta.trim() || 'Contactar',
        tipo,
        valor: valor.trim(),
      })
      applyContacto(saved)
      setSuccess(
        saved.activo
          ? 'Botón flotante activo en la página principal.'
          : 'Contacto guardado. El botón está desactivado.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const valorHint =
    tipo === 'whatsapp'
      ? 'Ej. 573001112233 (con código de país)'
      : tipo === 'tel'
        ? 'Ej. 573001112233'
        : 'Ej. https://t.me/tuusuario o mailto:hola@nodefex.com'

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="login-mark" aria-hidden>
            <Hexagon size={20} strokeWidth={2.25} />
          </span>
          <span>Nodefex Tecnology</span>
        </div>
        <div className="dashboard-user">
          <span className="dashboard-email">{user?.email}</span>
          <button type="button" className="dashboard-logout" onClick={() => void handleLogout()}>
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <Link to="/admin/dashboard" className="back-link">
          <ArrowRight size={16} strokeWidth={2} className="back-link-icon" aria-hidden />
          Volver al dashboard
        </Link>

        <section className="dashboard-hero">
          <p className="dashboard-eyebrow">
            <MessageCircle size={14} strokeWidth={2} aria-hidden />
            Sitio público
          </p>
          <div className="dashboard-hero-row">
            <div>
              <h1>Botón de contacto</h1>
              <p className="dashboard-copy">
                Configura el botón flotante de la página principal. Solo tú como owner puedes
                editarlo.
              </p>
            </div>
          </div>
        </section>

        <section className="usuarios-section" aria-label="Configuración de contacto">
          {loading ? (
            <div className="proyectos-status">
              <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
              Cargando configuración...
            </div>
          ) : (
            <form className="plan-admin-form sitio-contacto-form" onSubmit={handleSubmit}>
              <label className="login-field sitio-contacto-switch">
                <span>Mostrar botón en la web</span>
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  disabled={saving}
                />
              </label>

              <label className="login-field">
                Texto del botón
                <input
                  type="text"
                  value={etiqueta}
                  onChange={(e) => setEtiqueta(e.target.value)}
                  maxLength={40}
                  disabled={saving}
                  placeholder="Contactar"
                />
              </label>

              <label className="login-field">
                Tipo
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as SitioContactoTipo)}
                  disabled={saving}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="tel">Teléfono</option>
                  <option value="url">Enlace / URL</option>
                </select>
              </label>

              <label className="login-field">
                Destino
                <input
                  type="text"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  disabled={saving}
                  placeholder={valorHint}
                />
                <span className="field-hint">{valorHint}</span>
              </label>

              {previewHref ? (
                <p className="sitio-contacto-preview">
                  Destino actual:{' '}
                  <a href={previewHref} target="_blank" rel="noreferrer">
                    {previewHref}
                  </a>
                </p>
              ) : null}

              {error ? (
                <p className="proyectos-status proyectos-status-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {error}
                </p>
              ) : null}

              {success ? (
                <p className="sitio-contacto-success" role="status">
                  <Check size={16} strokeWidth={2} aria-hidden />
                  {success}
                </p>
              ) : null}

              <div className="hero-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar contacto'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}
