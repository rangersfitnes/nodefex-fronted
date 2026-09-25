import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  connectAvCrmWhatsapp,
  disconnectAvCrmWhatsapp,
  fetchAvCrmMessageAudio,
  getAvCrmChat,
  getAvCrmWhatsappStatus,
  listAvCrmChats,
  sendAvCrmMessage,
  type AvCrmChat,
  type AvCrmMessage,
  type AvCrmWhatsappStatus,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Link2,
  LoaderCircle,
  MessageCircle,
  MoreVertical,
  Phone,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Video,
  X,
} from '../icons'

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

export function AvCrmPanel() {
  const { user } = useAuth()
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

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const connected = status.connected

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
    return () => {
      cancelled = true
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, selectedId])

  const selectedFromList = useMemo(
    () => chats.find((chat) => chat.id === selectedId) || null,
    [chats, selectedId],
  )
  const headerChat = activeChat || selectedFromList

  async function openLinkModal() {
    if (!user || busy) return
    setModalOpen(true)
    setBusy(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const data = await connectAvCrmWhatsapp(token, { forceNew: !status.connected })
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la vinculación')
    } finally {
      setBusy(false)
    }
  }

  async function handleRefreshQr() {
    if (!user || busy) return
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
    if (!user || busy) return
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

  function selectChat(chat: AvCrmChat) {
    setSelectedId(chat.id)
    setMobileShowChat(true)
    setDraft('')
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    if (!user || !selectedId || sending) return
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
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void openLinkModal()}
            disabled={busy || loading}
          >
            <Link2 size={16} strokeWidth={2} aria-hidden />
            {connected ? 'Sesión' : 'Vincular WhatsApp'}
          </button>
          {connected ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void handleDisconnect()}
              disabled={busy}
            >
              Desvincular
            </button>
          ) : null}
        </div>
      </div>

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
          <p>Vincula WhatsApp para ver la bandeja de chats como en WhatsApp Web.</p>
          <button type="button" className="btn-primary" onClick={() => void openLinkModal()}>
            <Link2 size={16} strokeWidth={2} aria-hidden />
            Vincular WhatsApp
          </button>
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
              <>
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

                <div className="av-wa-messages">
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
                  <div ref={messagesEndRef} />
                </div>

                <form className="av-wa-composer" onSubmit={(event) => void handleSend(event)}>
                  <input
                    type="text"
                    placeholder="Escribe un mensaje"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={sending}
                    aria-label="Mensaje"
                  />
                  <button type="submit" className="av-wa-send" disabled={sending || !draft.trim()}>
                    {sending ? (
                      <LoaderCircle className="spin" size={18} strokeWidth={2} aria-hidden />
                    ) : (
                      <Send size={18} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </form>
              </>
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
    </div>
  )
}
