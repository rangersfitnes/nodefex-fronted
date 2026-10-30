import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
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
  type SitioWebPayload,
} from '../api/sitio'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Globe,
  Hexagon,
  LoaderCircle,
  LogOut,
  Plus,
  Trash2,
  Upload,
} from '../icons'
import { SitioWebFormShimmer } from './Shimmer'
import {
  compressSitioImage,
  compressSitioImageFromUrl,
  resolveSitioMediaSrc,
} from '../utils/sitioMedia'

type SitioSectionId = 'marca' | 'hero' | 'servicios' | 'proyectos' | 'legal' | 'footer'

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

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
  summary,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  summary?: string
}) {
  return (
    <fieldset className={`sitio-web-fieldset${open ? '' : ' is-collapsed'}`}>
      <legend className="sitio-web-fieldset-legend">
        <button
          type="button"
          className="sitio-web-fieldset-toggle"
          aria-expanded={open}
          onClick={onToggle}
        >
          <span className="sitio-web-fieldset-toggle-text">
            <span className="sitio-web-fieldset-title">{title}</span>
            {!open && summary ? (
              <span className="sitio-web-fieldset-summary">{summary}</span>
            ) : null}
          </span>
          <ChevronDown
            size={18}
            strokeWidth={2}
            className={`sitio-web-chevron${open ? ' is-open' : ''}`}
            aria-hidden
          />
        </button>
      </legend>
      {open ? <div className="sitio-web-fieldset-body">{children}</div> : null}
    </fieldset>
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
  const [heroTitleLine2, setHeroTitleLine2] = useState('Tu web profesional.')
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
  const [openSections, setOpenSections] = useState<Record<SitioSectionId, boolean>>({
    marca: false,
    hero: false,
    servicios: false,
    proyectos: true,
    legal: false,
    footer: false,
  })
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({})

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
    setHeroTitleLine2(data.heroTitleLine2 || 'Tu web profesional.')
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

  const busy = saving || mediaBusy

  function toggleSection(id: SitioSectionId) {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }))
  }

  function toggleProject(slot: string) {
    setOpenProjects((current) => ({ ...current, [slot]: !current[slot] }))
  }

  function buildPayload(nextProjects: SitioProjectItem[] = projects): SitioWebPayload {
    return {
      brand,
      navCta,
      heroTitle,
      heroTitleLine2,
      heroCta,
      servicesTitle,
      services,
      projectsTitle,
      projectsCta,
      projects: nextProjects,
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
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/admin', { replace: true })
  }

  async function persistContent(
    nextProjects: SitioProjectItem[],
    successMessage: string,
  ): Promise<boolean> {
    if (!user) return false
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const token = await user.getIdToken()
      const saved = await saveSitioWeb(token, buildPayload(nextProjects))
      applyContent(saved)
      setSuccess(successMessage)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await persistContent(
      projects,
      'Textos del sitio web guardados. Ya se reflejan en la página principal.',
    )
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
      // Solo media: no pisar textos/proyectos locales aún no guardados.
      setMediaUrls(saved.mediaUrls || {})
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
      if (last) setMediaUrls(last.mediaUrls || {})
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
      setMediaUrls(saved.mediaUrls || {})
      setSuccess('Imagen eliminada')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la imagen')
    } finally {
      setMediaBusy(false)
    }
  }

  async function handleAddProject() {
    if (projects.length >= MAX_SITIO_PROJECTS || !user || busy) return
    const mediaSlot = nextProjectMediaSlot(projects)
    const nextProjects: SitioProjectItem[] = [
      ...projects,
      {
        name: `Proyecto ${projects.length + 1}`,
        category: 'PROYECTO',
        description: '',
        href: '#proyectos',
        mediaSlot,
      },
    ]
    setProjects(nextProjects)
    setOpenSections((current) => ({ ...current, proyectos: true }))
    setOpenProjects((current) => ({ ...current, [mediaSlot]: true }))
    await persistContent(nextProjects, 'Proyecto agregado y publicado en el sitio.')
  }

  async function handleRemoveProject(index: number) {
    if (projects.length <= 1 || !user || busy) return
    const target = projects[index]
    if (!target) return
    const ok = window.confirm(
      `¿Eliminar “${target.name || `Proyecto ${index + 1}`}” del portafolio?`,
    )
    if (!ok) return

    const nextProjects = projects.filter((_, i) => i !== index)
    setProjects(nextProjects)
    setOpenProjects((current) => {
      const next = { ...current }
      delete next[target.mediaSlot]
      return next
    })

    if (mediaUrls[target.mediaSlot]) {
      try {
        const token = await user.getIdToken()
        const saved = await deleteSitioWebMedia(token, target.mediaSlot)
        setMediaUrls(saved.mediaUrls || {})
      } catch {
        /* El proyecto se guarda igual; la imagen se puede limpiar luego. */
      }
    }

    await persistContent(nextProjects, 'Proyecto eliminado del sitio.')
  }

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
                Personaliza textos e imágenes de la página principal. Agregar o quitar proyectos se
                publica al instante; el resto de textos al guardar.
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
            <SitioWebFormShimmer />
          ) : (
            <form className="plan-admin-form sitio-web-form" onSubmit={handleSubmit}>
              <CollapsibleSection
                title="Marca y navegación"
                open={openSections.marca}
                onToggle={() => toggleSection('marca')}
                summary={brand}
              >
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
              </CollapsibleSection>

              <CollapsibleSection
                title="Hero"
                open={openSections.hero}
                onToggle={() => toggleSection('hero')}
                summary={heroTitleLine2}
              >
                <label className="login-field">
                  Título del hero
                  <input
                    type="text"
                    value={heroTitleLine2}
                    onChange={(e) => setHeroTitleLine2(e.target.value)}
                    disabled={busy}
                    maxLength={80}
                    placeholder="Tu web profesional."
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
              </CollapsibleSection>

              <CollapsibleSection
                title="Servicios"
                open={openSections.servicios}
                onToggle={() => toggleSection('servicios')}
                summary={`${services.length} servicios`}
              >
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
              </CollapsibleSection>

              <CollapsibleSection
                title="Proyectos destacados"
                open={openSections.proyectos}
                onToggle={() => toggleSection('proyectos')}
                summary={`${projects.length} proyecto${projects.length === 1 ? '' : 's'}`}
              >
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
                {projects.map((project, index) => {
                  const projectOpen = Boolean(openProjects[project.mediaSlot])
                  return (
                    <div
                      key={project.mediaSlot}
                      className={`sitio-web-project-block${projectOpen ? '' : ' is-collapsed'}`}
                    >
                      <div className="sitio-web-project-head">
                        <button
                          type="button"
                          className="sitio-web-project-toggle"
                          aria-expanded={projectOpen}
                          onClick={() => toggleProject(project.mediaSlot)}
                        >
                          <ChevronDown
                            size={16}
                            strokeWidth={2}
                            className={`sitio-web-chevron${projectOpen ? ' is-open' : ''}`}
                            aria-hidden
                          />
                          <span className="sitio-web-project-toggle-label">
                            <span className="sitio-web-project-name">
                              {project.name || `Proyecto ${index + 1}`}
                            </span>
                            {project.category ? (
                              <span className="sitio-web-project-meta">{project.category}</span>
                            ) : null}
                          </span>
                        </button>
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
                      {projectOpen ? (
                        <div className="sitio-web-project-body">
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
                      ) : null}
                    </div>
                  )
                })}
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || projects.length >= MAX_SITIO_PROJECTS}
                  onClick={() => void handleAddProject()}
                >
                  <Plus size={16} strokeWidth={2} aria-hidden />
                  Agregar proyecto
                  {projects.length >= MAX_SITIO_PROJECTS
                    ? ` (máx. ${MAX_SITIO_PROJECTS})`
                    : ''}
                </button>
              </CollapsibleSection>

              <CollapsibleSection
                title="Información legal"
                open={openSections.legal}
                onToggle={() => toggleSection('legal')}
                summary={legalCompanyName}
              >
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
              </CollapsibleSection>

              <CollapsibleSection
                title="Footer y redes"
                open={openSections.footer}
                onToggle={() => toggleSection('footer')}
                summary={footerContactLabel}
              >
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
              </CollapsibleSection>

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
