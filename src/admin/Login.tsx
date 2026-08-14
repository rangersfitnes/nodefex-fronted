import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { ApiError } from '../api/administradores'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowRight,
  Brain,
  Code2,
  Cpu,
  Globe,
  Hexagon,
  Layers,
  Lock,
  LogIn,
  Mail,
  Printer,
  Smartphone,
} from '../icons'

const SERVICES = [
  {
    title: 'Desarrollo de Software',
    description: 'Sistemas a medida, APIs y arquitectura escalable para operaciones reales.',
    icon: Code2,
  },
  {
    title: 'Desarrollo Web',
    description: 'Productos digitales de alto rendimiento con experiencia clara y moderna.',
    icon: Globe,
  },
  {
    title: 'Aplicaciones',
    description: 'Apps móviles y de escritorio conectadas a tu infraestructura.',
    icon: Smartphone,
  },
  {
    title: 'Inteligencia Artificial',
    description: 'Automatización inteligente y modelos aplicados a procesos de negocio.',
    icon: Brain,
  },
  {
    title: 'Impresión 3D',
    description: 'Prototipado rápido y fabricación digital para hardware y producto.',
    icon: Printer,
  },
  {
    title: 'Hardware',
    description: 'Integración de dispositivos, IoT y componentes electrónicos.',
    icon: Cpu,
  },
  {
    title: 'Soluciones Tecnológicas',
    description: 'Consultoría e implementación integral de stack y operación técnica.',
    icon: Layers,
  },
] as const

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'El correo no es válido.'
      case 'auth/user-disabled':
        return 'Esta cuenta está deshabilitada.'
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Correo o contraseña incorrectos.'
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intenta más tarde.'
      default:
        return 'No se pudo iniciar sesión. Intenta de nuevo.'
    }
  }
  return 'No se pudo iniciar sesión. Intenta de nuevo.'
}

export function Login() {
  const { user, administrador, loading, login, profileError, retryProfile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user && administrador) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const busy = submitting || (loading && Boolean(user))
  const displayError = error || profileError

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(getLoginErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page landing-page">
      <div className="login-backdrop landing-backdrop" aria-hidden />
      <div className="landing-grid-overlay" aria-hidden />

      <header className="landing-nav">
        <div className="landing-nav-brand">
          <span className="login-mark" aria-hidden>
            <Hexagon size={20} strokeWidth={2.25} />
          </span>
          <span className="landing-nav-name">Nodefex Tecnologi</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/velix" className="landing-nav-link">
            Velix
          </Link>
          <a href="#acceso" className="landing-nav-cta">
            Acceso
            <ArrowRight size={16} strokeWidth={2} aria-hidden />
          </a>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-brand">
          <p className="landing-kicker">Ingeniería · Producto · Infraestructura</p>
          <h1 id="landing-brand" className="landing-brand-title">
            Nodefex Tecnologi
          </h1>
          <p className="landing-hero-copy">
            Construimos software, hardware y soluciones digitales con estándar industrial.
          </p>
          <div className="landing-hero-actions">
            <a href="#servicios" className="btn-primary landing-btn">
              Ver capacidades
            </a>
            <a href="#acceso" className="btn-secondary landing-btn">
              Panel admin
            </a>
          </div>
        </section>

        <section id="servicios" className="landing-services" aria-labelledby="servicios-title">
          <div className="landing-section-head">
            <h2 id="servicios-title">Capacidades</h2>
            <p>Un equipo técnico para construir, integrar y operar tecnología de punta.</p>
          </div>

          <ul className="landing-service-list">
            {SERVICES.map((service, index) => {
              const Icon = service.icon
              return (
                <li
                  key={service.title}
                  className="landing-service-item"
                  style={{ animationDelay: `${0.06 * index}s` }}
                >
                  <span className="landing-service-icon" aria-hidden>
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section id="acceso" className="landing-access" aria-labelledby="acceso-title">
          <div className="landing-access-copy">
            <h2 id="acceso-title">Acceso administrativo</h2>
            <p>
              Inicia sesión para gestionar proyectos, licencias Velix y operación de la plataforma.
            </p>
          </div>

          <div className="login-panel landing-login-panel">
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <h3>Iniciar sesión</h3>
              <p className="login-lead">Cuenta de administrador Nodefex.</p>

              <label className="login-field" htmlFor="email">
                Correo electrónico
                <span className="login-input-wrap">
                  <Mail className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={busy}
                  />
                </span>
              </label>

              <label className="login-field" htmlFor="password">
                Contraseña
                <span className="login-input-wrap">
                  <Lock className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={busy}
                  />
                </span>
              </label>

              {displayError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {displayError}
                </p>
              ) : null}

              {profileError && user ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void retryProfile()}
                  disabled={busy}
                >
                  Reintentar acceso
                </button>
              ) : null}

              <button className="login-submit" type="submit" disabled={busy}>
                {busy ? (
                  'Entrando...'
                ) : (
                  <>
                    <LogIn size={18} strokeWidth={2} aria-hidden />
                    Entrar
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>© {new Date().getFullYear()} Nodefex Tecnologi</p>
      </footer>
    </div>
  )
}
