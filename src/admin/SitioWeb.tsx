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

async function compressImageForUpload(file: File): Promise<{
  fileName: string
  mimeType: string
  contentBase64: string
}> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo leer la imagen'))
      img.src = objectUrl
    })

    const maxSide = 1920
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo procesar la imagen')
    ctx.drawImage(image, 0, 0, width, height)

    const qualities = [0.82, 0.7, 0.58, 0.45]
    let best: { mimeType: string; contentBase64: string; size: number } | null = null
    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      const contentBase64 = dataUrl.split(',')[1] || ''
      const size = Math.ceil((contentBase64.length * 3) / 4)
      best = { mimeType: 'image/jpeg', contentBase64, size }
      if (size <= 650 * 1024) break
    }

    if (!best?.contentBase64) throw new Error('No se pudo comprimir la imagen')
    if (best.size > 700 * 1024) {
      throw new Error(
        'La imagen es demasiado grande incluso comprimida. Usa otra de menor resolución.',
      )
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagen'
    return {
      fileName: `${baseName}.jpg`,
      mimeType: best.mimeType,
      contentBase64: best.contentBase64,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

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
          <img src={url} alt={label} />
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
  const [bandBrand, setBandBrand] = useState('NODEFEX TECHNOLOGY')
  const [bandTitleLine1, setBandTitleLine1] = useState('IDEAS')
  const [bandTitleLine2, setBandTitleLine2] = useState('EN MOVIMIENTO')
  const [footerContactLabel, setFooterContactLabel] = useState('Contacto')
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
    setBandBrand(data.bandBrand)
    setBandTitleLine1(data.bandTitleLine1)
    setBandTitleLine2(data.bandTitleLine2)
    setFooterContactLabel(data.footerContactLabel)
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
        bandBrand,
        bandTitleLine1,
        bandTitleLine2,
        footerContactLabel,
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
      const compressed = await compressImageForUpload(file)
      const saved = await uploadSitioWebMedia(token, slot, compressed)
      applyContent(saved)
      setSuccess(`Imagen actualizada: ${slot}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen')
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
            <a className="btn-secondary" href="/" target="_blank" rel="noreferrer">
              Ver sitio
              <ArrowRight size={16} strokeWidth={2} aria-hidden />
            </a>
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
                <legend>Banda «Nosotros»</legend>
                <label className="login-field">
                  Marca
                  <input
                    type="text"
                    value={bandBrand}
                    onChange={(e) => setBandBrand(e.target.value)}
                    disabled={busy}
                    maxLength={80}
                  />
                </label>
                <div className="sitio-web-grid-2">
                  <label className="login-field">
                    Título línea 1
                    <input
                      type="text"
                      value={bandTitleLine1}
                      onChange={(e) => setBandTitleLine1(e.target.value)}
                      disabled={busy}
                      maxLength={40}
                    />
                  </label>
                  <label className="login-field">
                    Título línea 2 (acento)
                    <input
                      type="text"
                      value={bandTitleLine2}
                      onChange={(e) => setBandTitleLine2(e.target.value)}
                      disabled={busy}
                      maxLength={40}
                    />
                  </label>
                </div>
                <MediaEditor
                  label="Imagen banda"
                  slot="band-bg"
                  url={mediaUrls['band-bg']}
                  busy={busy}
                  onUpload={handleUpload}
                  onDelete={handleDeleteMedia}
                />
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
