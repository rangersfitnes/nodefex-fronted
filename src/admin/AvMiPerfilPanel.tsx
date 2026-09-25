import { useEffect, useState } from 'react'
import {
  ADMIN_ACCIONES_AUDIOVISUAL,
  formatCop,
  type AdminAccion,
  type ProyectoAccesoConfig,
  type ProyectoGananciaConfig,
} from '../api/administradores'
import {
  getAvContrato,
  getAvGenioAdmin,
  listAvNotificaciones,
  type AvContrato,
  type AvGenioAdmin,
  type AvNotificacion,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Bell,
  FileText,
  IdCard,
  Link2,
  LoaderCircle,
  Shield,
  User,
} from '../icons'

const NIVEL_LABEL: Record<string, string> = {
  view: 'Solo visualizar',
  custom: 'Acciones personalizadas',
  manage: 'Todas las acciones',
}

function normalizeProjectKey(proyectoId: string): string {
  return proyectoId.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function isAudiovisualProjectId(proyectoId: string): boolean {
  const key = normalizeProjectKey(proyectoId)
  return (
    key === 'nodefex-audio-visual' ||
    key === 'nodefex-audiovisual' ||
    key.includes('audio-visual') ||
    key.includes('audiovisual')
  )
}

function resolveAudiovisualAccess(
  accesos: Record<string, ProyectoAccesoConfig> | undefined,
  preferred?: ProyectoAccesoConfig | null,
): { proyectoId: string | null; access: ProyectoAccesoConfig | null } {
  let proyectoId: string | null = null
  for (const key of Object.keys(accesos || {})) {
    if (isAudiovisualProjectId(key)) {
      proyectoId = key
      break
    }
  }
  return {
    proyectoId,
    access: preferred || (proyectoId && accesos ? accesos[proyectoId] : null),
  }
}

function resolveAudiovisualGanancia(
  ganancias: Record<string, ProyectoGananciaConfig> | undefined,
  proyectoId: string | null,
): ProyectoGananciaConfig | null {
  if (!ganancias) return null
  if (proyectoId && ganancias[proyectoId]) return ganancias[proyectoId]
  for (const [key, value] of Object.entries(ganancias)) {
    if (isAudiovisualProjectId(key)) return value
  }
  return null
}

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

function capabilityMode(
  access: ProyectoAccesoConfig,
  accion: AdminAccion,
): 'manage' | 'view' | 'none' {
  if (access.nivel === 'manage') return 'manage'
  if (access.nivel === 'view') return 'view'
  if (access.acciones.includes(accion)) return 'manage'
  if ((access.visualizar || []).includes(accion)) return 'view'
  return 'none'
}

const MODE_LABEL = {
  manage: 'Puede gestionar',
  view: 'Solo visualizar',
  none: 'Sin acceso',
} as const

type AvMiPerfilPanelProps = {
  access?: ProyectoAccesoConfig | null
}

export function AvMiPerfilPanel({ access = null }: AvMiPerfilPanelProps) {
  const { user, administrador } = useAuth()
  const [contrato, setContrato] = useState<AvContrato | null>(null)
  const [genioAdmin, setGenioAdmin] = useState<AvGenioAdmin | null>(null)
  const [notificaciones, setNotificaciones] = useState<AvNotificacion[]>([])
  const [extraLoading, setExtraLoading] = useState(true)
  const [extraError, setExtraError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setExtraLoading(true)
      setExtraError('')
      try {
        const token = await user.getIdToken()
        const [contratoData, genioData, notificacionesData] = await Promise.all([
          getAvContrato(token),
          getAvGenioAdmin(token),
          listAvNotificaciones(token),
        ])
        if (cancelled) return
        setContrato(contratoData)
        setGenioAdmin(genioData)
        setNotificaciones(notificacionesData)
      } catch (err) {
        if (!cancelled) {
          setExtraError(
            err instanceof Error ? err.message : 'No se pudieron cargar avisos o contrato',
          )
        }
      } finally {
        if (!cancelled) setExtraLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  if (!administrador) {
    return (
      <div className="av-mi-perfil" role="tabpanel" aria-label="Mi perfil">
        <div className="proyectos-empty">
          <User size={28} strokeWidth={1.75} aria-hidden />
          <p>No se pudo cargar tu perfil de administrador.</p>
        </div>
      </div>
    )
  }

  const { proyectoId, access: resolvedAccess } = resolveAudiovisualAccess(
    administrador.accesos,
    access,
  )
  const ganancia = resolveAudiovisualGanancia(administrador.ganancias, proyectoId)

  return (
    <div className="av-mi-perfil" role="tabpanel" aria-label="Mi perfil">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Mi perfil</h3>
          <p className="section-note">
            Tu información como administrador en Nodefex Audio Visual.
          </p>
        </div>
      </div>

      <div className="av-ingresos-detail">
        <div className="av-ingresos-detail-head">
          <div>
            <p className="av-ingresos-kicker">Administrador</p>
            <h3>{administrador.nombre || administrador.email || 'Sin nombre'}</h3>
            <p className="section-note">{administrador.email || 'Sin correo'}</p>
          </div>
          <span className="av-estado av-estado-parcial">
            <Shield size={14} strokeWidth={2} aria-hidden />
            Admin
          </span>
        </div>

        <dl className="av-ingresos-meta">
          <div>
            <dt>Nombre</dt>
            <dd>{administrador.nombre || '—'}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{administrador.email || '—'}</dd>
          </div>
          <div>
            <dt>
              <span className="av-mi-perfil-dt-inline">
                <IdCard size={14} strokeWidth={2} aria-hidden />
                Cédula
              </span>
            </dt>
            <dd>{administrador.cedula || '—'}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>Administrador</dd>
          </div>
          <div>
            <dt>Cuenta creada</dt>
            <dd>{formatFecha(administrador.createdAt)}</dd>
          </div>
          <div>
            <dt>Último acceso</dt>
            <dd>{formatFecha(administrador.lastSignInAt)}</dd>
          </div>
        </dl>

        <section className="av-cliente-section">
          <h3>Acceso a Nodefex Audio Visual</h3>
          {resolvedAccess ? (
            <>
              <dl className="av-ingresos-meta">
                <div>
                  <dt>Nivel de acceso</dt>
                  <dd>{NIVEL_LABEL[resolvedAccess.nivel] || resolvedAccess.nivel}</dd>
                </div>
                <div>
                  <dt>Proyecto</dt>
                  <dd>{proyectoId || 'Nodefex Audio Visual'}</dd>
                </div>
              </dl>

              {resolvedAccess.nivel === 'custom' ? (
                <div className="av-mi-perfil-permisos">
                  <p className="section-note">Permisos por pestaña</p>
                  <ul className="av-mi-perfil-permisos-list">
                    {ADMIN_ACCIONES_AUDIOVISUAL.map((item) => {
                      const mode = capabilityMode(resolvedAccess, item.id)
                      return (
                        <li key={item.id}>
                          <span>{item.label}</span>
                          <strong data-mode={mode}>{MODE_LABEL[mode]}</strong>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : (
                <p className="section-note">
                  {resolvedAccess.nivel === 'manage'
                    ? 'Tienes acceso completo para gestionar todas las pestañas.'
                    : 'Puedes visualizar todas las pestañas, sin permiso para hacer cambios.'}
                </p>
              )}
            </>
          ) : (
            <p className="section-note">No hay configuración de acceso disponible.</p>
          )}
        </section>

        <section className="av-cliente-section">
          <h3>Ganancias del proyecto</h3>
          {ganancia?.activa ? (
            <div className="contable-summary">
              <div>
                <span>Estado</span>
                <strong>Activas</strong>
              </div>
              <div>
                <span>% por mensualidad</span>
                <strong>{ganancia.porcentaje}%</strong>
              </div>
              <div>
                <span>Acumulado</span>
                <strong>{formatCop(ganancia.total || 0)}</strong>
              </div>
            </div>
          ) : (
            <p className="section-note">
              Las ganancias para este proyecto están apagadas o no están configuradas.
            </p>
          )}
        </section>

        <section className="av-cliente-section">
          <h3>Contrato de la sociedad</h3>
          {extraLoading ? (
            <div className="proyectos-status">
              <LoaderCircle className="spin" size={18} strokeWidth={2} aria-hidden />
              Cargando contrato...
            </div>
          ) : null}
          {!extraLoading && extraError ? (
            <p className="login-error" role="alert">
              <AlertCircle size={16} strokeWidth={2} aria-hidden />
              {extraError}
            </p>
          ) : null}
          {!extraLoading && !extraError && contrato ? (
            <div className="av-contrato-card">
              <div>
                <strong>{contrato.fileName || 'Contrato'}</strong>
                <p className="section-note">
                  {contrato.source === 'docs' || contrato.source === 'sheets'
                    ? 'Google Docs'
                    : formatBytes(contrato.size)}
                  {contrato.uploadedAt ? ` · ${formatFecha(contrato.uploadedAt)}` : ''}
                </p>
              </div>
              {contrato.downloadUrl || contrato.externalUrl ? (
                <a
                  className="btn-secondary"
                  href={contrato.downloadUrl || contrato.externalUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText size={16} strokeWidth={2} aria-hidden />
                  Ver contrato
                </a>
              ) : null}
            </div>
          ) : null}
          {!extraLoading && !extraError && !contrato ? (
            <p className="section-note">Aún no hay un contrato publicado por el propietario.</p>
          ) : null}
        </section>

        <section className="av-cliente-section">
          <h3>Administración del Genio</h3>
          {extraLoading ? (
            <div className="proyectos-status">
              <LoaderCircle size={18} strokeWidth={2} aria-hidden className="spin" />
              Cargando enlace...
            </div>
          ) : null}
          {!extraLoading && !extraError && genioAdmin?.externalUrl ? (
            <div className="av-contrato-card">
              <div>
                <strong>{genioAdmin.titulo || 'Administración del Genio'}</strong>
                <p className="section-note">
                  Google Sheets
                  {genioAdmin.updatedAt ? ` · ${formatFecha(genioAdmin.updatedAt)}` : ''}
                </p>
              </div>
              <a
                className="btn-secondary"
                href={genioAdmin.externalUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Link2 size={16} strokeWidth={2} aria-hidden />
                Ver administración
              </a>
            </div>
          ) : null}
          {!extraLoading && !extraError && !genioAdmin?.externalUrl ? (
            <p className="section-note">
              Aún no hay un Google Sheets del Genio publicado por el propietario.
            </p>
          ) : null}
        </section>

        <section className="av-cliente-section">
          <h3>
            <span className="av-mi-perfil-dt-inline">
              <Bell size={16} strokeWidth={2} aria-hidden />
              Notificaciones
            </span>
          </h3>
          {extraLoading ? (
            <div className="proyectos-status">
              <LoaderCircle className="spin" size={18} strokeWidth={2} aria-hidden />
              Cargando notificaciones...
            </div>
          ) : null}
          {!extraLoading && !extraError && notificaciones.length === 0 ? (
            <p className="section-note">No tienes notificaciones por ahora.</p>
          ) : null}
          {!extraLoading && notificaciones.length > 0 ? (
            <ul className="av-notif-list">
              {notificaciones.map((item) => (
                <li key={item.id} className="av-notif-item">
                  <div className="av-notif-item-head">
                    <strong>{item.titulo || 'Aviso'}</strong>
                    <span>{formatFecha(item.creadoEn)}</span>
                  </div>
                  <p>{item.mensaje || '—'}</p>
                  <p className="section-note">
                    {item.alcance === 'todos' ? 'Para todos los administradores' : 'Dirigida a ti'}
                    {item.createdByNombre || item.createdByEmail
                      ? ` · De ${item.createdByNombre || item.createdByEmail}`
                      : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  )
}
