import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  connectAvCrmWhatsapp,
  createAvCrmVendedor,
  deleteAvCrmVendedor,
  disconnectAvCrmWhatsapp,
  fetchAvCrmMessageAudio,
  fetchAvCrmMessageDocument,
  fetchAvCrmMessageImage,
  getAvCrmChat,
  getAvCrmWhatsappStatus,
  listAvCrmChats,
  listAvCrmCotizaciones,
  listAvCrmMensajesPredeterminados,
  listAvCrmRecursos,
  listAvCrmVendedores,
  saveAvCrmRecursoSolicitarDatos,
  saveAvCrmVendedorAccesos,
  sendAvCrmDocument,
  sendAvCrmMessage,
  type AvCotizacion,
  type AvCrmChat,
  type AvCrmChatLastResponder,
  type AvCrmMensajePredeterminado,
  type AvCrmMessage,
  type AvCrmRecurso,
  type AvCrmVendedor,
  type AvCrmWhatsappStatus,
} from '../api/audiovisual'
import {
  ADMIN_ACCIONES_AUDIOVISUAL,
  formatCop,
  type AdminAccion,
} from '../api/administradores'
import { esProyectoAudiovisual } from '../api/proyectos'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  FileText,
  Link2,
  LoaderCircle,
  MessageCircle,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  StickyNote,
  Trash2,
  Users,
  Video,
  X,
} from '../icons'
import { buildAvCotizacionPdf } from './avCotizacionPdf'
import { AvCrmAutoMensajesPanel } from './AvCrmAutoMensajesPanel'
import { AvCrmMensajesPanel } from './AvCrmMensajesPanel'

const VENDEDOR_ACCIONES = ADMIN_ACCIONES_AUDIOVISUAL.filter(
  (item) => item.id !== 'av_accesos',
)

function getVendedorAvAcciones(vendedor: AvCrmVendedor): AdminAccion[] {
  const accesos = vendedor.accesos || {}
  for (const [key, value] of Object.entries(accesos)) {
    if (!esProyectoAudiovisual(key)) continue
    if (value.nivel === 'manage') {
      return VENDEDOR_ACCIONES.map((item) => item.id)
    }
    const acciones = Array.isArray(value.acciones)
      ? value.acciones.filter((id): id is AdminAccion =>
          VENDEDOR_ACCIONES.some((item) => item.id === id),
        )
      : []
    return Array.from(new Set<AdminAccion>(['av_crm', ...acciones]))
  }
  return ['av_crm']
}

const EMPTY_STATUS: AvCrmWhatsappStatus = {
  status: 'idle',
  connected: false,
  hasQr: false,
  qrDataUrl: null,
  phoneNumber: null,
  lastError: null,
}

function statusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Conectado'
    case 'qr':
      return 'Escanea el código QR'
    case 'connecting':
      return 'Conectando…'
    case 'close':
      return 'Desconectado'
    case 'idle':
      return 'Sin vincular'
    default:
      return status
  }
}

function formatChatTime(ts: number | null | undefined): string {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatMessageTime(ts: number | null | undefined): string {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function MessageTicks({ status }: { status: string | null }) {
  if (!status) return null
  if (status === 'pending' || status === 'error') {
    return <Check size={14} strokeWidth={2.25} className="av-wa-tick av-wa-tick-pending" aria-hidden />
  }
  if (status === 'server') {
    return <Check size={14} strokeWidth={2.25} className="av-wa-tick" aria-hidden />
  }
  if (status === 'delivered') {
    return <CheckCheck size={14} strokeWidth={2.25} className="av-wa-tick" aria-hidden />
  }
  if (status === 'read' || status === 'played') {
    return <CheckCheck size={14} strokeWidth={2.25} className="av-wa-tick av-wa-tick-read" aria-hidden />
  }
  return null
}

function formatAudioDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function CrmAudioPlayer({
  chatId,
  message,
}: {
  chatId: string
  message: AvCrmMessage
}) {
  const { user } = useAuth()
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  async function ensureLoaded() {
    if (!user || !message.id || src || loading) return
    setLoading(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const blob = await fetchAvCrmMessageAudio(token, chatId, message.id)
      const url = URL.createObjectURL(blob)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = url
      setSrc(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el audio')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`av-wa-audio ${message.isPtt ? 'is-ptt' : ''}`}>
      {src ? (
        <audio
          className="av-wa-audio-el"
          controls
          preload="metadata"
          src={src}
          autoPlay
        >
          Tu navegador no reproduce este audio.
        </audio>
      ) : (
        <button
          type="button"
          className="av-wa-audio-play"
          onClick={() => void ensureLoaded()}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
          ) : (
            <span className="av-wa-audio-play-icon" aria-hidden />
          )}
          <span>
            {message.isPtt ? 'Nota de voz' : 'Audio'}
            {message.audioSeconds ? ` · ${formatAudioDuration(message.audioSeconds)}` : ''}
          </span>
        </button>
      )}
      {error ? <span className="av-wa-audio-error">{error}</span> : null}
    </div>
  )
}

function CrmImageMessage({
  chatId,
  message,
}: {
  chatId: string
  message: AvCrmMessage
}) {
  const { user } = useAuth()
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user || !message.id || src) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const blob = await fetchAvCrmMessageImage(token, chatId, message.id)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = url
        setSrc(url)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la imagen')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, chatId, message.id, src])

  const caption = message.imageCaption?.trim() || null

  return (
    <div className={`av-wa-image ${message.imageKind === 'sticker' ? 'is-sticker' : ''}`}>
      {loading && !src ? (
        <div className="av-wa-image-loading">
          <LoaderCircle className="spin" size={18} strokeWidth={2} aria-hidden />
          Cargando imagen…
        </div>
      ) : null}
      {src ? (
        <button
          type="button"
          className="av-wa-image-btn"
          onClick={() => setLightbox(true)}
          aria-label="Ver imagen ampliada"
        >
          <img src={src} alt={caption || 'Imagen del chat'} />
        </button>
      ) : null}
      {error ? <span className="av-wa-image-error">{error}</span> : null}
      {caption ? <p className="av-wa-image-caption">{caption}</p> : null}

      {lightbox && src ? (
        <div
          className="av-wa-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
          onClick={() => setLightbox(false)}
        >
          <img src={src} alt={caption || 'Imagen ampliada'} onClick={(e) => e.stopPropagation()} />
          <button
            type="button"
            className="av-wa-image-lightbox-close"
            aria-label="Cerrar"
            onClick={() => setLightbox(false)}
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function CrmDocumentMessage({
  chatId,
  message,
}: {
  chatId: string
  message: AvCrmMessage
}) {
  const { user } = useAuth()
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewerOpen, setViewerOpen] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  const fileName = message.documentFileName || (message.isPdf ? 'documento.pdf' : 'documento')
  const metaBits = [
    message.isPdf ? 'PDF' : message.documentMimetype || 'Documento',
    formatFileSize(message.documentFileLength),
    message.documentPageCount ? `${message.documentPageCount} pág.` : '',
  ].filter(Boolean)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!viewerOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setViewerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewerOpen])

  async function ensureLoaded() {
    if (!user || !message.id || src || loading) return src
    setLoading(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const blob = await fetchAvCrmMessageDocument(token, chatId, message.id)
      const typed =
        message.isPdf || /pdf/i.test(message.documentMimetype || '')
          ? new Blob([blob], { type: 'application/pdf' })
          : blob
      const url = URL.createObjectURL(typed)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = url
      setSrc(url)
      return url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el documento')
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleOpen() {
    const url = src || (await ensureLoaded())
    if (!url) return
    if (message.isPdf || /pdf/i.test(message.documentMimetype || '')) {
      setViewerOpen(true)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`av-wa-doc ${message.isPdf ? 'is-pdf' : ''}`}>
      <button
        type="button"
        className="av-wa-doc-card"
        onClick={() => void handleOpen()}
        disabled={loading}
      >
        <span className="av-wa-doc-icon" aria-hidden>
          <FileText size={22} strokeWidth={1.75} />
        </span>
        <span className="av-wa-doc-meta">
          <strong>{fileName}</strong>
          <span>{loading ? 'Cargando…' : metaBits.join(' · ')}</span>
        </span>
        <span className="av-wa-doc-action">{message.isPdf ? 'Ver' : 'Abrir'}</span>
      </button>
      {message.documentCaption ? (
        <p className="av-wa-doc-caption">{message.documentCaption}</p>
      ) : null}
      {error ? <span className="av-wa-doc-error">{error}</span> : null}

      {viewerOpen && src ? (
        <div
          className="av-wa-doc-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={fileName}
        >
          <div className="av-wa-doc-lightbox-bar">
            <strong>{fileName}</strong>
            <div className="av-wa-doc-lightbox-actions">
              <a
                className="btn-secondary"
                href={src}
                target="_blank"
                rel="noreferrer"
              >
                Abrir en pestaña
              </a>
              <button
                type="button"
                className="modal-close"
                onClick={() => setViewerOpen(false)}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
          <iframe title={fileName} src={src} className="av-wa-doc-frame" />
        </div>
      ) : null}
    </div>
  )
}

function Avatar({
  name,
  url,
  size = 42,
}: {
  name: string
  url?: string | null
  size?: number
}) {
  if (url) {
    return (
      <img
        className="av-wa-avatar"
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <span className="av-wa-avatar av-wa-avatar-fallback" style={{ width: size, height: size }}>
      {initials(name)}
    </span>
  )
}

function normalizeResponders(chat: AvCrmChat): AvCrmChatLastResponder[] {
  const list = Array.isArray(chat.responders) ? chat.responders : []
  if (list.length > 0) {
    return [...list]
      .filter((item) => Boolean(item?.nombre))
      .sort((a, b) => (b.at || 0) - (a.at || 0))
  }
  if (chat.lastResponder?.nombre) return [chat.lastResponder]
  return []
}

function ChatRespondersBadge({ responders }: { responders: AvCrmChatLastResponder[] }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  if (responders.length === 0) return null

  if (responders.length === 1) {
    return (
      <span className="av-wa-chat-agent" title="Vendedor que respondió">
        {responders[0].nombre}
      </span>
    )
  }

  const latest = responders[0]
  return (
    <div className={`av-wa-chat-agents ${open ? 'is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="av-wa-chat-agent av-wa-chat-agents-toggle"
        aria-expanded={open}
        aria-label={`Vendedores que gestionaron este chat (${responders.length})`}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        <span>
          {latest.nombre} · {responders.length}
        </span>
        <ChevronDown size={12} strokeWidth={2.25} aria-hidden />
      </button>
      {open ? (
        <ul className="av-wa-chat-agents-menu" role="list">
          {responders.map((item) => (
            <li key={item.uid || `${item.nombre}-${item.at || 0}`}>
              <strong>{item.nombre}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function LinkedWhatsappCard({
  status,
  variant = 'sidebar',
}: {
  status: AvCrmWhatsappStatus
  variant?: 'sidebar' | 'modal'
}) {
  const name = status.pushName || 'WhatsApp'
  const phone =
    status.phoneDisplay ||
    (status.phoneNumber ? `+${String(status.phoneNumber).replace(/\D/g, '')}` : null)
  const size = variant === 'modal' ? 72 : 48

  return (
    <div className={`av-wa-linked av-wa-linked-${variant}`}>
      <div className="av-wa-linked-avatar-wrap">
        <Avatar name={name} url={status.profilePicUrl} size={size} />
        <span className="av-wa-linked-online" title="Conectado" aria-hidden />
      </div>
      <div className="av-wa-linked-meta">
        <strong>{name}</strong>
        {phone ? <span className="av-wa-linked-phone">{phone}</span> : null}
        <span className="av-wa-linked-status">
          <span className="av-wa-linked-status-dot" aria-hidden />
          Vinculado y en línea
        </span>
      </div>
    </div>
  )
}

export function AvCrmPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user, isOwner, isVendedor } = useAuth()
  const [status, setStatus] = useState<AvCrmWhatsappStatus>(EMPTY_STATUS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [chats, setChats] = useState<AvCrmChat[]>([])
  const [chatQuery, setChatQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeChat, setActiveChat] = useState<AvCrmChat | null>(null)
  const [messages, setMessages] = useState<AvCrmMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const [cannedOpen, setCannedOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [recursos, setRecursos] = useState<AvCrmRecurso[]>([])
  const [recursosLoading, setRecursosLoading] = useState(false)
  const [recursosError, setRecursosError] = useState('')
  const [recursoEditTexto, setRecursoEditTexto] = useState('')
  const [recursoEditing, setRecursoEditing] = useState(false)
  const [recursoSaving, setRecursoSaving] = useState(false)
  const [recursoSending, setRecursoSending] = useState(false)
  const [cotizacionesCrm, setCotizacionesCrm] = useState<AvCotizacion[]>([])
  const [cotizacionesCrmLoading, setCotizacionesCrmLoading] = useState(false)
  const [cotizacionQuery, setCotizacionQuery] = useState('')
  const [cotizacionSendingId, setCotizacionSendingId] = useState<string | null>(null)
  const [cannedMessages, setCannedMessages] = useState<AvCrmMensajePredeterminado[]>([])
  const [cannedLoading, setCannedLoading] = useState(false)
  const [cannedError, setCannedError] = useState('')
  const [cannedRefreshTick, setCannedRefreshTick] = useState(0)
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null)

  const [vendedoresOpen, setVendedoresOpen] = useState(false)
  const [mensajesRapidosOpen, setMensajesRapidosOpen] = useState(false)
  const [autoMensajesOpen, setAutoMensajesOpen] = useState(false)
  const [vendedores, setVendedores] = useState<AvCrmVendedor[]>([])
  const [vendedoresLoading, setVendedoresLoading] = useState(false)
  const [vendedoresError, setVendedoresError] = useState('')
  const [vendedorNombre, setVendedorNombre] = useState('')
  const [vendedorCedula, setVendedorCedula] = useState('')
  const [vendedorEmail, setVendedorEmail] = useState('')
  const [vendedorPassword, setVendedorPassword] = useState('')
  const [vendedorSaving, setVendedorSaving] = useState(false)
  const [vendedorDeletingUid, setVendedorDeletingUid] = useState<string | null>(null)
  const [vendedorExpandedUid, setVendedorExpandedUid] = useState<string | null>(null)
  const [vendedorDraftAcciones, setVendedorDraftAcciones] = useState<AdminAccion[]>(['av_crm'])
  const [vendedorAccesosSaving, setVendedorAccesosSaving] = useState(false)

  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const connected = status.connected
  const canDisconnect = isOwner && !readOnly
  const canManageVendedores = isOwner && !readOnly
  const canOpenMensajesRapidos = !readOnly && (isOwner || isVendedor)
  const canManageAutoMensajes = isOwner && !readOnly

  function resizeComposer() {
    const el = composerInputRef.current
    if (!el) return
    el.style.height = 'auto'
    const styles = window.getComputedStyle(el)
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20
    const paddingY =
      Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
    const maxHeight = lineHeight * 4 + paddingY
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }

  useEffect(() => {
    resizeComposer()
  }, [draft])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await getAvCrmWhatsappStatus(token)
        if (!cancelled) setStatus(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el estado de WhatsApp')
          setStatus(EMPTY_STATUS)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    // Mantener estado al día tras recargas / reconexión del backend.
    const id = window.setInterval(() => {
      if (!user) return
      void (async () => {
        try {
          const token = await user.getIdToken()
          const data = await getAvCrmWhatsappStatus(token)
          if (!cancelled) setStatus(data)
        } catch {
          // ignore
        }
      })()
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user])

  useEffect(() => {
    if (!modalOpen || !user) return
    let cancelled = false

    async function poll() {
      try {
        const token = await user!.getIdToken()
        const data = await getAvCrmWhatsappStatus(token)
        if (!cancelled) setStatus(data)
      } catch {
        // ignore
      }
    }

    const id = window.setInterval(() => {
      void poll()
    }, 2500)
    void poll()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [modalOpen, user])

  useEffect(() => {
    if (!user) {
      setChats([])
      return
    }
    let cancelled = false

    async function loadChats() {
      try {
        const token = await user!.getIdToken()
        const data = await listAvCrmChats(token, { q: chatQuery, limit: 250 })
        if (cancelled) return
        setChats(data)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'No se pudieron cargar los chats'
        if (/no está vinculado|no vinculado|409/i.test(message)) {
          setStatus((current) => ({
            ...current,
            connected: false,
            status: current.status === 'open' ? 'close' : current.status,
            lastError: message,
          }))
          return
        }
        setError(message)
      }
    }

    void loadChats()
    const id = window.setInterval(() => {
      void loadChats()
    }, 3500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user, chatQuery])

  useEffect(() => {
    if (!user || !selectedId) {
      setActiveChat(null)
      setMessages([])
      return
    }
    let cancelled = false

    async function loadChat() {
      try {
        const token = await user!.getIdToken()
        const data = await getAvCrmChat(token, selectedId!, { limit: 200 })
        if (cancelled) return
        setActiveChat(data.chat)
        setMessages(data.messages)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'No se pudo abrir el chat'
        if (/no está vinculado|no vinculado|409/i.test(message)) {
          setStatus((current) => ({
            ...current,
            connected: false,
            status: current.status === 'open' ? 'close' : current.status,
            lastError: message,
          }))
          return
        }
        setError(message)
      } finally {
        if (!cancelled) setChatLoading(false)
      }
    }

    setChatLoading(true)
    void loadChat()
    const id = window.setInterval(() => {
      void loadChat()
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user, selectedId])

  useEffect(() => {
    if (!connected || !user) {
      setCannedMessages([])
      return
    }
    let cancelled = false
    async function loadCanned() {
      setCannedLoading(true)
      setCannedError('')
      try {
        const token = await user!.getIdToken()
        const list = await listAvCrmMensajesPredeterminados(token)
        if (!cancelled) setCannedMessages(list)
      } catch (err) {
        if (!cancelled) {
          setCannedError(
            err instanceof Error ? err.message : 'No se pudieron cargar los mensajes predeterminados',
          )
        }
      } finally {
        if (!cancelled) setCannedLoading(false)
      }
    }
    void loadCanned()
    return () => {
      cancelled = true
    }
  }, [connected, user, cannedRefreshTick])

  useEffect(() => {
    if (!resourcesOpen || !user) return
    let cancelled = false
    async function loadRecursos() {
      setRecursosLoading(true)
      setRecursosError('')
      setCotizacionesCrmLoading(true)
      try {
        const token = await user!.getIdToken()
        const [list, cotizaciones] = await Promise.all([
          listAvCrmRecursos(token),
          listAvCrmCotizaciones(token).catch(() => [] as AvCotizacion[]),
        ])
        if (cancelled) return
        setRecursos(list)
        setCotizacionesCrm(cotizaciones)
        const solicitar = list.find((item) => item.id === 'solicitar_datos')
        if (solicitar) setRecursoEditTexto(solicitar.texto)
      } catch (err) {
        if (!cancelled) {
          setRecursosError(err instanceof Error ? err.message : 'No se pudieron cargar los recursos')
        }
      } finally {
        if (!cancelled) {
          setRecursosLoading(false)
          setCotizacionesCrmLoading(false)
        }
      }
    }
    void loadRecursos()
    return () => {
      cancelled = true
    }
  }, [resourcesOpen, user])

  const cotizacionesFiltradas = useMemo(() => {
    const q = cotizacionQuery.trim().toLowerCase()
    if (!q) return cotizacionesCrm.slice(0, 12)
    return cotizacionesCrm
      .filter((item) => {
        const haystack = [
          item.numero,
          item.clienteNombre,
          item.clienteDocumento,
          item.clienteTelefono,
          item.resumen,
          item.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .slice(0, 20)
  }, [cotizacionesCrm, cotizacionQuery])

  function closeMensajesRapidos() {
    setMensajesRapidosOpen(false)
    setCannedRefreshTick((n) => n + 1)
  }

  async function handleSaveRecursoSolicitarDatos() {
    if (!user || !isOwner || recursoSaving) return
    const texto = recursoEditTexto.trim()
    if (!texto) {
      setRecursosError('El mensaje no puede estar vacío')
      return
    }
    setRecursoSaving(true)
    setRecursosError('')
    try {
      const token = await user.getIdToken()
      const saved = await saveAvCrmRecursoSolicitarDatos(token, texto)
      setRecursos((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      )
      setRecursoEditing(false)
    } catch (err) {
      setRecursosError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setRecursoSaving(false)
    }
  }

  function applySentMessageToChat(
    message: AvCrmMessage,
    updatedChat: AvCrmChat | null | undefined,
  ) {
    if (!selectedId || !message) return
    setMessages((current) => [...current, message])
    setChats((current) =>
      current
        .map((chat) =>
          chat.id === selectedId
            ? {
                ...chat,
                ...(updatedChat || {}),
                conversationTimestamp:
                  updatedChat?.conversationTimestamp || message.timestamp || Date.now(),
                lastMessage: updatedChat?.lastMessage || {
                  id: message.id,
                  fromMe: true,
                  text: message.text,
                  status: message.status,
                  timestamp: message.timestamp,
                },
                lastResponder: updatedChat?.lastResponder ?? chat.lastResponder ?? null,
                responders: updatedChat?.responders ?? chat.responders ?? [],
                recursoSolicitarDatos:
                  updatedChat?.recursoSolicitarDatos ?? chat.recursoSolicitarDatos ?? null,
              }
            : chat,
        )
        .sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0)),
    )
    if (updatedChat) setActiveChat(updatedChat)
  }

  async function handleSendRecursoSolicitarDatos(recurso: AvCrmRecurso) {
    if (!user || !selectedId || readOnly || !connected || recursoSending || sending) return
    const texto = recurso.texto.trim()
    if (!texto) return
    setRecursoSending(true)
    setError('')
    setResourcesOpen(false)
    try {
      const token = await user.getIdToken()
      const { message, chat: updatedChat } = await sendAvCrmMessage(token, selectedId, texto, {
        resourceId: 'solicitar_datos',
      })
      applySentMessageToChat(message, updatedChat)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el recurso')
    } finally {
      setRecursoSending(false)
    }
  }

  async function handleSendCotizacion(cotizacion: AvCotizacion) {
    if (
      !user ||
      !selectedId ||
      readOnly ||
      !connected ||
      recursoSending ||
      sending ||
      cotizacionSendingId
    ) {
      return
    }
    setCotizacionSendingId(cotizacion.id)
    setRecursosError('')
    setError('')
    try {
      const token = await user.getIdToken()
      const pdf = await buildAvCotizacionPdf(cotizacion)
      const caption = [
        `Cotización ${cotizacion.numero || ''}`.trim(),
        cotizacion.clienteNombre ? `Cliente: ${cotizacion.clienteNombre}` : null,
        `Total: ${formatCop(cotizacion.subtotal || 0)}`,
      ]
        .filter(Boolean)
        .join('\n')
      const { message, chat: updatedChat } = await sendAvCrmDocument(token, selectedId, {
        fileName: pdf.fileName,
        mimetype: 'application/pdf',
        dataBase64: pdf.base64,
        caption,
      })
      applySentMessageToChat(message, updatedChat)
      setResourcesOpen(false)
      setCotizacionQuery('')
    } catch (err) {
      setRecursosError(
        err instanceof Error ? err.message : 'No se pudo enviar la cotización',
      )
    } finally {
      setCotizacionSendingId(null)
    }
  }

  const selectedFromList = useMemo(
    () => chats.find((chat) => chat.id === selectedId) || null,
    [chats, selectedId],
  )
  const headerChat = activeChat || selectedFromList

  // Orden cronológico estable (como WhatsApp): antiguos arriba, recientes abajo.
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const ta = a.timestamp || 0
      const tb = b.timestamp || 0
      if (ta !== tb) return ta - tb
      const ida = String(a.id || '')
      const idb = String(b.id || '')
      return ida < idb ? -1 : ida > idb ? 1 : 0
    })
  }, [messages])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    // Scroll solo dentro del panel de mensajes (no mueve la página ni oculta el composer).
    container.scrollTop = container.scrollHeight
  }, [sortedMessages.length, selectedId])

  async function openLinkModal() {
    if (!user || busy || readOnly) return
    setModalOpen(true)
    setBusy(true)
    setError('')
    try {
      const token = await user.getIdToken()
      // forceNew solo en «Regenerar QR». Aquí reanudamos o pedimos QR si no hay sesión.
      const data = await connectAvCrmWhatsapp(token, { forceNew: false })
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la vinculación')
    } finally {
      setBusy(false)
    }
  }

  async function handleRefreshQr() {
    if (!user || busy || readOnly) return
    setBusy(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const data = await connectAvCrmWhatsapp(token, { forceNew: true })
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo regenerar el QR')
    } finally {
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    if (!user || busy || readOnly || !isOwner) return
    const ok = window.confirm('¿Desvincular WhatsApp de este CRM?')
    if (!ok) return
    setBusy(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const data = await disconnectAvCrmWhatsapp(token)
      setStatus(data)
      setSelectedId(null)
      setChats([])
      setMessages([])
      setActiveChat(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desvincular')
    } finally {
      setBusy(false)
    }
  }

  async function openVendedoresModal() {
    if (!user || !canManageVendedores) return
    setVendedoresOpen(true)
    setVendedoresError('')
    setVendedorNombre('')
    setVendedorCedula('')
    setVendedorEmail('')
    setVendedorPassword('')
    setVendedorExpandedUid(null)
    setVendedorDraftAcciones(['av_crm'])
    setVendedoresLoading(true)
    try {
      const token = await user.getIdToken()
      const items = await listAvCrmVendedores(token)
      setVendedores(items)
    } catch (err) {
      setVendedoresError(err instanceof Error ? err.message : 'No se pudieron cargar los vendedores')
      setVendedores([])
    } finally {
      setVendedoresLoading(false)
    }
  }

  function toggleVendedorExpand(item: AvCrmVendedor) {
    if (vendedorExpandedUid === item.uid) {
      setVendedorExpandedUid(null)
      return
    }
    setVendedorExpandedUid(item.uid)
    setVendedorDraftAcciones(getVendedorAvAcciones(item))
    setVendedoresError('')
  }

  function toggleVendedorAccion(accion: AdminAccion) {
    if (accion === 'av_crm') return
    setVendedorDraftAcciones((current) => {
      if (current.includes(accion)) {
        return current.filter((item) => item !== accion)
      }
      return [...current, accion]
    })
  }

  async function handleSaveVendedorAccesos(item: AvCrmVendedor) {
    if (!user || vendedorAccesosSaving || !canManageVendedores) return
    setVendedorAccesosSaving(true)
    setVendedoresError('')
    try {
      const token = await user.getIdToken()
      const updated = await saveAvCrmVendedorAccesos(token, item.uid, vendedorDraftAcciones)
      setVendedores((current) =>
        current.map((vendedor) => (vendedor.uid === updated.uid ? updated : vendedor)),
      )
      setVendedorDraftAcciones(getVendedorAvAcciones(updated))
    } catch (err) {
      setVendedoresError(
        err instanceof Error ? err.message : 'No se pudieron guardar los accesos del vendedor',
      )
    } finally {
      setVendedorAccesosSaving(false)
    }
  }

  async function handleCreateVendedor(event: FormEvent) {
    event.preventDefault()
    if (!user || vendedorSaving || !canManageVendedores) return
    setVendedorSaving(true)
    setVendedoresError('')
    try {
      const token = await user.getIdToken()
      const created = await createAvCrmVendedor(token, {
        nombre: vendedorNombre.trim(),
        cedula: vendedorCedula.trim(),
        email: vendedorEmail.trim(),
        password: vendedorPassword,
      })
      setVendedores((current) =>
        [...current, created].sort((a, b) =>
          String(a.nombre || a.email || '').localeCompare(String(b.nombre || b.email || ''), 'es'),
        ),
      )
      setVendedorExpandedUid(created.uid)
      setVendedorDraftAcciones(getVendedorAvAcciones(created))
      setVendedorNombre('')
      setVendedorCedula('')
      setVendedorEmail('')
      setVendedorPassword('')
    } catch (err) {
      setVendedoresError(err instanceof Error ? err.message : 'No se pudo crear el vendedor')
    } finally {
      setVendedorSaving(false)
    }
  }

  async function handleDeleteVendedor(item: AvCrmVendedor) {
    if (!user || vendedorDeletingUid || !canManageVendedores) return
    const ok = window.confirm(
      `¿Eliminar al vendedor ${item.nombre || item.email}? Perderá el acceso al panel.`,
    )
    if (!ok) return
    setVendedorDeletingUid(item.uid)
    setVendedoresError('')
    try {
      const token = await user.getIdToken()
      await deleteAvCrmVendedor(token, item.uid)
      setVendedores((current) => current.filter((v) => v.uid !== item.uid))
      if (vendedorExpandedUid === item.uid) {
        setVendedorExpandedUid(null)
      }
    } catch (err) {
      setVendedoresError(err instanceof Error ? err.message : 'No se pudo eliminar el vendedor')
    } finally {
      setVendedorDeletingUid(null)
    }
  }

  function handleSelectCanned(mensaje: AvCrmMensajePredeterminado) {
    if (readOnly) return
    setDraft(mensaje.texto || '')
    setCannedOpen(false)
    requestAnimationFrame(() => {
      const el = composerInputRef.current
      if (!el) return
      el.focus()
      resizeComposer()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  function selectChat(chat: AvCrmChat) {
    setSelectedId(chat.id)
    setMobileShowChat(true)
    setDraft('')
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    if (!user || !selectedId || sending || readOnly || !connected) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const { message, chat: updatedChat } = await sendAvCrmMessage(token, selectedId, text)
      setDraft('')
      setMessages((current) => [...current, message])
      setChats((current) =>
        current
          .map((chat) =>
            chat.id === selectedId
              ? {
                  ...chat,
                  ...(updatedChat || {}),
                  conversationTimestamp:
                    updatedChat?.conversationTimestamp || message.timestamp || Date.now(),
                  lastMessage: updatedChat?.lastMessage || {
                    id: message.id,
                    fromMe: true,
                    text: message.text,
                    status: message.status,
                    timestamp: message.timestamp,
                  },
                  lastResponder: updatedChat?.lastResponder ?? chat.lastResponder ?? null,
                  responders: updatedChat?.responders ?? chat.responders ?? [],
                  recursoSolicitarDatos:
                    updatedChat?.recursoSolicitarDatos ?? chat.recursoSolicitarDatos ?? null,
                }
              : chat,
          )
          .sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0)),
      )
      if (updatedChat) setActiveChat(updatedChat)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="av-crm" role="tabpanel" aria-label="CRM">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>CRM · WhatsApp</h3>
          <p className="section-note">
            Réplica del WhatsApp vinculado: chats, mensajes, estado de envío y presencia en línea.
          </p>
        </div>
        <div className="av-ingresos-toolbar-actions">
          {!readOnly ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void openLinkModal()}
              disabled={busy || loading}
            >
              <Link2 size={16} strokeWidth={2} aria-hidden />
              {connected ? 'Sesión' : 'Vincular WhatsApp'}
            </button>
          ) : null}
          {canDisconnect && connected ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void handleDisconnect()}
              disabled={busy}
            >
              Desvincular
            </button>
          ) : null}
          {canOpenMensajesRapidos ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMensajesRapidosOpen(true)}
              disabled={busy || loading}
            >
              <StickyNote size={16} strokeWidth={2} aria-hidden />
              Mensajes rápidos
            </button>
          ) : null}
          {canManageAutoMensajes ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAutoMensajesOpen(true)}
              disabled={busy || loading}
            >
              <Settings size={16} strokeWidth={2} aria-hidden />
              Automáticos
            </button>
          ) : null}
          {canManageVendedores ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void openVendedoresModal()}
              disabled={busy || loading}
            >
              <Users size={16} strokeWidth={2} aria-hidden />
              Vendedores
            </button>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <p className="section-note av-readonly-banner">
          Modo solo visualización: puedes consultar chats, pero no vincular ni enviar mensajes.
        </p>
      ) : null}

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando CRM...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !connected && chats.length === 0 ? (
        <div className="proyectos-empty">
          <MessageCircle size={28} strokeWidth={1.75} aria-hidden />
          <p>
            {readOnly
              ? 'WhatsApp aún no está vinculado. Pide a quien gestione el CRM que lo conecte.'
              : status.lastError
                ? status.lastError
                : 'Vincula WhatsApp para ver la bandeja de chats como en WhatsApp Web.'}
          </p>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={() => void openLinkModal()}>
              <Link2 size={16} strokeWidth={2} aria-hidden />
              Vincular WhatsApp
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && connected && chats.length === 0 ? (
        <p className="section-note av-readonly-banner">
          Conectado, pero aún no hay chats sincronizados. Espera unos segundos o escribe/recibe un
          mensaje en el teléfono para llenar la bandeja.
        </p>
      ) : null}

      {!loading && !connected && chats.length > 0 ? (
        <p className="section-note av-readonly-banner">
          Reconectando WhatsApp… Se muestran los chats guardados; el envío vuelve al restaurar la
          sesión.
        </p>
      ) : null}

      {!loading && (connected || chats.length > 0) ? (
        <div className={`av-wa ${mobileShowChat ? 'is-chat-open' : ''}`}>
          <aside className="av-wa-sidebar" aria-label="Lista de chats">
            <div className="av-wa-sidebar-head">
              <LinkedWhatsappCard status={status} variant="sidebar" />
            </div>

            <label className="av-wa-search" htmlFor="av-wa-search">
              <Search size={16} strokeWidth={2} aria-hidden />
              <input
                id="av-wa-search"
                type="search"
                placeholder="Buscar chat o mensaje"
                value={chatQuery}
                onChange={(event) => setChatQuery(event.target.value)}
              />
            </label>

            <div className="av-wa-chat-list" role="list">
              {chats.length === 0 ? (
                <p className="av-wa-empty-list">
                  Esperando sincronización de chats… habla o recibe un mensaje para llenar la lista.
                </p>
              ) : null}
              {chats.map((chat) => {
                const active = chat.id === selectedId
                return (
                  <button
                    key={chat.id}
                    type="button"
                    role="listitem"
                    className={`av-wa-chat-item ${active ? 'is-active' : ''}`}
                    onClick={() => selectChat(chat)}
                  >
                    <Avatar name={chat.name} url={chat.profilePicUrl} />
                    <span className="av-wa-chat-main">
                      <span className="av-wa-chat-top">
                        <strong>{chat.name}</strong>
                        <time>{formatChatTime(chat.lastMessage?.timestamp || chat.conversationTimestamp)}</time>
                      </span>
                      {(() => {
                        const responders = normalizeResponders(chat)
                        return responders.length > 0 ? (
                          <ChatRespondersBadge responders={responders} />
                        ) : null
                      })()}
                      <span className="av-wa-chat-bottom">
                        <span className="av-wa-preview">
                          {!chat.isGroup && chat.phoneDisplay && chat.phoneDisplay !== `+${chat.name}` && chat.name !== chat.phoneNumber ? (
                            <span className="av-wa-phone-inline">{chat.phoneDisplay} · </span>
                          ) : null}
                          {chat.lastMessage?.fromMe ? (
                            <MessageTicks status={chat.lastMessage.status} />
                          ) : null}
                          {chat.lastMessage?.text || (chat.isGroup ? 'Grupo' : 'Sin mensajes')}
                        </span>
                        {chat.unreadCount > 0 ? (
                          <span className="av-wa-unread">{chat.unreadCount}</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="av-wa-pane" aria-label="Conversación">
            {!selectedId || !headerChat ? (
              <div className="av-wa-placeholder">
                <MessageCircle size={48} strokeWidth={1.5} aria-hidden />
                <h4>WhatsApp CRM</h4>
                <p>Selecciona un chat para ver mensajes, ticks de envío y si el contacto está en línea.</p>
              </div>
            ) : (
              <div className="av-wa-conversation">
                <header className="av-wa-pane-head">
                  <button
                    type="button"
                    className="av-wa-back"
                    onClick={() => setMobileShowChat(false)}
                    aria-label="Volver a chats"
                  >
                    <ArrowLeft size={18} strokeWidth={2} aria-hidden />
                  </button>
                  <Avatar name={headerChat.name} url={headerChat.profilePicUrl} size={40} />
                  <div className="av-wa-pane-meta">
                    <strong>{headerChat.name}</strong>
                    <span>
                      {headerChat.isGroup
                        ? 'Grupo'
                        : [
                            headerChat.phoneDisplay,
                            headerChat.presence?.label || null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'estado desconocido'}
                    </span>
                  </div>
                  <div className="av-wa-pane-actions" aria-hidden>
                    <Phone size={18} strokeWidth={2} />
                    <Video size={18} strokeWidth={2} />
                    <MoreVertical size={18} strokeWidth={2} />
                  </div>
                </header>

                <div
                  className="av-wa-messages"
                  role="log"
                  aria-live="polite"
                  ref={messagesContainerRef}
                >
                  {chatLoading && sortedMessages.length === 0 ? (
                    <div className="av-wa-messages-loading">
                      <LoaderCircle className="spin" size={20} strokeWidth={2} aria-hidden />
                      Cargando mensajes…
                    </div>
                  ) : null}
                  {sortedMessages.map((message) => (
                    <div
                      key={message.id || `${message.timestamp}-${message.text}`}
                      className={`av-wa-bubble ${message.fromMe ? 'is-out' : 'is-in'}`}
                    >
                      {!message.fromMe && headerChat.isGroup && message.pushName ? (
                        <span className="av-wa-bubble-author">{message.pushName}</span>
                      ) : null}
                      {message.hasImage || message.type === 'image' || message.type === 'sticker' ? (
                        <CrmImageMessage chatId={selectedId} message={message} />
                      ) : null}
                      {message.hasDocument || message.type === 'document' ? (
                        <CrmDocumentMessage chatId={selectedId} message={message} />
                      ) : null}
                      {message.hasAudio || message.type === 'audio' ? (
                        <CrmAudioPlayer chatId={selectedId} message={message} />
                      ) : null}
                      {!message.hasImage &&
                      !message.hasDocument &&
                      !message.hasAudio &&
                      message.type !== 'image' &&
                      message.type !== 'sticker' &&
                      message.type !== 'document' &&
                      message.type !== 'audio' ? (
                        <p>{message.text || `[${message.type}]`}</p>
                      ) : null}
                      <span className="av-wa-bubble-meta">
                        <time dateTime={message.timestamp ? new Date(message.timestamp).toISOString() : undefined}>
                          {formatMessageTime(message.timestamp) || '—'}
                        </time>
                        {message.fromMe ? <MessageTicks status={message.status} /> : null}
                      </span>
                    </div>
                  ))}
                </div>

                <form className="av-wa-composer" onSubmit={(event) => void handleSend(event)}>
                  <div className="av-wa-canned-wrap">
                    <button
                      type="button"
                      className="av-wa-canned-toggle"
                      onClick={() => {
                        setResourcesOpen(false)
                        setCannedOpen((open) => !open)
                      }}
                      disabled={readOnly || sending || recursoSending}
                      aria-expanded={cannedOpen}
                      aria-label="Mensajes predeterminados"
                      title="Mensajes predeterminados"
                    >
                      <StickyNote size={18} strokeWidth={2} aria-hidden />
                    </button>
                    {cannedOpen ? (
                      <div className="av-wa-canned-panel" role="listbox" aria-label="Mensajes predeterminados">
                        <div className="av-wa-canned-panel-head">
                          <strong>Mensajes rápidos</strong>
                        </div>
                        {cannedLoading ? (
                          <p className="section-note">Cargando…</p>
                        ) : null}
                        {cannedError ? (
                          <p className="login-error" role="alert">
                            {cannedError}
                          </p>
                        ) : null}
                        {!cannedLoading && cannedMessages.length === 0 ? (
                          <p className="section-note">
                            Aún no hay mensajes. Usa «Mensajes rápidos» arriba para crearlos.
                          </p>
                        ) : null}
                        {!cannedLoading && cannedMessages.some((m) => m.alcance !== 'personal') ? (
                          <>
                            <p className="av-wa-canned-group-label">Globales</p>
                            <ul className="av-wa-canned-list">
                              {cannedMessages
                                .filter((mensaje) => mensaje.alcance !== 'personal')
                                .map((mensaje) => (
                                  <li key={mensaje.id}>
                                    <button
                                      type="button"
                                      className="av-wa-canned-item"
                                      disabled={readOnly || sending}
                                      onClick={() => handleSelectCanned(mensaje)}
                                    >
                                      <strong>{mensaje.titulo}</strong>
                                      <span>{mensaje.texto}</span>
                                    </button>
                                  </li>
                                ))}
                            </ul>
                          </>
                        ) : null}
                        {!cannedLoading && cannedMessages.some((m) => m.alcance === 'personal') ? (
                          <>
                            <p className="av-wa-canned-group-label">Mis mensajes</p>
                            <ul className="av-wa-canned-list">
                              {cannedMessages
                                .filter((mensaje) => mensaje.alcance === 'personal')
                                .map((mensaje) => (
                                  <li key={mensaje.id}>
                                    <button
                                      type="button"
                                      className="av-wa-canned-item"
                                      disabled={readOnly || sending}
                                      onClick={() => handleSelectCanned(mensaje)}
                                    >
                                      <strong>{mensaje.titulo}</strong>
                                      <span>{mensaje.texto}</span>
                                    </button>
                                  </li>
                                ))}
                            </ul>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="av-wa-canned-wrap">
                    <button
                      type="button"
                      className="av-wa-canned-toggle"
                      onClick={() => {
                        setCannedOpen(false)
                        setResourcesOpen((open) => !open)
                        setRecursoEditing(false)
                      }}
                      disabled={readOnly || sending || recursoSending}
                      aria-expanded={resourcesOpen}
                      aria-label="Recursos"
                      title="Recursos"
                    >
                      <Plus size={18} strokeWidth={2} aria-hidden />
                    </button>
                    {resourcesOpen ? (
                      <div className="av-wa-canned-panel av-wa-resources-panel" role="dialog" aria-label="Recursos">
                        <div className="av-wa-canned-panel-head">
                          <strong>Recursos</strong>
                        </div>
                        {recursosLoading ? (
                          <p className="section-note">Cargando…</p>
                        ) : null}
                        {recursosError ? (
                          <p className="login-error" role="alert">
                            {recursosError}
                          </p>
                        ) : null}
                        {!recursosLoading
                          ? recursos.map((recurso) => {
                              if (recurso.id === 'enviar_cotizacion') {
                                return (
                                  <div key={recurso.id} className="av-wa-resource-card">
                                    <div className="av-wa-resource-card-head">
                                      <strong>{recurso.titulo}</strong>
                                    </div>
                                    <p className="av-wa-resource-desc">{recurso.descripcion}</p>
                                    <label className="av-wa-resource-search">
                                      <Search size={14} strokeWidth={2} aria-hidden />
                                      <input
                                        type="search"
                                        value={cotizacionQuery}
                                        onChange={(event) => setCotizacionQuery(event.target.value)}
                                        placeholder="Buscar por número, cliente…"
                                        disabled={
                                          readOnly ||
                                          !connected ||
                                          Boolean(cotizacionSendingId) ||
                                          cotizacionesCrmLoading
                                        }
                                        aria-label="Buscar cotización"
                                      />
                                    </label>
                                    {cotizacionesCrmLoading ? (
                                      <p className="section-note">Cargando cotizaciones…</p>
                                    ) : null}
                                    {!cotizacionesCrmLoading && cotizacionesFiltradas.length === 0 ? (
                                      <p className="section-note">
                                        {cotizacionQuery.trim()
                                          ? 'Sin resultados para esa búsqueda.'
                                          : 'No hay cotizaciones creadas.'}
                                      </p>
                                    ) : null}
                                    {!cotizacionesCrmLoading && cotizacionesFiltradas.length > 0 ? (
                                      <ul className="av-wa-cotizacion-list">
                                        {cotizacionesFiltradas.map((cotizacion) => {
                                          const busy = cotizacionSendingId === cotizacion.id
                                          return (
                                            <li key={cotizacion.id}>
                                              <button
                                                type="button"
                                                className="av-wa-cotizacion-item"
                                                disabled={
                                                  readOnly ||
                                                  !connected ||
                                                  sending ||
                                                  recursoSending ||
                                                  Boolean(cotizacionSendingId)
                                                }
                                                onClick={() => void handleSendCotizacion(cotizacion)}
                                              >
                                                <span className="av-wa-cotizacion-item-main">
                                                  <strong>
                                                    {cotizacion.numero || 'Cotización'}
                                                  </strong>
                                                  <span>
                                                    {cotizacion.clienteNombre || 'Sin cliente'}
                                                  </span>
                                                </span>
                                                <span className="av-wa-cotizacion-item-meta">
                                                  {formatCop(cotizacion.subtotal || 0)}
                                                  {busy ? (
                                                    <LoaderCircle
                                                      className="spin"
                                                      size={14}
                                                      strokeWidth={2}
                                                      aria-hidden
                                                    />
                                                  ) : (
                                                    <FileText size={14} strokeWidth={2} aria-hidden />
                                                  )}
                                                </span>
                                              </button>
                                            </li>
                                          )
                                        })}
                                      </ul>
                                    ) : null}
                                  </div>
                                )
                              }

                              const state =
                                headerChat?.recursoSolicitarDatos ||
                                activeChat?.recursoSolicitarDatos ||
                                null
                              const datos = state?.datos
                              return (
                                <div key={recurso.id} className="av-wa-resource-card">
                                  <div className="av-wa-resource-card-head">
                                    <strong>{recurso.titulo}</strong>
                                    {state?.status === 'awaiting' ? (
                                      <span className="av-wa-resource-status is-awaiting">
                                        Recopilando…
                                      </span>
                                    ) : null}
                                    {state?.status === 'complete' ? (
                                      <span className="av-wa-resource-status is-complete">
                                        Completo
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="av-wa-resource-desc">{recurso.descripcion}</p>

                                  {isOwner && recursoEditing ? (
                                    <textarea
                                      className="av-wa-resource-edit"
                                      rows={5}
                                      value={recursoEditTexto}
                                      disabled={recursoSaving}
                                      onChange={(event) => setRecursoEditTexto(event.target.value)}
                                    />
                                  ) : (
                                    <p className="av-wa-resource-preview">{recurso.texto}</p>
                                  )}

                                  {(state?.status === 'awaiting' || state?.status === 'complete') && (
                                    <ul className="av-wa-resource-fields">
                                      <li className={datos?.nombreContacto ? 'is-done' : ''}>
                                        <span>Nombre de contacto</span>
                                        <strong>{datos?.nombreContacto || 'Pendiente'}</strong>
                                      </li>
                                      <li className={datos?.nombreEmpresa ? 'is-done' : ''}>
                                        <span>Empresa / emprendimiento</span>
                                        <strong>{datos?.nombreEmpresa || 'Pendiente'}</strong>
                                      </li>
                                    </ul>
                                  )}

                                  <div className="av-wa-resource-actions">
                                    {isOwner ? (
                                      recursoEditing ? (
                                        <>
                                          <button
                                            type="button"
                                            className="btn-secondary"
                                            disabled={recursoSaving}
                                            onClick={() => {
                                              setRecursoEditing(false)
                                              setRecursoEditTexto(recurso.texto)
                                            }}
                                          >
                                            Cancelar
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-primary"
                                            disabled={recursoSaving}
                                            onClick={() => void handleSaveRecursoSolicitarDatos()}
                                          >
                                            {recursoSaving ? 'Guardando…' : 'Guardar'}
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn-secondary"
                                          onClick={() => {
                                            setRecursoEditTexto(recurso.texto)
                                            setRecursoEditing(true)
                                          }}
                                        >
                                          Editar
                                        </button>
                                      )
                                    ) : null}
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      disabled={
                                        readOnly ||
                                        !connected ||
                                        sending ||
                                        recursoSending ||
                                        recursoEditing ||
                                        Boolean(cotizacionSendingId)
                                      }
                                      onClick={() => void handleSendRecursoSolicitarDatos(recurso)}
                                    >
                                      {recursoSending ? 'Enviando…' : 'Enviar'}
                                    </button>
                                  </div>
                                </div>
                              )
                            })
                          : null}
                      </div>
                    ) : null}
                  </div>
                  <textarea
                    ref={composerInputRef}
                    className="av-wa-composer-input"
                    rows={1}
                    placeholder={readOnly ? 'Solo lectura' : 'Escribe un mensaje'}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        if (!sending && !readOnly && connected && draft.trim()) {
                          event.currentTarget.form?.requestSubmit()
                        }
                      }
                    }}
                    disabled={sending || readOnly || !connected}
                    aria-label="Mensaje"
                    readOnly={readOnly}
                  />
                  <button
                    type="submit"
                    className="av-wa-send"
                    disabled={readOnly || sending || !connected || !draft.trim()}
                  >
                    {sending ? (
                      <LoaderCircle className="spin" size={18} strokeWidth={2} aria-hidden />
                    ) : (
                      <Send size={18} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className="modal-panel av-crm-whatsapp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-crm-wa-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-crm-wa-title">Vincular WhatsApp</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="av-crm-whatsapp-body">
              <p className="section-note">
                Escanea el código QR con WhatsApp (Dispositivos vinculados). Luego verás los chats
                aquí como en WhatsApp Web.
              </p>

              {busy && !status.qrDataUrl && !status.connected ? (
                <div className="proyectos-status">
                  <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                  Generando QR…
                </div>
              ) : null}

              {status.connected ? (
                <div className="av-crm-whatsapp-ok">
                  <LinkedWhatsappCard status={status} variant="modal" />
                  <p className="av-crm-whatsapp-ok-note">
                    La sesión está activa. Los chats y mensajes se sincronizan en esta pestaña.
                  </p>
                </div>
              ) : null}

              {!status.connected && status.qrDataUrl ? (
                <div className="av-crm-whatsapp-qr">
                  <img src={status.qrDataUrl} alt="Código QR de WhatsApp" width={280} height={280} />
                  <p className="section-note">Estado: {statusLabel(status.status)}</p>
                </div>
              ) : null}

              {status.lastError && !status.connected ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {status.lastError}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void handleRefreshQr()}
                  disabled={busy || status.connected}
                >
                  <RefreshCw size={16} strokeWidth={2} aria-hidden className={busy ? 'spin' : undefined} />
                  Regenerar QR
                </button>
                <button type="button" className="btn-primary" onClick={() => setModalOpen(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {vendedoresOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => {
            if (!vendedorSaving && !vendedorDeletingUid) setVendedoresOpen(false)
          }}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-crm-vendedores-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-crm-vendedores-title">Gestionar vendedores</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setVendedoresOpen(false)}
                aria-label="Cerrar"
                disabled={vendedorSaving || Boolean(vendedorDeletingUid)}
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <p className="section-note">
              Crea cuentas con rol vendedor. Selecciona un vendedor para personalizar qué
              funciones del Genio puede gestionar (CRM siempre incluido).
            </p>

            {vendedoresLoading ? (
              <div className="proyectos-status">
                <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                Cargando vendedores...
              </div>
            ) : null}

            {!vendedoresLoading && vendedores.length === 0 ? (
              <p className="section-note">Aún no hay vendedores creados.</p>
            ) : null}

            {!vendedoresLoading && vendedores.length > 0 ? (
              <ul className="av-crm-vendedores-list">
                {vendedores.map((item) => {
                  const expanded = vendedorExpandedUid === item.uid
                  return (
                    <li key={item.uid} className={expanded ? 'is-expanded' : ''}>
                      <div className="av-crm-vendedor-row">
                        <button
                          type="button"
                          className="av-crm-vendedor-select"
                          onClick={() => toggleVendedorExpand(item)}
                          aria-expanded={expanded}
                        >
                          <span className="av-crm-vendedor-meta">
                            <strong>{item.nombre || 'Sin nombre'}</strong>
                            <span>{item.email}</span>
                            {item.cedula ? <span>Cédula {item.cedula}</span> : null}
                          </span>
                          <ChevronDown
                            size={18}
                            strokeWidth={2}
                            className={`av-crm-vendedor-chevron ${expanded ? 'is-open' : ''}`}
                            aria-hidden
                          />
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => void handleDeleteVendedor(item)}
                          disabled={vendedorSaving || vendedorDeletingUid === item.uid}
                          aria-label={`Eliminar ${item.nombre || item.email}`}
                        >
                          {vendedorDeletingUid === item.uid ? (
                            <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                          ) : (
                            <Trash2 size={16} strokeWidth={2} aria-hidden />
                          )}
                        </button>
                      </div>

                      {expanded ? (
                        <div className="av-crm-vendedor-permisos">
                          <p className="section-note">
                            Marca las funciones que este vendedor puede gestionar.
                          </p>
                          <div className="av-crm-vendedor-checks" role="group" aria-label="Funciones">
                            {VENDEDOR_ACCIONES.map((accion) => {
                              const locked = accion.id === 'av_crm'
                              const checked = vendedorDraftAcciones.includes(accion.id)
                              return (
                                <label
                                  key={accion.id}
                                  className={`av-crm-vendedor-check ${locked ? 'is-locked' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={locked || vendedorAccesosSaving}
                                    onChange={() => toggleVendedorAccion(accion.id)}
                                  />
                                  <span>
                                    {accion.label}
                                    {locked ? ' (base)' : ''}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                          <div className="av-crm-vendedor-permisos-actions">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => void handleSaveVendedorAccesos(item)}
                              disabled={vendedorAccesosSaving}
                            >
                              {vendedorAccesosSaving ? (
                                <>
                                  <LoaderCircle
                                    className="spin"
                                    size={16}
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                  Guardando…
                                </>
                              ) : (
                                'Guardar permisos'
                              )}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}

            <form className="modal-form" onSubmit={(event) => void handleCreateVendedor(event)}>
              <h3 className="av-crm-vendedores-form-title">Nuevo vendedor</h3>
              <label className="login-field" htmlFor="av-crm-vendedor-nombre">
                Nombre
                <input
                  id="av-crm-vendedor-nombre"
                  value={vendedorNombre}
                  onChange={(event) => setVendedorNombre(event.target.value)}
                  disabled={vendedorSaving}
                  required
                  maxLength={80}
                  autoComplete="name"
                />
              </label>
              <label className="login-field" htmlFor="av-crm-vendedor-cedula">
                Cédula
                <input
                  id="av-crm-vendedor-cedula"
                  value={vendedorCedula}
                  onChange={(event) => setVendedorCedula(event.target.value)}
                  disabled={vendedorSaving}
                  required
                  inputMode="numeric"
                  maxLength={12}
                  autoComplete="off"
                />
              </label>
              <label className="login-field" htmlFor="av-crm-vendedor-email">
                Correo
                <input
                  id="av-crm-vendedor-email"
                  type="email"
                  value={vendedorEmail}
                  onChange={(event) => setVendedorEmail(event.target.value)}
                  disabled={vendedorSaving}
                  required
                  autoComplete="off"
                />
              </label>
              <label className="login-field" htmlFor="av-crm-vendedor-password">
                Contraseña temporal
                <input
                  id="av-crm-vendedor-password"
                  type="password"
                  value={vendedorPassword}
                  onChange={(event) => setVendedorPassword(event.target.value)}
                  disabled={vendedorSaving}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </label>
              {vendedoresError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {vendedoresError}
                </p>
              ) : null}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setVendedoresOpen(false)}
                  disabled={vendedorSaving || Boolean(vendedorDeletingUid)}
                >
                  Cerrar
                </button>
                <button type="submit" className="btn-primary" disabled={vendedorSaving}>
                  {vendedorSaving ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Creando…
                    </>
                  ) : (
                    <>
                      <Plus size={16} strokeWidth={2} aria-hidden />
                      Crear vendedor
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {mensajesRapidosOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeMensajesRapidos}>
          <div
            className="modal-panel modal-panel-wide av-crm-mensajes-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-crm-mensajes-rapidos-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-crm-mensajes-rapidos-title">Mensajes rápidos</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeMensajesRapidos}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="av-crm-mensajes-modal-body">
              <AvCrmMensajesPanel
                canManageGlobal={isOwner}
                canManagePersonal={isVendedor}
              />
            </div>
          </div>
        </div>
      ) : null}

      {autoMensajesOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setAutoMensajesOpen(false)}
        >
          <div
            className="modal-panel modal-panel-wide av-crm-mensajes-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-crm-auto-mensajes-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-crm-auto-mensajes-title">Mensajes automáticos</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setAutoMensajesOpen(false)}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="av-crm-mensajes-modal-body">
              <AvCrmAutoMensajesPanel />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
