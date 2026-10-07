import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  deleteSitioWebMedia,
  getSitioWeb,
  MAX_SITIO_PROJECTS,
  nextProjectMediaSlot,
  saveSitioWeb,
  uploadSitioWebMedia,
  type SitioMediaSlot,
  type SitioProjectItem,
  type SitioServiceItem,
  type SitioSocialItem,
  type SitioWebContent,
} from '../api/sitio'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Globe,
  Hexagon,
  LoaderCircle,
  LogOut,
  Plus,
  Trash2,
  Upload,
} from '../icons'
import {
  compressSitioImage,
  compressSitioImageFromUrl,
  resolveSitioMediaSrc,
} from '../utils/sitioMedia'

function MediaEditor({
  label,
  slot,
  url,
  busy,
  onUpload,
  onDelete,
}: {
  label: string
  slot: SitioMediaSlot
  url?: string
  busy: boolean
  onUpload: (slot: SitioMediaSlot, file: File) => void
  onDelete: (slot: SitioMediaSlot) => void
}) {
  return (
    <div className="sitio-web-media-card">
      <div className="sitio-web-media-preview">
        {url ? (
          <img src={resolveSitioMediaSrc(url)} alt={label} loading="lazy" decoding="async" />
        ) : (
          <span className="sitio-web-media-empty">Sin imagen</span>
        )}
      </div>
      <div className="sitio-web-media-actions">
        <p>{label}</p>
        <div className="hero-actions">
          <label className={`btn-secondary sitio-web-upload ${busy ? 'is-disabled' : ''}`}>
            <Upload size={16} strokeWidth={2} aria-hidden />
            {url ? 'Cambiar' : 'Subir'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={busy}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onUpload(slot, file)
              }}
            />
          </label>
          {url ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => onDelete(slot)}
            >
              <Trash2 size={16} strokeWidth={2} aria-hidden />
              Quitar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function SitioWebPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mediaUrls, setMediaUrls] = useState<Partial<Record<SitioMediaSlot, string>>>({})

  const [brand, setBrand] = useState('NODEFEX TECHNOLOGY')
  const [navCta, setNavCta] = useState('Hablemos')
  const [heroTitle, setHeroTitle] = useState('WE BUILD.')
  const [heroCta, setHeroCta] = useState('Ver proyectos')
  const [servicesTitle, setServicesTitle] = useState('Nuestros servicios')
  const [services, setServices] = useState<SitioServiceItem[]>([])
  const [projectsTitle, setProjectsTitle] = useState('Proyectos destacados')
  const [projectsCta, setProjectsCta] = useState('Ver todos')
  const [projects, setProjects] = useState<SitioProjectItem[]>([])
  const [footerContactLabel, setFooterContactLabel] = useState('Contacto')
  const [legalCompanyName, setLegalCompanyName] = useState('NODEFEX TECHNOLOGY')
  const [legalNit, setLegalNit] = useState('')
  const [legalAddress, setLegalAddress] = useState('')
  const [legalCity, setLegalCity] = useState('Colombia')
  const [legalEmail, setLegalEmail] = useState('contacto@nodefex.com')
  const [legalPhone, setLegalPhone] = useState('')
  const [termsText, setTermsText] = useState('')
  const [privacyText, setPrivacyText] = useState('')
  const [socials, setSocials] = useState<SitioSocialItem[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await getSitioWeb()
        if (!cancelled) applyContent(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el sitio web')
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

  function applyContent(data: SitioWebContent) {
    setBrand(data.brand)
    setNavCta(data.navCta)
    setHeroTitle(data.heroTitle || data.heroTitleLine1 || 'WE BUILD.')
    setHeroCta(data.heroCta || 'Ver proyectos')
    setServicesTitle(data.servicesTitle)
    setServices(data.services)
    setProjectsTitle(data.projectsTitle)
    setProjectsCta(data.projectsCta)
    setProjects(
      (data.projects || []).map((project, index) => ({
        name: project.name || '',
        category: project.category || '',
        description: project.description || '',
        href: project.href || '#proyectos',
        mediaSlot: project.mediaSlot || (`project-${index}` as SitioMediaSlot),
      })),
    )
    setFooterContactLabel(data.footerContactLabel)
    setLegalCompanyName(data.legalCompanyName || data.brand || 'NODEFEX TECHNOLOGY')
    setLegalNit(data.legalNit || '')
    setLegalAddress(data.legalAddress || '')
    setLegalCity(data.legalCity || 'Colombia')
    setLegalEmail(data.legalEmail || '')
    setLegalPhone(data.legalPhone || '')
    setTermsText(data.termsText || '')
    setPrivacyText(data.privacyText || '')
    setSocials(data.socials)
    setMediaUrls(data.mediaUrls || {})
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
      const saved = await saveSitioWeb(token, {
        brand,
        navCta,
        heroTitle,
        heroCta,
        servicesTitle,
        services,
        projectsTitle,
        projectsCta,
        projects,
        footerContactLabel,
        legalCompanyName,
        legalNit,
        legalAddress,
        legalCity,
        legalEmail,
        legalPhone,
        termsText,
        privacyText,
        socials,
      })
      applyContent(saved)
      setSuccess('Textos del sitio web guardados. Ya se reflejan en la página principal.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(slot: SitioMediaSlot, file: File) {
    if (!user || mediaBusy) return
    setMediaBusy(true)
    setError('')
    setSuccess('')
    try {
      const token = await user.getIdToken()
      const compressed = await compressSitioImage(file, slot, file.name)
      const saved = await uploadSitioWebMedia(token, slot, {
        fileName: compressed.fileName,
        mimeType: compressed.mimeType,
        contentBase64: compressed.contentBase64,
      })
      applyContent(saved)
      const kb = Math.round(compressed.size / 1024)
      setSuccess(`Imagen optimizada (${kb} KB): ${slot}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen')
    } finally {
      setMediaBusy(false)
    }
  }

  async function handleOptimizeAllMedia() {
    if (!user || mediaBusy) return
    const slots = Object.keys(mediaUrls).filter((slot) => Boolean(mediaUrls[slot as SitioMediaSlot]))
    if (!slots.length) {
      setError('No hay imágenes para optimizar')
      return
    }
    const ok = window.confirm(
      `Se recomprimirán ${slots.length} imagen(es) para acelerar la carga del sitio. ¿Continuar?`,
    )
    if (!ok) return

    setMediaBusy(true)
    setError('')
    setSuccess('')
    try {
      const token = await user.getIdToken()
      let optimized = 0
      let last = null as SitioWebContent | null
      for (const slot of slots) {
        const url = mediaUrls[slot as SitioMediaSlot]
        if (!url) continue
        const compressed = await compressSitioImageFromUrl(url, slot)
        last = await uploadSitioWebMedia(token, slot as SitioMediaSlot, {
          fileName: compressed.fileName,
          mimeType: compressed.mimeType,
          contentBase64: compressed.contentBase64,
        })
        optimized += 1
      }
      if (last) applyContent(last)
      setSuccess(`Imágenes optimizadas: ${optimized}. La página pública debería cargar más rápido.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron optimizar las imágenes')
    } finally {
      setMediaBusy(false)
    }
  }

  async function handleDeleteMedia(slot: SitioMediaSlot) {
    if (!user || mediaBusy) return
    const ok = window.confirm('¿Quitar esta imagen del sitio?')
    if (!ok) return
    setMediaBusy(true)
    setError('')
    setSuccess('')
    try {
      const token = await user.getIdToken()
      const saved = await deleteSitioWebMedia(token, slot)
      applyContent(saved)
      setSuccess('Imagen eliminada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la imagen')
    } finally {
      setMediaBusy(false)
    }
  }

  function handleAddProject() {
    if (projects.length >= MAX_SITIO_PROJECTS) return
    const mediaSlot = nextProjectMediaSlot(projects)
    setProjects((current) => [
      ...current,
      {
        name: `Proyecto ${current.length + 1}`,
        category: 'PROYECTO',
        description: '',
        href: '#proyectos',
        mediaSlot,
      },
    ])
  }

  async function handleRemoveProject(index: number) {
    if (projects.length <= 1) return
    const target = projects[index]
    if (!target) return
    const ok = window.confirm(
      `¿Eliminar “${target.name || `Proyecto ${index + 1}`}” del portafolio?`,
    )
    if (!ok) return

    setProjects((current) => current.filter((_, i) => i !== index))

    if (user && mediaUrls[target.mediaSlot]) {
      try {
        const token = await user.getIdToken()
        const saved = await deleteSitioWebMedia(token, target.mediaSlot)
        setMediaUrls(saved.mediaUrls || {})
      } catch {
        /* La card ya se quitó; la imagen se puede limpiar luego. */
      }
    }
  }

  const busy = saving || mediaBusy

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="login-mark" aria-hidden>
            <Hexagon size={20} strokeWidth={2.25} />
          </span>
          <span>Nodefex Technology</span>
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
            <Globe size={14} strokeWidth={2} aria-hidden />
            Sitio público
          </p>
          <div className="dashboard-hero-row">
            <div>
              <h1>Sitio web</h1>
              <p className="dashboard-copy">
                Personaliza textos e imágenes de la página principal. Los cambios se publican al
                guardar.
              </p>
            </div>
            <div className="hero-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || Object.keys(mediaUrls).length === 0}
                onClick={() => void handleOptimizeAllMedia()}
              >
                {mediaBusy ? (
                  <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                ) : (
                  <Upload size={16} strokeWidth={2} aria-hidden />
                )}
                Optimizar imágenes
              </button>
              <a className="btn-secondary" href="/" target="_blank" rel="noreferrer">
                Ver sitio
                <ArrowRight size={16} strokeWidth={2} aria-hidden />
              </a>
            </div>
          </div>
        </section>

        <section className="usuarios-section" aria-label="Personalización del sitio web">
          {loading ? (
            <div className="proyectos-status">
              <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
              Cargando contenido...
            </div>
          ) : (
            <form className="plan-admin-form sitio-web-form" onSubmit={handleSubmit}>
              <fieldset className="sitio-web-fieldset">
                <legend>Marca y navegación</legend>
                <label className="login-field">
                  Nombre de marca
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    disabled={busy}
                    maxLength={80}
                  />
                </label>
                <label className="login-field">
                  Botón del menú
                  <input
                    type="text"
                    value={navCta}
                    onChange={(e) => setNavCta(e.target.value)}
                    disabled={busy}
                    maxLength={40}
                  />
                </label>
              </fieldset>

              <fieldset className="sitio-web-fieldset">
                <legend>Hero</legend>
                <label className="login-field">
                  Texto del hero
                  <input
                    type="text"
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    disabled={busy}
                    maxLength={80}
                    placeholder="WE BUILD."
                  />
                </label>
                <label className="login-field">
                  Botón del hero
                  <input
                    type="text"
                    value={heroCta}
                    onChange={(e) => setHeroCta(e.target.value)}
                    disabled={busy}
                    maxLength={40}
                    placeholder="Ver proyectos"
                  />
                </label>
                <MediaEditor
                  label="Imagen hero"
                  slot="hero-bg"
                  url={mediaUrls['hero-bg']}
                  busy={busy}
                  onUpload={handleUpload}
                  onDelete={handleDeleteMedia}
                />
              </fieldset>

              <fieldset className="sitio-web-fieldset">
                <legend>Servicios</legend>
                <label className="login-field">
                  Título de sección
                  <input
                    type="text"
                    value={servicesTitle}
                    onChange={(e) => setServicesTitle(e.target.value)}
                    disabled={busy}
                    maxLength={80}
                  />
                </label>
                <div className="sitio-web-grid-2">
                  {services.map((service, index) => (
                    <label key={`service-${index}`} className="login-field">
                      Servicio {index + 1}
                      <input
                        type="text"
                        value={service.title}
                        onChange={(e) => {
                          const value = e.target.value
                          setServices((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, title: value } : item,
                            ),
                          )
                        }}
                        disabled={busy}
                        maxLength={40}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="sitio-web-fieldset">
                <legend>Proyectos destacados</legend>
                <div className="sitio-web-grid-2">
                  <label className="login-field">
                    Título de sección
                    <input
                      type="text"
                      value={projectsTitle}
                      onChange={(e) => setProjectsTitle(e.target.value)}
                      disabled={busy}
                      maxLength={80}
                    />
                  </label>
                  <label className="login-field">
                    Enlace «ver todos»
                    <input
                      type="text"
                      value={projectsCta}
                      onChange={(e) => setProjectsCta(e.target.value)}
                      disabled={busy}
                      maxLength={40}
                    />
                  </label>
                </div>
                {projects.map((project, index) => (
                  <div key={project.mediaSlot} className="sitio-web-project-block">
                    <div className="sitio-web-project-head">
                      <p className="dashboard-eyebrow">Proyecto {index + 1}</p>
                      {projects.length > 1 ? (
                        <button
                          type="button"
                          className="btn-secondary sitio-web-project-remove"
                          disabled={busy}
                          onClick={() => void handleRemoveProject(index)}
                        >
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                          Quitar
                        </button>
                      ) : null}
                    </div>
                    <div className="sitio-web-grid-2">
                      <label className="login-field">
                        Nombre
                        <input
                          type="text"
                          value={project.name}
                          onChange={(e) => {
                            const value = e.target.value
                            setProjects((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, name: value } : item,
                              ),
                            )
                          }}
                          disabled={busy}
                          maxLength={60}
                        />
                      </label>
                      <label className="login-field">
                        Categoría
                        <input
                          type="text"
                          value={project.category}
                          onChange={(e) => {
                            const value = e.target.value
                            setProjects((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, category: value } : item,
                              ),
                            )
                          }}
                          disabled={busy}
                          maxLength={40}
                        />
                      </label>
                    </div>
                    <label className="login-field">
                      Descripción
                      <textarea
                        value={project.description}
                        onChange={(e) => {
                          const value = e.target.value
                          setProjects((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, description: value } : item,
                            ),
                          )
                        }}
                        disabled={busy}
                        maxLength={220}
                        rows={3}
                        placeholder="Breve descripción del proyecto"
                      />
                    </label>
                    <label className="login-field">
                      Enlace
                      <input
                        type="text"
                        value={project.href}
                        onChange={(e) => {
                          const value = e.target.value
                          setProjects((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, href: value } : item,
                            ),
                          )
                        }}
                        disabled={busy}
                        maxLength={300}
                        placeholder="/fexmenu o https://..."
                      />
                    </label>
                    <MediaEditor
                      label={`Imagen ${project.name || `proyecto ${index + 1}`}`}
                      slot={project.mediaSlot}
                      url={mediaUrls[project.mediaSlot]}
                      busy={busy}
                      onUpload={handleUpload}
                      onDelete={handleDeleteMedia}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || projects.length >= MAX_SITIO_PROJECTS}
                  onClick={handleAddProject}
                >
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Agregar proyecto
                  {projects.length >= MAX_SITIO_PROJECTS
                    ? ` (máx. ${MAX_SITIO_PROJECTS})`
                    : ''}
                </button>
              </fieldset>

              <fieldset className="sitio-web-fieldset">
                <legend>Información legal</legend>
                <div className="sitio-web-grid-2">
                  <label className="login-field">
                    Razón social / nombre comercial
                    <input
                      type="text"
                      value={legalCompanyName}
                      onChange={(e) => setLegalCompanyName(e.target.value)}
                      disabled={busy}
                      maxLength={120}
                    />
                  </label>
                  <label className="login-field">
                    NIT
                    <input
                      type="text"
                      value={legalNit}
                      onChange={(e) => setLegalNit(e.target.value)}
                      disabled={busy}
                      maxLength={40}
                      placeholder="900.000.000-0"
                    />
                  </label>
                </div>
                <label className="login-field">
                  Dirección
                  <input
                    type="text"
                    value={legalAddress}
                    onChange={(e) => setLegalAddress(e.target.value)}
                    disabled={busy}
                    maxLength={200}
                  />
                </label>
                <div className="sitio-web-grid-2">
                  <label className="login-field">
                    Ciudad / país
                    <input
                      type="text"
                      value={legalCity}
                      onChange={(e) => setLegalCity(e.target.value)}
                      disabled={busy}
                      maxLength={80}
                    />
                  </label>
                  <label className="login-field">
                    Teléfono
                    <input
                      type="text"
                      value={legalPhone}
                      onChange={(e) => setLegalPhone(e.target.value)}
                      disabled={busy}
                      maxLength={40}
                    />
                  </label>
                </div>
                <label className="login-field">
                  Correo de contacto / PQRS
                  <input
                    type="email"
                    value={legalEmail}
                    onChange={(e) => setLegalEmail(e.target.value)}
                    disabled={busy}
                    maxLength={120}
                  />
                </label>
                <label className="login-field">
                  Términos y condiciones
                  <textarea
                    value={termsText}
                    onChange={(e) => setTermsText(e.target.value)}
                    disabled={busy}
                    maxLength={8000}
                    rows={6}
                  />
                </label>
                <label className="login-field">
                  Política de privacidad / datos personales
                  <textarea
                    value={privacyText}
                    onChange={(e) => setPrivacyText(e.target.value)}
                    disabled={busy}
                    maxLength={8000}
                    rows={6}
                  />
                </label>
              </fieldset>

              <fieldset className="sitio-web-fieldset">
                <legend>Footer y redes</legend>
                <label className="login-field">
                  Texto de contacto
                  <input
                    type="text"
                    value={footerContactLabel}
                    onChange={(e) => setFooterContactLabel(e.target.value)}
                    disabled={busy}
                    maxLength={40}
                  />
                </label>
                {socials.map((social, index) => (
                  <div key={`social-${index}`} className="sitio-web-grid-2">
                    <label className="login-field">
                      Red {index + 1}
                      <input
                        type="text"
                        value={social.label}
                        onChange={(e) => {
                          const value = e.target.value
                          setSocials((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, label: value } : item,
                            ),
                          )
                        }}
                        disabled={busy}
                        maxLength={40}
                      />
                    </label>
                    <label className="login-field">
                      URL
                      <input
                        type="text"
                        value={social.href}
                        onChange={(e) => {
                          const value = e.target.value
                          setSocials((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, href: value } : item,
                            ),
                          )
                        }}
                        disabled={busy}
                        maxLength={300}
                      />
                    </label>
                  </div>
                ))}
              </fieldset>

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
                <button type="submit" className="btn-primary" disabled={busy}>
                  {saving ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : (
                    'Guardar textos'
                  )}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}
