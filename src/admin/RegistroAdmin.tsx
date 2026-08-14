import { useState, type FormEvent } from 'react'
import {
  registrarAdministradorPublico,
  type Administrador,
} from '../api/administradores'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Hexagon,
  IdCard,
  LoaderCircle,
  Lock,
  LogIn,
  Mail,
  User,
} from '../icons'

const PANEL_LOGIN_URL = import.meta.env.DEV
  ? '/admin/login'
  : 'https://nodefex.com/admin/login'

export function RegistroAdmin() {
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<Administrador | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const administrador = await registrarAdministradorPublico({
        nombre: nombre.trim(),
        cedula: cedula.trim(),
        email: email.trim(),
        password,
      })
      setCreated(administrador)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el registro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="regadmin-page">
      <div className="regadmin-backdrop" aria-hidden />
      <div className="regadmin-grid" aria-hidden />
      <div className="regadmin-scan" aria-hidden />

      <main className="regadmin-main">
        <header className="regadmin-brand">
          <span className="regadmin-logo" aria-hidden>
            <Hexagon size={28} strokeWidth={1.75} />
          </span>
          <div>
            <p className="regadmin-kicker">Plataforma de operación</p>
            <h1>Nodefex</h1>
          </div>
        </header>

        <p className="regadmin-welcome">Bienvenido administrador de Nodefex</p>

        {created ? (
          <section className="regadmin-card" aria-labelledby="regadmin-done-title">
            <div className="regadmin-done-mark" aria-hidden>
              <BadgeCheck size={28} strokeWidth={1.75} />
            </div>
            <h2 id="regadmin-done-title">Registro completado</h2>
            <p className="regadmin-lead">
              Tus credenciales quedaron guardadas en tu perfil. Entra al panel para continuar.
            </p>

            <dl className="regadmin-creds">
              <div>
                <dt>Nombre</dt>
                <dd>{created.nombre || nombre}</dd>
              </div>
              <div>
                <dt>Cédula</dt>
                <dd>{created.cedula || cedula}</dd>
              </div>
              <div>
                <dt>Correo</dt>
                <dd>{created.email || email}</dd>
              </div>
              <div>
                <dt>Contraseña</dt>
                <dd>Guardada de forma segura</dd>
              </div>
            </dl>

            <a className="regadmin-submit" href={PANEL_LOGIN_URL}>
              Iniciar sesión en el panel
              <LogIn size={18} strokeWidth={2} aria-hidden />
            </a>
          </section>
        ) : (
          <section className="regadmin-card" aria-labelledby="regadmin-form-title">
            <h2 id="regadmin-form-title">Crear cuenta</h2>
            <p className="regadmin-lead">
              Completa tus datos para activar el acceso administrativo.
            </p>

            <form className="regadmin-form" onSubmit={handleSubmit} noValidate>
              <label className="regadmin-field" htmlFor="reg-nombre">
                Nombre
                <span className="regadmin-input">
                  <User size={17} strokeWidth={1.75} aria-hidden />
                  <input
                    id="reg-nombre"
                    name="nombre"
                    type="text"
                    autoComplete="name"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    disabled={submitting}
                    placeholder="Nombre completo"
                  />
                </span>
              </label>

              <label className="regadmin-field" htmlFor="reg-cedula">
                Cédula
                <span className="regadmin-input">
                  <IdCard size={17} strokeWidth={1.75} aria-hidden />
                  <input
                    id="reg-cedula"
                    name="cedula"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value.replace(/[^\d]/g, ''))}
                    required
                    disabled={submitting}
                    placeholder="Número de documento"
                  />
                </span>
              </label>

              <label className="regadmin-field" htmlFor="reg-email">
                Correo
                <span className="regadmin-input">
                  <Mail size={17} strokeWidth={1.75} aria-hidden />
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                    placeholder="admin@empresa.com"
                  />
                </span>
              </label>

              <label className="regadmin-field" htmlFor="reg-password">
                Contraseña
                <span className="regadmin-input">
                  <Lock size={17} strokeWidth={1.75} aria-hidden />
                  <input
                    id="reg-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={submitting}
                    placeholder="Mínimo 6 caracteres"
                  />
                </span>
              </label>

              {error ? (
                <p className="regadmin-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {error}
                </p>
              ) : null}

              <button className="regadmin-submit" type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <LoaderCircle className="spin" size={18} strokeWidth={2} aria-hidden />
                    Registrando...
                  </>
                ) : (
                  <>
                    Completar registro
                    <ArrowRight size={18} strokeWidth={2} aria-hidden />
                  </>
                )}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}
