import { useState, type FormEvent } from 'react'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { confirmPasswordChanged } from '../api/administradores'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, Lock } from '../icons'

function mapPasswordError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'La contraseña actual no es correcta.'
      case 'auth/weak-password':
        return 'La nueva contraseña es demasiado débil (mínimo 6 caracteres).'
      case 'auth/requires-recent-login':
        return 'Vuelve a iniciar sesión e intenta de nuevo.'
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera un momento.'
      default:
        return 'No se pudo cambiar la contraseña. Intenta de nuevo.'
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'No se pudo cambiar la contraseña. Intenta de nuevo.'
}

export function ChangePasswordModal() {
  const { user, setAdministrador } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!user?.email) {
      setError('No hay una sesión válida.')
      return
    }

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    if (newPassword === currentPassword) {
      setError('La nueva contraseña debe ser distinta a la actual.')
      return
    }

    setSubmitting(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)

      const token = await user.getIdToken(true)
      const perfil = await confirmPasswordChanged(token)
      setAdministrador(perfil)
    } catch (err) {
      setError(mapPasswordError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay password-change-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel password-change-panel">
        <div className="modal-header">
          <h2>Cambia tu contraseña</h2>
        </div>
        <p className="password-change-lead">
          Es tu primer acceso. Por seguridad debes reemplazar la contraseña genérica que te
          entregaron.
        </p>

        <form className="modal-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <label className="login-field" htmlFor="pwd-current">
            Contraseña actual
            <span className="login-input-wrap">
              <Lock className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
              <input
                id="pwd-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </span>
          </label>

          <label className="login-field" htmlFor="pwd-new">
            Nueva contraseña
            <span className="login-input-wrap">
              <Lock className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
              <input
                id="pwd-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                disabled={submitting}
              />
            </span>
          </label>

          <label className="login-field" htmlFor="pwd-confirm">
            Confirmar nueva contraseña
            <span className="login-input-wrap">
              <Lock className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
              <input
                id="pwd-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
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
            {submitting ? 'Guardando...' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
