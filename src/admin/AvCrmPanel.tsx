import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  connectAvCrmWhatsapp,
  createAvCrmMensajePredeterminado,
  createAvCrmVendedor,
  deleteAvCrmMensajePredeterminado,
  deleteAvCrmVendedor,
  disconnectAvCrmWhatsapp,
  fetchAvCrmMessageAudio,
  getAvCrmChat,
  getAvCrmWhatsappStatus,
  listAvCrmChats,
  listAvCrmMensajesPredeterminados,
  listAvCrmVendedores,
  saveAvCrmVendedorAccesos,
  sendAvCrmMessage,
  updateAvCrmMensajePredeterminado,
  type AvCrmChat,
  type AvCrmMensajePredeterminado,
  type AvCrmMessage,
  type AvCrmVendedor,
  type AvCrmWhatsappStatus,
} from '../api/audiovisual'
import {
  ADMIN_ACCIONES_AUDIOVISUAL,
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
  Link2,
  LoaderCircle,
  MessageCircle,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  StickyNote,
  Trash2,
  Users,
  Video,
  X,
} from '../icons'

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
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
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
      />
    )
  }
  return (
    <span className="av-wa-avatar av-wa-avatar-fallback" style={{ width: size, height: size }}>
      {initials(name)}
    </span>
  )
}

export function AvCrmPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user, isOwner } = useAuth()
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
  const [cannedMessages, setCannedMessages] = useState<AvCrmMensajePredeterminado[]>([])
  const [cannedLoading, setCannedLoading] = useState(false)
  const [cannedError, setCannedError] = useState('')
  const [manageCannedOpen, setManageCannedOpen] = useState(false)
  const [cannedTitulo, setCannedTitulo] = useState('')
  const [cannedTexto, setCannedTexto] = useState('')
  const [editingCannedId, setEditingCannedId] = useState<string | null>(null)
  const [cannedSaving, setCannedSaving] = useState(false)

  const [vendedoresOpen, setVendedoresOpen] = useState(false)
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
  const canManageCanned = isOwner && !readOnly
  const canManageVendedores = isOwner && !readOnly

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
    if (!connected || !user) {
      setChats([])
      return
    }
    let cancelled = false

    async function loadChats() {
      try {
        const token = await user!.getIdToken()
        const data = await listAvCrmChats(token, { q: chatQuery, limit: 250 })
        if (!cancelled) setChats(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los chats')
        }
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
  }, [connected, user, chatQuery])

  useEffect(() => {
    if (!connected || !user || !selectedId) {
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
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo abrir el chat')
        }
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
  }, [connected, user, selectedId])

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
  }, [connected, user])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    // Scroll solo dentro del panel de mensajes (no mueve la página ni oculta el composer).
    container.scrollTop = container.scrollHeight
  }, [messages.length, selectedId])

  const selectedFromList = useMemo(
    () => chats.find((chat) => chat.id === selectedId) || null,
    [chats, selectedId],
  )
  const headerChat = activeChat || selectedFromList

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

  async function handleSendCanned(mensaje: AvCrmMensajePredeterminado) {
    if (!user || !selectedId || sending || readOnly) return
    setSending(true)
    setError('')
    setCannedOpen(false)
    try {
      const token = await user.getIdToken()
      const message = await sendAvCrmMessage(token, selectedId, mensaje.texto)
      setMessages((current) => [...current, message])
      setChats((current) =>
        current
          .map((chat) =>
            chat.id === selectedId
              ? {
                  ...chat,
                  conversationTimestamp: message.timestamp || Date.now(),
                  lastMessage: {
                    id: message.id,
                    fromMe: true,
                    text: message.text,
                    status: message.status,
                    timestamp: message.timestamp,
                  },
                }
              : chat,
          )
          .sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje predeterminado')
    } finally {
      setSending(false)
    }
  }

  function openManageCanned(mensaje?: AvCrmMensajePredeterminado) {
    if (!canManageCanned) return
    setEditingCannedId(mensaje?.id || null)
    setCannedTitulo(mensaje?.titulo || '')
    setCannedTexto(mensaje?.texto || '')
    setCannedError('')
    setManageCannedOpen(true)
    setCannedOpen(false)
  }

  async function handleSaveCanned(event: FormEvent) {
    event.preventDefault()
    if (!user || !canManageCanned || cannedSaving) return
    const titulo = cannedTitulo.trim()
    const texto = cannedTexto.trim()
    if (!titulo || !texto) {
      setCannedError('Título y texto son obligatorios')
      return
    }
    setCannedSaving(true)
    setCannedError('')
    try {
      const token = await user.getIdToken()
      if (editingCannedId) {
        const updated = await updateAvCrmMensajePredeterminado(token, editingCannedId, {
          titulo,
          texto,
        })
        setCannedMessages((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      } else {
        const created = await createAvCrmMensajePredeterminado(token, { titulo, texto })
        setCannedMessages((current) => [...current, created])
      }
      setManageCannedOpen(false)
    } catch (err) {
      setCannedError(err instanceof Error ? err.message : 'No se pudo guardar el mensaje')
    } finally {
      setCannedSaving(false)
    }
  }

  async function handleDeleteCanned(id: string) {
    if (!user || !canManageCanned) return
    const ok = window.confirm('¿Eliminar este mensaje predeterminado?')
    if (!ok) return
    try {
      const token = await user.getIdToken()
      await deleteAvCrmMensajePredeterminado(token, id)
      setCannedMessages((current) => current.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el mensaje')
    }
  }

  function selectChat(chat: AvCrmChat) {
    setSelectedId(chat.id)
    setMobileShowChat(true)
    setDraft('')
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    if (!user || !selectedId || sending || readOnly) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const message = await sendAvCrmMessage(token, selectedId, text)
      setDraft('')
      setMessages((current) => [...current, message])
      setChats((current) =>
        current
          .map((chat) =>
            chat.id === selectedId
              ? {
                  ...chat,
                  conversationTimestamp: message.timestamp || Date.now(),
                  lastMessage: {
                    id: message.id,
                    fromMe: true,
                    text: message.text,
                    status: message.status,
                    timestamp: message.timestamp,
                  },
                }
              : chat,
          )
          .sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0)),
      )
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

      {!loading && !connected ? (
        <div className="proyectos-empty">
          <MessageCircle size={28} strokeWidth={1.75} aria-hidden />
          <p>
            {readOnly
              ? 'WhatsApp aún no está vinculado. Pide a quien gestione el CRM que lo conecte.'
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

      {!loading && connected ? (
        <div className={`av-wa ${mobileShowChat ? 'is-chat-open' : ''}`}>
          <aside className="av-wa-sidebar" aria-label="Lista de chats">
            <div className="av-wa-sidebar-head">
              <div className="av-wa-me">
                <Avatar name={status.pushName || status.phoneNumber || 'Yo'} size={40} />
                <div>
                  <strong>{status.pushName || 'WhatsApp'}</strong>
                  <span>{status.phoneNumber || 'Conectado'}</span>
                </div>
              </div>
              <span className="av-wa-online-dot" title="Conectado" />
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
                      <span className="av-wa-chat-bottom">
                        <span className="av-wa-preview">
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
                        : headerChat.presence?.label || 'estado desconocido'}
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
                  {chatLoading && messages.length === 0 ? (
                    <div className="av-wa-messages-loading">
                      <LoaderCircle className="spin" size={20} strokeWidth={2} aria-hidden />
                      Cargando mensajes…
                    </div>
                  ) : null}
                  {messages.map((message) => (
                    <div
                      key={message.id || `${message.timestamp}-${message.text}`}
                      className={`av-wa-bubble ${message.fromMe ? 'is-out' : 'is-in'}`}
                    >
                      {!message.fromMe && headerChat.isGroup && message.pushName ? (
                        <span className="av-wa-bubble-author">{message.pushName}</span>
                      ) : null}
                      {message.hasAudio || message.type === 'audio' ? (
                        <CrmAudioPlayer chatId={selectedId} message={message} />
                      ) : (
                        <p>{message.text || `[${message.type}]`}</p>
                      )}
                      <span className="av-wa-bubble-meta">
                        <time>{formatMessageTime(message.timestamp)}</time>
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
                      onClick={() => setCannedOpen((open) => !open)}
                      disabled={readOnly || sending}
                      aria-expanded={cannedOpen}
                      aria-label="Mensajes predeterminados"
                      title="Mensajes predeterminados"
                    >
                      <StickyNote size={18} strokeWidth={2} aria-hidden />
                    </button>
                    {cannedOpen ? (
                      <div className="av-wa-canned-panel" role="listbox" aria-label="Mensajes predeterminados">
                        <div className="av-wa-canned-panel-head">
                          <strong>Mensajes predeterminados</strong>
                          {canManageCanned ? (
                            <button type="button" className="btn-secondary" onClick={() => openManageCanned()}>
                              <Plus size={14} strokeWidth={2} aria-hidden />
                              Nuevo
                            </button>
                          ) : null}
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
                          <p className="section-note">Aún no hay mensajes predeterminados.</p>
                        ) : null}
                        <ul className="av-wa-canned-list">
                          {cannedMessages.map((mensaje) => (
                            <li key={mensaje.id}>
                              <button
                                type="button"
                                className="av-wa-canned-item"
                                disabled={readOnly || sending}
                                onClick={() => void handleSendCanned(mensaje)}
                              >
                                <strong>{mensaje.titulo}</strong>
                                <span>{mensaje.texto}</span>
                              </button>
                              {canManageCanned ? (
                                <div className="av-wa-canned-item-actions">
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => openManageCanned(mensaje)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => void handleDeleteCanned(mensaje.id)}
                                    aria-label={`Eliminar ${mensaje.titulo}`}
                                  >
                                    <Trash2 size={14} strokeWidth={2} aria-hidden />
                                  </button>
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    placeholder={readOnly ? 'Solo lectura' : 'Escribe un mensaje'}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={sending || readOnly}
                    aria-label="Mensaje"
                    readOnly={readOnly}
                  />
                  <button
                    type="submit"
                    className="av-wa-send"
                    disabled={readOnly || sending || !draft.trim()}
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
                  <Smartphone size={28} strokeWidth={1.75} aria-hidden />
                  <strong>WhatsApp vinculado</strong>
                  <p className="section-note">
                    {status.phoneNumber ? `Número: ${status.phoneNumber}` : 'Sesión abierta'}
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

      {manageCannedOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => !cannedSaving && setManageCannedOpen(false)}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-crm-canned-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-crm-canned-title">
                {editingCannedId ? 'Editar mensaje predeterminado' : 'Nuevo mensaje predeterminado'}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setManageCannedOpen(false)}
                disabled={cannedSaving}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <form className="modal-form" onSubmit={(event) => void handleSaveCanned(event)}>
              <label className="login-field" htmlFor="av-crm-canned-titulo">
                Título
                <input
                  id="av-crm-canned-titulo"
                  value={cannedTitulo}
                  onChange={(event) => setCannedTitulo(event.target.value)}
                  disabled={cannedSaving}
                  required
                  maxLength={80}
                />
              </label>
              <label className="login-field" htmlFor="av-crm-canned-texto">
                Mensaje
                <textarea
                  id="av-crm-canned-texto"
                  value={cannedTexto}
                  onChange={(event) => setCannedTexto(event.target.value)}
                  disabled={cannedSaving}
                  required
                  rows={5}
                  maxLength={2000}
                />
              </label>
              {cannedError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {cannedError}
                </p>
              ) : null}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setManageCannedOpen(false)}
                  disabled={cannedSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={cannedSaving}>
                  {cannedSaving ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando…
                    </>
                  ) : (
                    'Guardar'
                  )}
                </button>
              </div>
            </form>
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
    </div>
  )
}
