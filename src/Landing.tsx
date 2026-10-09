import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getSitioContacto,
  getSitioWeb,
  type SitioContacto,
  type SitioMediaSlot,
  type SitioWebContent,
} from './api/sitio'
import { resolveSitioMediaSrc } from './utils/sitioMedia'
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Code2,
  Layers,
  Menu,
  MessageCircle,
  Video,
  X,
} from './icons'

type IconProps = { size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }

function InstagramIcon({ size = 16, strokeWidth = 1.75, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function YoutubeIcon({ size = 16, strokeWidth = 1.75, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M2.5 8.5A3.5 3.5 0 0 1 6 5h12a3.5 3.5 0 0 1 3.5 3.5v7A3.5 3.5 0 0 1 18 19H6a3.5 3.5 0 0 1-3.5-3.5v-7Z" />
      <path d="m10 9.5 5 2.5-5 2.5v-5Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LinkedinIcon({ size = 16, strokeWidth = 1.75, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M8 11v7M8 8v.01M12 18v-5.5a2.5 2.5 0 1 1 5 0V18" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
}

type MediaSlotProps = {
  slot: SitioMediaSlot | string
  label: string
  className?: string
  imageUrl?: string
  priority?: boolean
}

function MediaSlot({
  slot,
  label,
  className = '',
  imageUrl,
  priority = false,
}: MediaSlotProps) {
  const src = resolveSitioMediaSrc(imageUrl)
  return (
    <div
      className={`nf-media-slot ${src ? 'has-image' : 'is-empty'} ${className}`.trim()}
      data-media-slot={slot}
      role="img"
      aria-label={label}
    >
      {src ? (
        <img
          className="nf-media-img"
          src={src}
          alt=""
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
      ) : null}
    </div>
  )
}

const NAV_LINKS = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#proyectos', label: 'Proyectos' },
  { href: '#servicios', label: 'Servicios' },
  { href: '#legal', label: 'Legal' },
] as const

const SERVICE_ICONS = [Code2, Box, Video, Layers] as const
const SOCIAL_ICONS = [InstagramIcon, YoutubeIcon, LinkedinIcon] as const

const DEFAULT_CONTENT: SitioWebContent = {
  brand: 'NODEFEX TECHNOLOGY',
  navCta: 'Hablemos',
  heroTitle: 'WE BUILD.',
  heroEyebrow: '',
  heroTitleLine1: 'WE BUILD.',
  heroTitleLine2: '',
  heroCta: 'Ver proyectos',
  servicesTitle: 'Nuestros servicios',
  services: [
    { title: 'Software' },
    { title: 'Impresión 3D' },
    { title: 'Audiovisual' },
    { title: 'Consultoría Tech' },
  ],
  projectsTitle: 'Proyectos destacados',
  projectsCta: 'Ver todos',
  projects: [
    {
      name: 'Fexmenu',
      category: 'SAAS',
      description: '',
      href: '/fexmenu',
      mediaSlot: 'project-0',
    },
    {
      name: 'El Genio',
      category: 'AUDIOVISUAL',
      description: '',
      href: '#proyectos',
      mediaSlot: 'project-1',
    },
    {
      name: 'Velix',
      category: 'DEPORTIVO',
      description: '',
      href: '/velix',
      mediaSlot: 'project-2',
    },
    {
      name: 'Rangers Box',
      category: 'GESTIÓN',
      description: '',
      href: '#proyectos',
      mediaSlot: 'project-3',
    },
  ],
  bandBrand: 'NODEFEX TECHNOLOGY',
  bandTitleLine1: 'IDEAS',
  bandTitleLine2: 'EN MOVIMIENTO',
  footerContactLabel: 'Contacto',
  legalCompanyName: 'NODEFEX TECHNOLOGY',
  legalNit: '',
  legalAddress: '',
  legalCity: 'Colombia',
  legalEmail: 'contacto@nodefex.com',
  legalPhone: '',
  termsText:
    'Al acceder y utilizar este sitio web, usted acepta estos términos y condiciones. El contenido, marcas, software y materiales publicados pertenecen a NODEFEX TECHNOLOGY o a sus licenciantes y no pueden reproducirse sin autorización. Los servicios ofrecidos (software, impresión 3D, producción audiovisual y consultoría tecnológica) se contratan de forma independiente según propuesta o acuerdo comercial. Nos reservamos el derecho de actualizar la información del sitio sin previo aviso. El uso indebido de la plataforma, intentos de acceso no autorizado o actividades ilícitas están prohibidos. Para controversias se aplicará la legislación colombiana.',
  privacyText:
    'En cumplimiento de la Ley 1581 de 2012 y normas complementarias sobre protección de datos personales en Colombia, informamos que los datos recolectados a través de formularios, WhatsApp u otros canales de contacto se usan para atender solicitudes, prestar servicios y enviar comunicaciones relacionadas con NODEFEX TECHNOLOGY. El titular puede conocer, actualizar, rectificar u oponerse al tratamiento de sus datos escribiendo al correo de contacto indicado en este sitio. No vendemos datos personales a terceros. Conservamos la información el tiempo necesario para las finalidades autorizadas o exigidas por ley.',
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/' },
    { label: 'YouTube', href: 'https://www.youtube.com/' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/' },
  ],
  media: {},
  mediaUrls: {},
  updatedAt: null,
}

function isInternalPath(href: string) {
  return href.startsWith('/') && !href.startsWith('//')
}

/** Normaliza el campo «Enlace» del CMS para que la card navegue bien. */
function resolveProjectHref(raw: string | undefined | null): string {
  const href = String(raw ?? '').trim()
  if (!href || href === '#') return '#proyectos'
  if (
    href.startsWith('#') ||
    href.startsWith('/') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    /^https?:\/\//i.test(href)
  ) {
    return href
  }
  // Dominio sin protocolo (ej. elgenio.co o www.elgenio.co)
  if (/^(www\.)?[\w.-]+\.[\w.-]+/i.test(href)) {
    return `https://${href}`
  }
  return href
}

function isExternalHref(href: string) {
  return (
    /^https?:\/\//i.test(href) ||
    href.startsWith('//') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
}

const PROJECT_DESC_PREVIEW_CHARS = 90

export function Landing() {
  const [contacto, setContacto] = useState<SitioContacto | null>(null)
  const [content, setContent] = useState<SitioWebContent>(DEFAULT_CONTENT)
  const [activeSection, setActiveSection] = useState('inicio')
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [legalPanel, setLegalPanel] = useState<'terms' | 'privacy' | null>(null)

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      getSitioContacto().catch(() => null),
      getSitioWeb().catch(() => null),
    ]).then(([contactoData, webData]) => {
      if (cancelled) return
      setContacto(contactoData)
      if (webData) setContent(webData)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const ids = NAV_LINKS.map((item) => item.href.slice(1))
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: [0.15, 0.4, 0.7] },
    )

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const contactHref =
    contacto?.activo && contacto.href ? contacto.href : '#contacto'
  const showContactFab = Boolean(contacto?.activo && contacto.href)

  const services = useMemo(
    () =>
      (content.services?.length ? content.services : DEFAULT_CONTENT.services).map(
        (service, index) => ({
          ...service,
          icon: SERVICE_ICONS[index % SERVICE_ICONS.length],
        }),
      ),
    [content.services],
  )

  const projects = useMemo(
    () =>
      (content.projects?.length ? content.projects : DEFAULT_CONTENT.projects).map(
        (project, index) => {
          const slot =
            project.mediaSlot ||
            (`project-${index}` as SitioMediaSlot)
          return {
            ...project,
            description: project.description || '',
            mediaSlot: slot,
            slot,
            imageUrl: content.mediaUrls?.[slot],
          }
        },
      ),
    [content.projects, content.mediaUrls],
  )

  const socials = useMemo(
    () =>
      (content.socials?.length ? content.socials : DEFAULT_CONTENT.socials).map(
        (social, index) => ({
          ...social,
          icon: SOCIAL_ICONS[index % SOCIAL_ICONS.length],
        }),
      ),
    [content.socials],
  )

  const brandShort =
    content.brand.replace(/\s+TECHNOLOGY$/i, '').trim() || content.brand

  return (
    <div className={`nf-site ${menuOpen ? 'is-menu-open' : ''}`.trim()}>
      <header className="nf-nav">
        <div className="nf-nav-inner">
          <a href="#inicio" className="nf-brand" onClick={() => setMenuOpen(false)}>
            <span className="nf-brand-full">{content.brand}</span>
            <span className="nf-brand-short">{brandShort}</span>
          </a>

          <nav className="nf-nav-links" aria-label="Secciones">
            {NAV_LINKS.map((link) => {
              const id = link.href.slice(1)
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={activeSection === id ? 'is-active' : undefined}
                >
                  {link.label}
                </a>
              )
            })}
          </nav>

          <div className="nf-nav-end">
            <a className="nf-btn nf-btn-outline nf-nav-cta-desktop" href={contactHref}>
              {content.navCta}
              <ArrowRight size={16} strokeWidth={2} aria-hidden />
            </a>
            <button
              type="button"
              className="nf-nav-menu"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X size={20} strokeWidth={2} aria-hidden />
              ) : (
                <Menu size={20} strokeWidth={2} aria-hidden />
              )}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="nf-nav-overlay">
            <button
              type="button"
              className="nf-nav-overlay-dismiss"
              aria-label="Cerrar menú"
              onClick={() => setMenuOpen(false)}
            />
            <nav className="nf-nav-drawer" aria-label="Menú móvil">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={activeSection === link.href.slice(1) ? 'is-active' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <a
                className="nf-btn nf-btn-outline nf-nav-drawer-cta"
                href={contactHref}
                onClick={() => setMenuOpen(false)}
              >
                {content.navCta}
                <ArrowRight size={16} strokeWidth={2} aria-hidden />
              </a>
            </nav>
          </div>
        ) : null}
      </header>

      <main>
        <section id="inicio" className="nf-hero" aria-labelledby="nf-hero-title">
          <MediaSlot
            slot="hero-bg"
            label="Imagen hero"
            className="nf-hero-media"
            imageUrl={content.mediaUrls?.['hero-bg']}
            priority
          />
          <div className="nf-hero-scrim" aria-hidden />
          <div className="nf-hero-content">
            <h1 id="nf-hero-title" className="nf-hero-kicker">
              {content.heroTitle || content.heroTitleLine1 || 'WE BUILD.'}
            </h1>
            <div className="nf-hero-actions">
              <a className="nf-btn nf-btn-outline" href="#proyectos">
                {content.heroCta || 'Ver proyectos'}
                <ArrowRight size={16} strokeWidth={2} aria-hidden />
              </a>
              <a
                className="nf-btn nf-btn-solid"
                href="https://elgenio.co"
                target="_blank"
                rel="noopener noreferrer"
              >
                Producción audiovisual
                <ArrowRight size={16} strokeWidth={2} aria-hidden />
              </a>
            </div>
          </div>
        </section>

        <section
          id="proyectos"
          className="nf-section nf-projects"
          aria-labelledby="proyectos-title"
        >
          <div className="nf-section-row">
            <h2 id="proyectos-title" className="nf-section-label">
              {content.projectsTitle}
            </h2>
            <a className="nf-link-all" href="#proyectos">
              {content.projectsCta}
              <span className="nf-icon-circle" aria-hidden>
                <ArrowRight size={14} strokeWidth={2} />
              </span>
            </a>
          </div>

          <ul
            className="nf-project-grid"
            data-count={projects.length <= 4 ? String(projects.length) : 'many'}
          >
            {projects.map((project) => {
              const href = resolveProjectHref(project.href)
              const cardKey = project.mediaSlot || `${project.name}-${project.slot}`
              const description = project.description?.trim() || ''
              const canExpand = description.length > PROJECT_DESC_PREVIEW_CHARS
              const isExpanded = expandedProject === cardKey
              const preview =
                canExpand && !isExpanded
                  ? `${description.slice(0, PROJECT_DESC_PREVIEW_CHARS).trimEnd()}…`
                  : description

              const inner = (
                <>
                  <MediaSlot
                    slot={project.slot}
                    label={`Imagen ${project.name}`}
                    className="nf-project-media"
                    imageUrl={project.imageUrl}
                  />
                  <div className="nf-project-meta">
                    <div className="nf-project-meta-main">
                      <div className="nf-project-meta-top">
                        <div>
                          <h3>{project.name}</h3>
                          <p className="nf-project-category">{project.category}</p>
                        </div>
                        <span className="nf-icon-circle" aria-hidden>
                          <ArrowUpRight size={14} strokeWidth={2} />
                        </span>
                      </div>
                      {description ? (
                        <p
                          className={`nf-project-desc${isExpanded ? ' is-expanded' : ''}`}
                        >
                          {preview}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              )

              return (
                <li
                  key={cardKey}
                  className={`nf-project-item${isExpanded ? ' is-expanded' : ''}`}
                >
                  {isInternalPath(href) ? (
                    <Link to={href} className="nf-project-card">
                      {inner}
                    </Link>
                  ) : (
                    <a
                      href={href}
                      className="nf-project-card"
                      {...(isExternalHref(href)
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {inner}
                    </a>
                  )}
                  {canExpand ? (
                    <button
                      type="button"
                      className="nf-project-more"
                      aria-expanded={isExpanded}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setExpandedProject((current) =>
                          current === cardKey ? null : cardKey,
                        )
                      }}
                    >
                      {isExpanded ? 'Ver menos' : 'Ver más'}
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>

        <section
          id="servicios"
          className="nf-section nf-services"
          aria-labelledby="servicios-title"
        >
          <h2 id="servicios-title" className="nf-section-label">
            {content.servicesTitle}
          </h2>
          <ul className="nf-service-grid">
            {services.map((service) => {
              const Icon = service.icon
              return (
                <li key={service.title}>
                  <a href="#servicios" className="nf-service-item">
                    <span className="nf-service-icon" aria-hidden>
                      <Icon size={22} strokeWidth={1.6} />
                    </span>
                    <span className="nf-service-title">{service.title}</span>
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
                  </a>
                </li>
              )
            })}
          </ul>
        </section>

      </main>

      <footer id="contacto" className="nf-footer">
        <section
          id="legal"
          className="nf-legal"
          aria-labelledby="legal-title"
        >
          <div className="nf-legal-inner">
            <div className="nf-legal-intro">
              <p className="nf-section-label" id="legal-title">
                Información legal
              </p>
              <p className="nf-legal-company">
                {content.legalCompanyName || content.brand}
              </p>
              <ul className="nf-legal-meta">
                {content.legalNit ? (
                  <li>
                    <span>NIT</span>
                    <strong>{content.legalNit}</strong>
                  </li>
                ) : null}
                {content.legalAddress ? (
                  <li>
                    <span>Dirección</span>
                    <strong>{content.legalAddress}</strong>
                  </li>
                ) : null}
                {content.legalCity ? (
                  <li>
                    <span>Ciudad / país</span>
                    <strong>{content.legalCity}</strong>
                  </li>
                ) : null}
                {content.legalEmail ? (
                  <li>
                    <span>Correo</span>
                    <strong>
                      <a href={`mailto:${content.legalEmail}`}>{content.legalEmail}</a>
                    </strong>
                  </li>
                ) : null}
                {content.legalPhone ? (
                  <li>
                    <span>Teléfono</span>
                    <strong>
                      <a href={`tel:${content.legalPhone.replace(/\s+/g, '')}`}>
                        {content.legalPhone}
                      </a>
                    </strong>
                  </li>
                ) : null}
              </ul>
            </div>

            <div className="nf-legal-actions">
              <button
                type="button"
                className={`nf-legal-toggle${legalPanel === 'terms' ? ' is-open' : ''}`}
                aria-expanded={legalPanel === 'terms'}
                onClick={() =>
                  setLegalPanel((current) => (current === 'terms' ? null : 'terms'))
                }
              >
                Términos y condiciones
              </button>
              <button
                type="button"
                className={`nf-legal-toggle${legalPanel === 'privacy' ? ' is-open' : ''}`}
                aria-expanded={legalPanel === 'privacy'}
                onClick={() =>
                  setLegalPanel((current) =>
                    current === 'privacy' ? null : 'privacy',
                  )
                }
              >
                Política de privacidad
              </button>
            </div>

            {legalPanel === 'terms' ? (
              <div className="nf-legal-panel" role="region" aria-label="Términos y condiciones">
                <h3>Términos y condiciones</h3>
                <p>{content.termsText}</p>
              </div>
            ) : null}

            {legalPanel === 'privacy' ? (
              <div
                className="nf-legal-panel"
                role="region"
                aria-label="Política de privacidad"
              >
                <h3>Política de privacidad y tratamiento de datos</h3>
                <p>{content.privacyText}</p>
              </div>
            ) : null}

            <p className="nf-legal-note">
              El uso de este sitio implica la aceptación de los términos y de la política de
              tratamiento de datos personales conforme a la legislación colombiana vigente.
            </p>
          </div>
        </section>

        <div className="nf-footer-inner">
          <div className="nf-footer-brand-block">
            <p className="nf-brand">{content.brand}</p>
            <p className="nf-footer-copy">
              © {new Date().getFullYear()} {content.legalCompanyName || content.brand}. Todos
              los derechos reservados.
              {content.legalNit ? ` NIT ${content.legalNit}.` : ''}
            </p>
          </div>
          <div className="nf-footer-links">
            <a href={contactHref}>{content.footerContactLabel}</a>
            <a href="#legal">Legal</a>
            <span className="nf-footer-sep" aria-hidden />
            <div className="nf-socials">
              {socials.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={`${social.label}-${social.href}`}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                  >
                    <Icon size={16} strokeWidth={1.75} aria-hidden />
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </footer>

      {showContactFab && contacto ? (
        <a
          className="nf-contact-fab"
          href={contacto.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={contacto.etiqueta || 'Contactar'}
        >
          <MessageCircle size={22} strokeWidth={2} aria-hidden />
          <span>{contacto.etiqueta || 'Contactar'}</span>
        </a>
      ) : null}
    </div>
  )
}
