import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, Hexagon, Lock, LogIn, Mail } from '../icons'

function getLoginErrorMessage(error: unknown): string {
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
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/admin/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email.trim(), password)
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      setError(getLoginErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-backdrop" aria-hidden />
      <div className="login-panel">
        <header className="login-brand">
          <span className="login-mark" aria-hidden>
            <Hexagon size={22} strokeWidth={2.25} />
          </span>
          <div>
            <p className="login-brand-name">Nodefex Tecnologi</p>
            <p className="login-brand-subtitle">Panel de administración</p>
          </div>
        </header>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h1>Iniciar sesión</h1>
          <p className="login-lead">Accede con tu cuenta de administrador.</p>

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
                disabled={submitting}
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
                disabled={submitting}
              />
            </span>
          </label>

          {error ? (
            <p className="login-error" role="alert">
              <AlertCircle size={16} strokeWidth={2} aria-hidden />
              {error}
            </p>
          ) : null}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? (
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
    </div>
  )
}
