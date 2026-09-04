import { useEffect, useState } from 'react'
import { getSitioContacto, type SitioContacto } from './api/sitio'
import {
  ArrowRight,
  Brain,
  Code2,
  Cpu,
  Globe,
  Hexagon,
  Megaphone,
  MessageCircle,
  Printer,
  Share2,
  Smartphone,
  Video,
} from './icons'

const SERVICES = [
  { title: 'Software', icon: Code2 },
  { title: 'Web', icon: Globe },
  { title: 'Apps', icon: Smartphone },
  { title: 'IA', icon: Brain },
  { title: 'Audiovisual', icon: Video },
  { title: 'Redes', icon: Share2 },
  { title: 'Marketing', icon: Megaphone },
  { title: '3D', icon: Printer },
  { title: 'Hardware', icon: Cpu },
] as const

const TESTIMONIALS = [
  {
    quote: 'Sistema estable y operación más ordenada desde el primer día.',
    name: 'Camila Rojas',
    role: 'Operaciones',
  },
  {
    quote: 'El contenido y las redes nos dieron presencia real en el mercado.',
    name: 'Andrés Mejía',
    role: 'Fundador',
  },
  {
    quote: 'De lo manual a una plataforma confiable, con un solo equipo.',
    name: 'Laura Quintero',
    role: 'Comercial',
  },
] as const

export function Landing() {
  const [contacto, setContacto] = useState<SitioContacto | null>(null)

  useEffect(() => {
    let cancelled = false

    void getSitioContacto()
      .then((data) => {
        if (!cancelled) setContacto(data)
      })
      .catch(() => {
        if (!cancelled) setContacto(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const showContact =
    Boolean(contacto?.activo && contacto.href) && Boolean(contacto?.href)

  return (
    <div className="login-page landing-page">
      <div className="login-backdrop landing-backdrop" aria-hidden />
      <div className="landing-grid-overlay" aria-hidden />

      <header className="landing-nav">
        <a href="#inicio" className="landing-nav-brand">
          <span className="login-mark" aria-hidden>
            <Hexagon size={20} strokeWidth={2.25} />
          </span>
          <span className="landing-nav-name">Nodefex Tecnology</span>
        </a>
        <nav className="landing-nav-actions" aria-label="Secciones">
          <a href="#servicios" className="landing-nav-cta">
            Capacidades
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </a>
        </nav>
      </header>

      <main className="landing-main">
        <section id="inicio" className="landing-hero" aria-labelledby="landing-brand">
          <h1 id="landing-brand" className="landing-brand-title">
            Nodefex Tecnology
          </h1>
          <p className="landing-hero-copy">
            Software, hardware y comunicación digital — claros y a medida.
          </p>
        </section>

        <section id="servicios" className="landing-services" aria-labelledby="servicios-title">
          <div className="landing-section-head">
            <h2 id="servicios-title">Capacidades</h2>
          </div>

          <ul className="landing-service-list">
            {SERVICES.map((service) => {
              const Icon = service.icon
              return (
                <li key={service.title} className="landing-service-item">
                  <span className="landing-service-icon" aria-hidden>
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <h3>{service.title}</h3>
                </li>
              )
            })}
          </ul>
        </section>

        <section
          id="comentarios"
          className="landing-testimonials"
          aria-labelledby="comentarios-title"
        >
          <div className="landing-section-head">
            <h2 id="comentarios-title">Comentarios</h2>
          </div>

          <div className="landing-testimonial-track">
            {TESTIMONIALS.map((item) => (
              <figure key={item.name} className="landing-testimonial">
                <blockquote>
                  <p>“{item.quote}”</p>
                </blockquote>
                <figcaption>
                  <span className="landing-testimonial-name">{item.name}</span>
                  <span className="landing-testimonial-role">{item.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <p className="landing-footer-brand">Nodefex Tecnology</p>
          <p>© {new Date().getFullYear()}</p>
        </div>
      </footer>

      {showContact && contacto ? (
        <a
          className="landing-contact-fab"
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
