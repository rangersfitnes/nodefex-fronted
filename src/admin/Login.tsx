import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { ApiError } from '../api/administradores'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, ArrowRight, Hexagon, Lock, LogIn, Mail, Shield } from '../icons'

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
    <div className="admin-gate">
      <div className="admin-gate-bg" aria-hidden />
      <div className="admin-gate-orb admin-gate-orb-a" aria-hidden />
      <div className="admin-gate-orb admin-gate-orb-b" aria-hidden />

      <div className="admin-gate-shell">
        <section className="admin-gate-welcome" aria-labelledby="admin-welcome-title">
          <div className="admin-gate-brand">
            <span className="admin-gate-mark" aria-hidden>
              <Hexagon size={22} strokeWidth={2.25} />
            </span>
            <span>Nodefex Tecnology</span>
          </div>

          <p className="admin-gate-eyebrow">
            <Shield size={14} strokeWidth={2} aria-hidden />
            Acceso seguro
          </p>
          <h1 id="admin-welcome-title">Bienvenido</h1>
          <p className="admin-gate-copy">Accede al panel de Nodefex.</p>

          <ul className="admin-gate-points">
            <li>Gestión de proyectos y membresías</li>
            <li>Control de accesos y operación</li>
            <li>Panel exclusivo del equipo Nodefex</li>
          </ul>
        </section>

        <section className="admin-gate-card" aria-labelledby="admin-login-title">
          <header className="admin-gate-card-top">
            <div className="admin-gate-brand admin-gate-brand-light">
              <span className="admin-gate-mark admin-gate-mark-light" aria-hidden>
                <Hexagon size={20} strokeWidth={2.25} />
              </span>
              <span>Nodefex Tecnology</span>
            </div>
            <div className="admin-gate-form-head">
              <h2 id="admin-login-title">Iniciar sesión</h2>
              <p>Cuenta de administrador</p>
            </div>
          </header>

          <form className="admin-gate-form" onSubmit={handleSubmit} noValidate>
            <label className="admin-gate-field" htmlFor="email">
              Correo
              <span className="admin-gate-input">
                <Mail size={18} strokeWidth={1.75} aria-hidden />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={busy}
                  placeholder="admin@empresa.com"
                />
              </span>
            </label>

            <label className="admin-gate-field" htmlFor="password">
              Contraseña
              <span className="admin-gate-input">
                <Lock size={18} strokeWidth={1.75} aria-hidden />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={busy}
                  placeholder="••••••••"
                />
              </span>
            </label>

            {displayError ? (
              <p className="admin-gate-error" role="alert">
                <AlertCircle size={16} strokeWidth={2} aria-hidden />
                <span>{displayError}</span>
              </p>
            ) : null}

            {profileError && user ? (
              <button
                type="button"
                className="admin-gate-secondary"
                onClick={() => void retryProfile()}
                disabled={busy}
              >
                Reintentar acceso
              </button>
            ) : null}

            <button className="admin-gate-submit" type="submit" disabled={busy}>
              {busy ? (
                'Entrando...'
              ) : (
                <>
                  Entrar
                  <LogIn size={18} strokeWidth={2} aria-hidden />
                </>
              )}
            </button>
          </form>

          <Link to="/" className="admin-gate-back">
            Volver al sitio
            <ArrowRight size={14} strokeWidth={2} aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  )
}
