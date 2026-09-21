import { useEffect, useState, type FormEvent } from 'react'
import {
  createAvNotificacion,
  getAvContrato,
  listAvGestionAdmins,
  listAvNotificaciones,
  uploadAvContrato,
  type AvContrato,
  type AvGestionAdmin,
  type AvNotificacion,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Check,
  FileText,
  LoaderCircle,
  RefreshCw,
  Send,
  Upload,
} from '../icons'

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function formatBytes(size: number | null): string {
  if (!size || size <= 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.includes(',') ? result.split(',')[1] || '' : result
      if (!base64) {
        reject(new Error('No se pudo leer el archivo'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

export function AvOwnerGestionPanel() {
  const { user } = useAuth()

  const [contrato, setContrato] = useState<AvContrato | null>(null)
  const [admins, setAdmins] = useState<AvGestionAdmin[]>([])
  const [notificaciones, setNotificaciones] = useState<AvNotificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')

  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [alcance, setAlcance] = useState<'todos' | 'admin'>('todos')
  const [adminUid, setAdminUid] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const [contratoData, adminsData, notificacionesData] = await Promise.all([
          getAvContrato(token),
          listAvGestionAdmins(token),
          listAvNotificaciones(token),
        ])
        if (cancelled) return
        setContrato(contratoData)
        setAdmins(adminsData)
        setNotificaciones(notificacionesData)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la gestión')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, refreshTick])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || uploading) return
    const form = event.currentTarget
    const input = form.elements.namedItem('contrato-file') as HTMLInputElement | null
    const file = input?.files?.[0]
    if (!file) {
      setUploadError('Selecciona un archivo para subir.')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setUploadError('El archivo supera el límite de 12 MB.')
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadSuccess('')
    try {
      const token = await user.getIdToken()
      const contentBase64 = await fileToBase64(file)
      const updated = await uploadAvContrato(token, {
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        contentBase64,
      })
      setContrato(updated)
      setUploadSuccess('Contrato actualizado correctamente.')
      form.reset()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo subir el contrato')
    } finally {
      setUploading(false)
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || sending) return

    const cleanTitulo = titulo.trim()
    const cleanMensaje = mensaje.trim()
    if (!cleanTitulo) {
      setSendError('El título es obligatorio.')
      return
    }
    if (!cleanMensaje) {
      setSendError('El mensaje es obligatorio.')
      return
    }
    if (alcance === 'admin' && !adminUid) {
      setSendError('Selecciona un administrador.')
      return
    }

    setSending(true)
    setSendError('')
    setSendSuccess('')
    try {
      const token = await user.getIdToken()
      const created = await createAvNotificacion(token, {
        titulo: cleanTitulo,
        mensaje: cleanMensaje,
        alcance,
        adminUid: alcance === 'admin' ? adminUid : undefined,
      })
      setNotificaciones((current) => [created, ...current])
      setTitulo('')
      setMensaje('')
      setAlcance('todos')
      setAdminUid('')
      setSendSuccess('Notificación enviada.')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'No se pudo enviar la notificación')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="av-owner-gestion" role="tabpanel" aria-label="Contrato y avisos">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Contrato y avisos</h3>
          <p className="section-note">
            Sube el contrato de la sociedad y envía notificaciones a los administradores del
            proyecto.
          </p>
        </div>
        <div className="av-ingresos-toolbar-actions">
          <button
            type="button"
            className="btn-secondary contable-refresh"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading}
            aria-label="Actualizar"
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden className={loading ? 'spin' : undefined} />
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="av-ingresos-detail">
          <section className="av-cliente-section">
            <h3>Contrato de la sociedad</h3>
            <p className="section-note">
              Un solo archivo vigente. Al subir uno nuevo se reemplaza el anterior.
            </p>

            {contrato ? (
              <div className="av-contrato-card">
                <div>
                  <strong>{contrato.fileName || 'Contrato'}</strong>
                  <p className="section-note">
                    {formatBytes(contrato.size)}
                    {contrato.uploadedAt ? ` · ${formatFecha(contrato.uploadedAt)}` : ''}
                    {contrato.uploadedByNombre || contrato.uploadedByEmail
                      ? ` · ${contrato.uploadedByNombre || contrato.uploadedByEmail}`
                      : ''}
                  </p>
                </div>
                {contrato.downloadUrl ? (
                  <a
                    className="btn-secondary"
                    href={contrato.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={16} strokeWidth={2} aria-hidden />
                    Ver / descargar
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="section-note">Aún no hay un contrato cargado.</p>
            )}

            <form className="av-cliente-form" onSubmit={(event) => void handleUpload(event)}>
              <label className="login-field" htmlFor="contrato-file">
                Archivo (PDF, Word o imagen · máx. 12 MB)
                <input
                  id="contrato-file"
                  name="contrato-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                  disabled={uploading}
                  required
                />
              </label>

              {uploadError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {uploadError}
                </p>
              ) : null}
              {uploadSuccess ? (
                <p className="av-cliente-success">
                  <Check size={16} strokeWidth={2} aria-hidden /> {uploadSuccess}
                </p>
              ) : null}

              <div className="av-ingresos-form-actions">
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload size={16} strokeWidth={2} aria-hidden />
                      {contrato ? 'Reemplazar contrato' : 'Subir contrato'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <section className="av-cliente-section">
            <h3>Enviar notificación</h3>
            <form className="av-cliente-form" onSubmit={(event) => void handleSend(event)} noValidate>
              <div className="av-ingresos-form-grid">
                <label className="login-field av-ingresos-span-2" htmlFor="av-notif-titulo">
                  Título
                  <input
                    id="av-notif-titulo"
                    type="text"
                    value={titulo}
                    onChange={(event) => setTitulo(event.target.value)}
                    disabled={sending}
                    required
                  />
                </label>

                <label className="login-field av-ingresos-span-2" htmlFor="av-notif-mensaje">
                  Mensaje
                  <textarea
                    id="av-notif-mensaje"
                    value={mensaje}
                    onChange={(event) => setMensaje(event.target.value)}
                    rows={4}
                    disabled={sending}
                    required
                  />
                </label>

                <fieldset className="av-cliente-fieldset av-ingresos-span-2">
                  <legend>Destinatarios</legend>
                  <div className="av-cliente-radio-row">
                    <label className="av-plan-activo" htmlFor="av-notif-todos">
                      <input
                        id="av-notif-todos"
                        type="radio"
                        name="alcance"
                        checked={alcance === 'todos'}
                        onChange={() => setAlcance('todos')}
                        disabled={sending}
                      />
                      Todos los administradores
                    </label>
                    <label className="av-plan-activo" htmlFor="av-notif-admin">
                      <input
                        id="av-notif-admin"
                        type="radio"
                        name="alcance"
                        checked={alcance === 'admin'}
                        onChange={() => setAlcance('admin')}
                        disabled={sending}
                      />
                      Un administrador
                    </label>
                  </div>
                </fieldset>

                {alcance === 'admin' ? (
                  <label className="login-field av-ingresos-span-2" htmlFor="av-notif-admin-uid">
                    Administrador
                    <select
                      id="av-notif-admin-uid"
                      value={adminUid}
                      onChange={(event) => setAdminUid(event.target.value)}
                      disabled={sending || admins.length === 0}
                      required
                    >
                      <option value="">Selecciona un administrador</option>
                      {admins.map((admin) => (
                        <option key={admin.uid} value={admin.uid}>
                          {admin.nombre || admin.email || admin.uid}
                          {admin.nombre && admin.email ? ` · ${admin.email}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {admins.length === 0 ? (
                <p className="section-note">
                  No hay administradores con acceso a Nodefex Audio Visual para notificar.
                </p>
              ) : null}

              {sendError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {sendError}
                </p>
              ) : null}
              {sendSuccess ? (
                <p className="av-cliente-success">
                  <Check size={16} strokeWidth={2} aria-hidden /> {sendSuccess}
                </p>
              ) : null}

              <div className="av-ingresos-form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={sending || (alcance === 'admin' && admins.length === 0)}
                >
                  {sending ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={16} strokeWidth={2} aria-hidden />
                      Enviar notificación
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <section className="av-cliente-section">
            <h3>Notificaciones enviadas</h3>
            {notificaciones.length === 0 ? (
              <p className="section-note">Aún no has enviado notificaciones.</p>
            ) : (
              <div className="pagos-table-wrap">
                <table className="pagos-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Título</th>
                      <th>Destinatario</th>
                      <th>Mensaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notificaciones.map((item) => (
                      <tr key={item.id}>
                        <td>{formatFecha(item.creadoEn)}</td>
                        <td>{item.titulo || '—'}</td>
                        <td>
                          {item.alcance === 'todos'
                            ? 'Todos'
                            : item.adminNombre || item.adminEmail || item.adminUid || '—'}
                        </td>
                        <td>{item.mensaje || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
