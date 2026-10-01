import { useState, type FormEvent } from 'react'
import { completeMyProfile } from '../api/administradores'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle, IdCard, User } from '../icons'

function needsProfile(nombre: string | null | undefined, cedula: string | null | undefined) {
  return !String(nombre || '').trim() || !String(cedula || '').replace(/\D/g, '').trim()
}

export function CompleteProfileModal() {
  const { user, administrador, setAdministrador } = useAuth()
  const [nombre, setNombre] = useState(administrador?.nombre || '')
  const [cedula, setCedula] = useState(administrador?.cedula || '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const nombreValue = nombre.trim()
    const cedulaValue = cedula.replace(/\D/g, '')

    if (nombreValue.length < 2) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/.test(nombreValue)) {
      setError('El nombre solo puede contener letras.')
      return
    }
    if (cedulaValue.length < 5 || cedulaValue.length > 12) {
      setError('La cédula debe tener entre 5 y 12 dígitos.')
      return
    }

    if (!user) {
      setError('No hay una sesión válida.')
      return
    }

    setSubmitting(true)
    try {
      const token = await user.getIdToken()
      const perfil = await completeMyProfile(token, {
        nombre: nombreValue,
        cedula: cedulaValue,
      })
      setAdministrador(perfil)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el perfil')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay password-change-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel password-change-panel">
        <div className="modal-header">
          <h2>Completa tu perfil</h2>
        </div>
        <p className="password-change-lead">
          Para continuar en el panel debes registrar tu nombre y número de cédula. Son
          obligatorios para vendedores y administradores.
        </p>

        <form className="modal-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <label className="login-field" htmlFor="profile-nombre">
            Nombre completo
            <span className="login-input-wrap">
              <User className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
              <input
                id="profile-nombre"
                type="text"
                autoComplete="name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                disabled={submitting}
                autoFocus
                placeholder="Nombre y apellido"
              />
            </span>
          </label>

          <label className="login-field" htmlFor="profile-cedula">
            Número de cédula
            <span className="login-input-wrap">
              <IdCard className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
              <input
                id="profile-cedula"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={cedula}
                onChange={(e) => setCedula(e.target.value.replace(/\D/g, '').slice(0, 12))}
                required
                disabled={submitting}
                placeholder="Solo números"
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
            {submitting ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function profileNeedsCompletion(
  administrador: { rol?: string; nombre?: string | null; cedula?: string | null } | null,
): boolean {
  if (!administrador) return false
  if (administrador.rol === 'owner') return false
  if (administrador.rol !== 'admin' && administrador.rol !== 'vendedor') return false
  return needsProfile(administrador.nombre, administrador.cedula)
}
