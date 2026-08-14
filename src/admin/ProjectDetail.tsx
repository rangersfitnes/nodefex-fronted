import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  agregarMembresiaProyecto,
  createLicenciaProyecto,
  createUsuarioProyecto,
  deleteLicenciaProyecto,
  deleteUsuarioProyecto,
  getLinkDescargaProyecto,
  getLinkLicenciaProyecto,
  getProyecto,
  getSoporteWhatsappProyecto,
  listLicenciasProyecto,
  listPagosProyecto,
  listUsuariosProyecto,
  proyectoSoportaUsuarios,
  esProyectoVelix,
  esProyectoSistecontact,
  esProyectoContable,
  setUsuarioAccessProyecto,
  saveLinkDescargaProyecto,
  saveLinkLicenciaProyecto,
  saveSoporteWhatsappProyecto,
  type LicenciaPlan,
  type PagoMembresia,
  type Proyecto,
  type ProyectoUsuario,
} from '../api/proyectos'
import { useAuth } from '../contexts/AuthContext'
import type { AdminAccion, ProyectoAccesoConfig } from '../api/administradores'
import { ContablePanel } from './ContablePanel'
import {
  AlertCircle,
  ArrowRight,
  Check,
  Download,
  Hexagon,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LogOut,
  Mail,
  MessageCircle,
  Package,
  Plus,
  Receipt,
  Search,
  Shield,
  Trash2,
  User,
  Users,
  X,
} from '../icons'

function formatExpiresAt(iso: string | null): string {
  if (!iso) return 'Sin vigencia'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPagoStatus(status: string) {
  const key = status.toUpperCase()
  if (key === 'APPROVED') return 'Aprobado'
  if (key === 'PENDING') return 'Pendiente'
  if (key === 'DECLINED' || key === 'REJECTED') return 'Rechazado'
  if (key === 'VOIDED' || key === 'CANCELLED') return 'Anulado'
  return status
}

function statusClass(status: string) {
  const key = status.toUpperCase()
  if (key === 'APPROVED') return 'is-approved'
  if (key === 'PENDING') return 'is-pending'
  return 'is-other'
}

export function ProjectDetail() {
  const { proyectoId = '' } = useParams()
  const decodedId = decodeURIComponent(proyectoId)
  const { user, logout, getProjectAccess } = useAuth()
  const navigate = useNavigate()

  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [usuarios, setUsuarios] = useState<ProyectoUsuario[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [membershipOpen, setMembershipOpen] = useState(false)
  const [membershipQuery, setMembershipQuery] = useState('')
  const [selectedUid, setSelectedUid] = useState('')
  const [dias, setDias] = useState('30')
  const [membershipError, setMembershipError] = useState('')
  const [membershipSubmitting, setMembershipSubmitting] = useState(false)
  const [membershipSuccess, setMembershipSuccess] = useState('')
  const [accessSavingUid, setAccessSavingUid] = useState('')
  const [accessError, setAccessError] = useState('')

  const [planes, setPlanes] = useState<LicenciaPlan[]>([])
  const [planesLoading, setPlanesLoading] = useState(false)
  const [planesError, setPlanesError] = useState('')
  const [planNombre, setPlanNombre] = useState('')
  const [planDescripcion, setPlanDescripcion] = useState('')
  const [planDias, setPlanDias] = useState('30')
  const [planPrecio, setPlanPrecio] = useState('')
  const [planFormError, setPlanFormError] = useState('')
  const [planSubmitting, setPlanSubmitting] = useState(false)

  const [renewLink, setRenewLink] = useState('')
  const [renewLinkLoading, setRenewLinkLoading] = useState(false)
  const [renewLinkError, setRenewLinkError] = useState('')
  const [renewLinkSuccess, setRenewLinkSuccess] = useState('')
  const [renewLinkSubmitting, setRenewLinkSubmitting] = useState(false)

  const [downloadLink, setDownloadLink] = useState('')
  const [downloadLinkLoading, setDownloadLinkLoading] = useState(false)
  const [downloadLinkError, setDownloadLinkError] = useState('')
  const [downloadLinkSuccess, setDownloadLinkSuccess] = useState('')
  const [downloadLinkSubmitting, setDownloadLinkSubmitting] = useState(false)

  const [whatsappNumero, setWhatsappNumero] = useState('')
  const [whatsappLoading, setWhatsappLoading] = useState(false)
  const [whatsappError, setWhatsappError] = useState('')
  const [whatsappSuccess, setWhatsappSuccess] = useState('')
  const [whatsappSubmitting, setWhatsappSubmitting] = useState(false)

  const [pagos, setPagos] = useState<PagoMembresia[]>([])
  const [pagosLoading, setPagosLoading] = useState(false)
  const [pagosError, setPagosError] = useState('')
  const [pagoQuery, setPagoQuery] = useState('')
  const [pagoStatusFilter, setPagoStatusFilter] = useState('all')
  const [pagoLicenciaFilter, setPagoLicenciaFilter] = useState('all')
  const [pagoTipoFilter, setPagoTipoFilter] = useState('all')
  const [pagoFechaDesde, setPagoFechaDesde] = useState('')
  const [pagoFechaHasta, setPagoFechaHasta] = useState('')

  const soportaUsuarios = proyectoSoportaUsuarios(decodedId)
  const esVelix = esProyectoVelix(decodedId)
  const esSistecontact = esProyectoSistecontact(decodedId)
  const esContable = esProyectoContable(decodedId)
  const soportaPlanes = esVelix || esSistecontact
  const access: ProyectoAccesoConfig | null =
    proyecto?.acceso || getProjectAccess(decodedId)
  function can(action: AdminAccion): boolean {
    if (!access) return false
    if (access.nivel === 'manage') return true
    if (access.nivel === 'custom') return access.acciones.includes(action)
    return false
  }
  const canCreateUsers = can('create_users')
  const canDeleteUsers = can('delete_users')
  const canActivateMemberships = can('activate_memberships')
  const canManagePlans = can('manage_plans')
  const canManageSettings = can('manage_settings')
  const isReadOnly = !access || access.nivel === 'view'

  const filteredUsers = useMemo(() => {
    const q = membershipQuery.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter(
      (item) =>
        item.email?.toLowerCase().includes(q) || item.uid.toLowerCase().includes(q),
    )
  }, [usuarios, membershipQuery])

  const filteredPagos = useMemo(() => {
    const q = pagoQuery.trim().toLowerCase()
    const desdeMs = pagoFechaDesde ? Date.parse(`${pagoFechaDesde}T00:00:00`) : null
    const hastaMs = pagoFechaHasta ? Date.parse(`${pagoFechaHasta}T23:59:59.999`) : null

    return pagos.filter((pago) => {
      if (q) {
        const haystack = [pago.email, pago.reference, pago.uid, pago.licenciaId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      if (pagoStatusFilter !== 'all') {
        if (pago.status.toUpperCase() !== pagoStatusFilter.toUpperCase()) return false
      }

      if (pagoLicenciaFilter === 'activated' && !pago.licenseGranted) return false
      if (pagoLicenciaFilter === 'pending' && pago.licenseGranted) return false

      if (pagoTipoFilter === 'mock' && !pago.mock) return false
      if (pagoTipoFilter === 'real' && pago.mock) return false

      if (desdeMs != null || hastaMs != null) {
        if (!pago.createdAt) return false
        const createdMs = Date.parse(pago.createdAt)
        if (Number.isNaN(createdMs)) return false
        if (desdeMs != null && createdMs < desdeMs) return false
        if (hastaMs != null && createdMs > hastaMs) return false
      }

      return true
    })
  }, [
    pagos,
    pagoQuery,
    pagoStatusFilter,
    pagoLicenciaFilter,
    pagoTipoFilter,
    pagoFechaDesde,
    pagoFechaHasta,
  ])

  const pagoStatusOptions = useMemo(() => {
    const set = new Set(pagos.map((p) => p.status.toUpperCase()).filter(Boolean))
    return Array.from(set).sort()
  }, [pagos])

  function clearPagoFilters() {
    setPagoQuery('')
    setPagoStatusFilter('all')
    setPagoLicenciaFilter('all')
    setPagoTipoFilter('all')
    setPagoFechaDesde('')
    setPagoFechaHasta('')
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user || !decodedId) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await getProyecto(token, decodedId)
        if (!cancelled) setProyecto(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el proyecto')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, decodedId])

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      if (!user || !soportaUsuarios || !decodedId) return
      setLoadingUsers(true)
      setUsersError('')
      try {
        const token = await user.getIdToken()
        const data = await listUsuariosProyecto(token, decodedId)
        if (!cancelled) setUsuarios(data)
      } catch (err) {
        if (!cancelled) {
          setUsersError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios')
        }
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [user, decodedId, soportaUsuarios])

  useEffect(() => {
    let cancelled = false

    async function loadPlanes() {
      if (!user || !soportaPlanes || !decodedId) return
      setPlanesLoading(true)
      setPlanesError('')
      try {
        const token = await user.getIdToken()
        const data = await listLicenciasProyecto(token, decodedId)
        if (!cancelled) setPlanes(data)
      } catch (err) {
        if (!cancelled) {
          setPlanesError(err instanceof Error ? err.message : 'No se pudieron cargar los planes')
        }
      } finally {
        if (!cancelled) setPlanesLoading(false)
      }
    }

    void loadPlanes()
    return () => {
      cancelled = true
    }
  }, [user, decodedId, soportaPlanes])

  useEffect(() => {
    let cancelled = false

    async function loadRenewLink() {
      if (!user || !esVelix || !decodedId) return
      setRenewLinkLoading(true)
      setRenewLinkError('')
      try {
        const token = await user.getIdToken()
        const data = await getLinkLicenciaProyecto(token, decodedId)
        if (!cancelled) setRenewLink(data.url || '')
      } catch (err) {
        if (!cancelled) {
          setRenewLinkError(
            err instanceof Error ? err.message : 'No se pudo cargar el link de renovación',
          )
        }
      } finally {
        if (!cancelled) setRenewLinkLoading(false)
      }
    }

    void loadRenewLink()
    return () => {
      cancelled = true
    }
  }, [user, decodedId, esVelix])

  useEffect(() => {
    let cancelled = false

    async function loadDownloadLink() {
      if (!user || !esVelix || !decodedId) return
      setDownloadLinkLoading(true)
      setDownloadLinkError('')
      try {
        const token = await user.getIdToken()
        const data = await getLinkDescargaProyecto(token, decodedId)
        if (!cancelled) setDownloadLink(data.url || '')
      } catch (err) {
        if (!cancelled) {
          setDownloadLinkError(
            err instanceof Error ? err.message : 'No se pudo cargar el link de descarga',
          )
        }
      } finally {
        if (!cancelled) setDownloadLinkLoading(false)
      }
    }

    void loadDownloadLink()
    return () => {
      cancelled = true
    }
  }, [user, decodedId, esVelix])

  useEffect(() => {
    let cancelled = false

    async function loadWhatsapp() {
      if (!user || !esVelix || !decodedId) return
      setWhatsappLoading(true)
      setWhatsappError('')
      try {
        const token = await user.getIdToken()
        const data = await getSoporteWhatsappProyecto(token, decodedId)
        if (!cancelled) setWhatsappNumero(data.numero || '')
      } catch (err) {
        if (!cancelled) {
          setWhatsappError(
            err instanceof Error ? err.message : 'No se pudo cargar el número de WhatsApp',
          )
        }
      } finally {
        if (!cancelled) setWhatsappLoading(false)
      }
    }

    void loadWhatsapp()
    return () => {
      cancelled = true
    }
  }, [user, decodedId, esVelix])

  useEffect(() => {
    let cancelled = false

    async function loadPagos() {
      if (!user || !esVelix || !decodedId) return
      setPagosLoading(true)
      setPagosError('')
      try {
        const token = await user.getIdToken()
        const data = await listPagosProyecto(token, decodedId)
        if (!cancelled) setPagos(data)
      } catch (err) {
        if (!cancelled) {
          setPagosError(err instanceof Error ? err.message : 'No se pudieron cargar los pagos')
        }
      } finally {
        if (!cancelled) setPagosLoading(false)
      }
    }

    void loadPagos()
    return () => {
      cancelled = true
    }
  }, [user, decodedId, esVelix])

  async function handleLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  function openModal() {
    setEmail('')
    setPassword('')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
  }

  function openMembershipModal() {
    setMembershipQuery('')
    setSelectedUid(usuarios[0]?.uid ?? '')
    setDias('30')
    setMembershipError('')
    setMembershipSuccess('')
    setMembershipOpen(true)
  }

  function openMembershipModalForUser(item: ProyectoUsuario) {
    setMembershipQuery(item.email || item.uid)
    setSelectedUid(item.uid)
    setDias('30')
    setMembershipError('')
    setMembershipSuccess('')
    setMembershipOpen(true)
  }

  function closeMembershipModal() {
    if (membershipSubmitting) return
    setMembershipOpen(false)
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    setFormError('')
    setSubmitting(true)

    try {
      const token = await user.getIdToken()
      const nuevo = await createUsuarioProyecto(token, decodedId, {
        email: email.trim(),
        password,
      })
      setUsuarios((current) =>
        [...current, nuevo].sort((a, b) =>
          String(a.email || '').localeCompare(String(b.email || '')),
        ),
      )
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el usuario')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const diasNumber = Number(dias)
    if (!selectedUid) {
      setMembershipError('Selecciona un usuario')
      return
    }
    if (!Number.isInteger(diasNumber) || diasNumber < 1) {
      setMembershipError('Ingresa un número entero de días mayor a 0')
      return
    }

    setMembershipError('')
    setMembershipSubmitting(true)

    try {
      const token = await user.getIdToken()
      const membresia = await agregarMembresiaProyecto(token, decodedId, {
        uid: selectedUid,
        dias: diasNumber,
      })

      const target = usuarios.find((item) => item.uid === selectedUid)
      setUsuarios((current) =>
        current.map((item) =>
          item.uid === selectedUid
            ? {
                ...item,
                diasRestantes: membresia.diasRestantes,
                licenseExpiresAt: membresia.licenseExpiresAt,
                activa: membresia.activa,
                timezone: membresia.timezone,
              }
            : item,
        ),
      )
      setMembershipSuccess(
        `Se activaron ${diasNumber} días para ${target?.email || selectedUid}. Quedan ${membresia.diasRestantes} días.`,
      )
      setMembershipOpen(false)
    } catch (err) {
      setMembershipError(err instanceof Error ? err.message : 'No se pudo activar la membresía')
    } finally {
      setMembershipSubmitting(false)
    }
  }

  async function handleCreatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const diasNumber = Number(planDias)
    const precioNumber = Number(planPrecio)

    if (!planNombre.trim()) {
      setPlanFormError('El nombre del plan es obligatorio')
      return
    }
    if (!Number.isInteger(diasNumber) || diasNumber < 1) {
      setPlanFormError('Los días deben ser un entero mayor a 0')
      return
    }
    if (!Number.isFinite(precioNumber) || precioNumber < 0) {
      setPlanFormError('La tarifa debe ser un número válido')
      return
    }

    setPlanFormError('')
    setPlanSubmitting(true)

    try {
      const token = await user.getIdToken()
      const plan = await createLicenciaProyecto(token, decodedId, {
        nombre: planNombre.trim(),
        descripcion: planDescripcion.trim(),
        dias: diasNumber,
        precio: precioNumber,
      })
      setPlanes((current) => [plan, ...current])
      setPlanNombre('')
      setPlanDescripcion('')
      setPlanDias('30')
      setPlanPrecio('')
    } catch (err) {
      setPlanFormError(err instanceof Error ? err.message : 'No se pudo crear el plan')
    } finally {
      setPlanSubmitting(false)
    }
  }

  async function handleDeletePlan(plan: LicenciaPlan) {
    if (!user) return
    const ok = window.confirm(`¿Eliminar el plan "${plan.nombre}"?`)
    if (!ok) return

    try {
      const token = await user.getIdToken()
      await deleteLicenciaProyecto(token, decodedId, plan.id)
      setPlanes((current) => current.filter((item) => item.id !== plan.id))
    } catch (err) {
      setPlanesError(err instanceof Error ? err.message : 'No se pudo eliminar el plan')
    }
  }

  async function handleDeleteUsuario(item: ProyectoUsuario) {
    if (!user) return
    const label = item.email || item.uid
    const ok = window.confirm(
      esSistecontact
        ? `¿Eliminar al usuario "${label}"?\nSe borrará de Firebase Auth de Sistecontact.`
        : `¿Eliminar al usuario "${label}"?\nSe borrará de Firebase Auth Velix y su membresía en Firestore.`,
    )
    if (!ok) return

    try {
      const token = await user.getIdToken()
      await deleteUsuarioProyecto(token, decodedId, item.uid)
      setUsuarios((current) => current.filter((u) => u.uid !== item.uid))
      setSelectedUid((current) => (current === item.uid ? '' : current))
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'No se pudo eliminar el usuario')
    }
  }

  async function handleToggleAccess(item: ProyectoUsuario, nextAccess: boolean) {
    if (!user || !esSistecontact) return

    setAccessError('')
    setAccessSavingUid(item.uid)
    const previous = Boolean(item.access)
    setUsuarios((current) =>
      current.map((u) => (u.uid === item.uid ? { ...u, access: nextAccess } : u)),
    )

    try {
      const token = await user.getIdToken()
      const result = await setUsuarioAccessProyecto(token, decodedId, item.uid, nextAccess)
      setUsuarios((current) =>
        current.map((u) => (u.uid === item.uid ? { ...u, access: result.access } : u)),
      )
    } catch (err) {
      setUsuarios((current) =>
        current.map((u) => (u.uid === item.uid ? { ...u, access: previous } : u)),
      )
      setAccessError(err instanceof Error ? err.message : 'No se pudo actualizar el acceso')
    } finally {
      setAccessSavingUid('')
    }
  }

  async function handleSaveRenewLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const url = renewLink.trim()
    if (!url) {
      setRenewLinkError('El link de renovación es obligatorio')
      setRenewLinkSuccess('')
      return
    }

    setRenewLinkError('')
    setRenewLinkSuccess('')
    setRenewLinkSubmitting(true)

    try {
      const token = await user.getIdToken()
      const saved = await saveLinkLicenciaProyecto(token, decodedId, url)
      setRenewLink(saved.url)
      setRenewLinkSuccess('Link de renovación guardado en Firestore Velix.')
    } catch (err) {
      setRenewLinkError(
        err instanceof Error ? err.message : 'No se pudo guardar el link de renovación',
      )
    } finally {
      setRenewLinkSubmitting(false)
    }
  }

  async function handleSaveDownloadLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const url = downloadLink.trim()
    if (!url) {
      setDownloadLinkError('El link de descarga es obligatorio')
      setDownloadLinkSuccess('')
      return
    }

    setDownloadLinkError('')
    setDownloadLinkSuccess('')
    setDownloadLinkSubmitting(true)

    try {
      const token = await user.getIdToken()
      const saved = await saveLinkDescargaProyecto(token, decodedId, url)
      setDownloadLink(saved.url)
      setDownloadLinkSuccess('Link de descarga guardado en Firestore Velix.')
    } catch (err) {
      setDownloadLinkError(
        err instanceof Error ? err.message : 'No se pudo guardar el link de descarga',
      )
    } finally {
      setDownloadLinkSubmitting(false)
    }
  }

  async function handleSaveWhatsapp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const numero = whatsappNumero.trim()
    if (!numero) {
      setWhatsappError('El número de WhatsApp es obligatorio')
      setWhatsappSuccess('')
      return
    }

    setWhatsappError('')
    setWhatsappSuccess('')
    setWhatsappSubmitting(true)

    try {
      const token = await user.getIdToken()
      const saved = await saveSoporteWhatsappProyecto(token, decodedId, numero)
      setWhatsappNumero(saved.numero)
      setWhatsappSuccess('Número de WhatsApp guardado en Firestore Velix.')
    } catch (err) {
      setWhatsappError(
        err instanceof Error ? err.message : 'No se pudo guardar el número de WhatsApp',
      )
    } finally {
      setWhatsappSubmitting(false)
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="login-mark" aria-hidden>
            <Hexagon size={20} strokeWidth={2.25} />
          </span>
          <span>Nodefex Tecnologi</span>
        </div>
        <div className="dashboard-user">
          <span className="dashboard-email">{user?.email}</span>
          <button type="button" className="dashboard-logout" onClick={handleLogout}>
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="project-detail">
          <Link to="/admin/dashboard" className="back-link">
            <ArrowRight size={16} strokeWidth={2} className="back-link-icon" aria-hidden />
            Volver al dashboard
          </Link>

          {loading ? (
            <div className="proyectos-status">
              <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
              Cargando proyecto...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="proyectos-status proyectos-status-error" role="alert">
              <AlertCircle size={18} strokeWidth={2} aria-hidden />
              {error}
            </div>
          ) : null}

          {!loading && !error && proyecto ? (
            <>
              <section className="dashboard-hero project-detail-hero">
                <p className="dashboard-eyebrow">
                  <LayoutDashboard size={14} strokeWidth={2} aria-hidden />
                  Proyecto
                </p>
                <div className="dashboard-hero-row">
                  <div>
                    <h1>{proyecto.nombre}</h1>
                    <p className="dashboard-copy">{proyecto.descripcion}</p>
                    {isReadOnly ? (
                      <p className="section-note">Estás en modo solo lectura en este proyecto.</p>
                    ) : null}
                  </div>
                  {soportaUsuarios ? (
                    <div className="hero-actions">
                      {esVelix ? (
                        <>
                          <Link
                            to="/velix"
                            className="btn-secondary"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir /velix
                          </Link>
                          {canActivateMemberships ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={openMembershipModal}
                            >
                              <Shield size={18} strokeWidth={2} aria-hidden />
                              Activar licencia
                            </button>
                          ) : null}
                        </>
                      ) : null}
                      {esSistecontact ? (
                        <Link
                          to="/sistecontact"
                          className="btn-secondary"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir /sistecontact
                        </Link>
                      ) : null}
                      {canCreateUsers ? (
                        <button type="button" className="btn-primary" onClick={openModal}>
                          <Plus size={18} strokeWidth={2} aria-hidden />
                          Crear usuario
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>

              {esContable ? (
                <ContablePanel />
              ) : soportaUsuarios ? (
                <>
                  {esVelix ? (
                  <>
                  <section className="usuarios-section" aria-label="Link de renovación">
                    <div className="section-heading">
                      <Link2 size={18} strokeWidth={2} aria-hidden />
                      <h2>Link para renovar licencia</h2>
                    </div>
                    <p className="section-note">
                      Se guarda en Firestore Velix: <code>link-licencia/actual</code>. Puedes
                      actualizarlo cuando cambie el destino de renovación.
                    </p>

                    {renewLinkLoading ? (
                      <div className="proyectos-status">
                        <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                        Cargando link...
                      </div>
                    ) : (
                      <form
                        className="plan-admin-form"
                        onSubmit={handleSaveRenewLink}
                        noValidate
                      >
                        <label className="login-field" htmlFor="renew-link">
                          URL de renovación
                          <input
                            id="renew-link"
                            type="url"
                            value={renewLink}
                            onChange={(e) => {
                              setRenewLink(e.target.value)
                              setRenewLinkSuccess('')
                            }}
                            placeholder="https://tu-dominio.com/velix"
                            required
                            disabled={renewLinkSubmitting || !canManageSettings}
                          />
                        </label>

                        {renewLinkError ? (
                          <p className="login-error" role="alert">
                            <AlertCircle size={16} strokeWidth={2} aria-hidden />
                            {renewLinkError}
                          </p>
                        ) : null}

                        {renewLinkSuccess ? (
                          <p className="renew-link-success" role="status">
                            <Check size={16} strokeWidth={2} aria-hidden />
                            {renewLinkSuccess}
                          </p>
                        ) : null}

                        {canManageSettings ? (
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={renewLinkSubmitting}
                        >
                          {renewLinkSubmitting ? (
                            <>
                              <LoaderCircle
                                className="spin"
                                size={16}
                                strokeWidth={2}
                                aria-hidden
                              />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Check size={16} strokeWidth={2} aria-hidden />
                              Guardar link
                            </>
                          )}
                        </button>
                        ) : null}
                      </form>
                    )}
                  </section>

                  <section className="usuarios-section" aria-label="Link de descarga">
                    <div className="section-heading">
                      <Download size={18} strokeWidth={2} aria-hidden />
                      <h2>Link de descarga (Windows)</h2>
                    </div>
                    <p className="section-note">
                      Se guarda en Firestore Velix: <code>link-descarga/actual</code>. Aparece en
                      la página pública <code>/velix</code>.
                    </p>

                    {downloadLinkLoading ? (
                      <div className="proyectos-status">
                        <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                        Cargando link...
                      </div>
                    ) : (
                      <form
                        className="plan-admin-form"
                        onSubmit={handleSaveDownloadLink}
                        noValidate
                      >
                        <label className="login-field" htmlFor="download-link">
                          URL del instalador
                          <input
                            id="download-link"
                            type="url"
                            value={downloadLink}
                            onChange={(e) => {
                              setDownloadLink(e.target.value)
                              setDownloadLinkSuccess('')
                            }}
                            placeholder="https://www.mediafire.com/file/.../velixsetup.exe/file"
                            required
                            disabled={downloadLinkSubmitting || !canManageSettings}
                          />
                        </label>

                        {downloadLinkError ? (
                          <p className="login-error" role="alert">
                            <AlertCircle size={16} strokeWidth={2} aria-hidden />
                            {downloadLinkError}
                          </p>
                        ) : null}

                        {downloadLinkSuccess ? (
                          <p className="renew-link-success" role="status">
                            <Check size={16} strokeWidth={2} aria-hidden />
                            {downloadLinkSuccess}
                          </p>
                        ) : null}

                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={downloadLinkSubmitting || !canManageSettings}
                        >
                          {downloadLinkSubmitting ? (
                            <>
                              <LoaderCircle
                                className="spin"
                                size={16}
                                strokeWidth={2}
                                aria-hidden
                              />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Check size={16} strokeWidth={2} aria-hidden />
                              Guardar link de descarga
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </section>

                  <section className="usuarios-section" aria-label="Soporte WhatsApp">
                    <div className="section-heading">
                      <MessageCircle size={18} strokeWidth={2} aria-hidden />
                      <h2>WhatsApp de soporte</h2>
                    </div>
                    <p className="section-note">
                      Se guarda en Firestore Velix: <code>soporte-whatsapp/actual</code>. Incluye
                      código de país (ej. <code>573001234567</code>). Aparece en <code>/velix</code>.
                    </p>

                    {whatsappLoading ? (
                      <div className="proyectos-status">
                        <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                        Cargando número...
                      </div>
                    ) : (
                      <form className="plan-admin-form" onSubmit={handleSaveWhatsapp} noValidate>
                        <label className="login-field" htmlFor="whatsapp-numero">
                          Número (con código de país)
                          <input
                            id="whatsapp-numero"
                            type="tel"
                            inputMode="tel"
                            value={whatsappNumero}
                            onChange={(e) => {
                              setWhatsappNumero(e.target.value)
                              setWhatsappSuccess('')
                            }}
                            placeholder="573001234567"
                            required
                            disabled={whatsappSubmitting || !canManageSettings}
                          />
                        </label>

                        {whatsappError ? (
                          <p className="login-error" role="alert">
                            <AlertCircle size={16} strokeWidth={2} aria-hidden />
                            {whatsappError}
                          </p>
                        ) : null}

                        {whatsappSuccess ? (
                          <p className="renew-link-success" role="status">
                            <Check size={16} strokeWidth={2} aria-hidden />
                            {whatsappSuccess}
                          </p>
                        ) : null}

                        <button type="submit" className="btn-primary" disabled={whatsappSubmitting || !canManageSettings}>
                          {whatsappSubmitting ? (
                            <>
                              <LoaderCircle
                                className="spin"
                                size={16}
                                strokeWidth={2}
                                aria-hidden
                              />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Check size={16} strokeWidth={2} aria-hidden />
                              Guardar WhatsApp
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </section>
                  </>
                  ) : null}

                  {soportaPlanes ? (
                  <section className="usuarios-section" aria-label="Planes de licencia">
                    <div className="section-heading">
                      <Package size={18} strokeWidth={2} aria-hidden />
                      <h2>Planes / membresías (tarifas)</h2>
                    </div>
                    <p className="section-note">
                      Se guardan en Firestore Nodefex: <code>proyectos/{'{id}'}/licencias</code>.
                      {esSistecontact
                        ? ' Estos planes aparecen en la tienda pública /sistecontact.'
                        : ' Estos planes aparecen en la tienda pública /velix.'}
                    </p>

                    {canManagePlans ? (
                    <form className="plan-admin-form" onSubmit={handleCreatePlan} noValidate>
                      <label className="login-field" htmlFor="plan-nombre">
                        Nombre del plan
                        <input
                          id="plan-nombre"
                          value={planNombre}
                          onChange={(e) => setPlanNombre(e.target.value)}
                          placeholder={
                            esSistecontact ? 'Membresía 30 días' : 'Licencia 30 días'
                          }
                          required
                          disabled={planSubmitting}
                        />
                      </label>
                      <label className="login-field" htmlFor="plan-descripcion">
                        Descripción
                        <input
                          id="plan-descripcion"
                          value={planDescripcion}
                          onChange={(e) => setPlanDescripcion(e.target.value)}
                          placeholder="Acceso completo por 30 días"
                          disabled={planSubmitting}
                        />
                      </label>
                      <div className="plan-admin-row">
                        <label className="login-field" htmlFor="plan-dias">
                          Días
                          <input
                            id="plan-dias"
                            type="number"
                            min={1}
                            step={1}
                            value={planDias}
                            onChange={(e) => setPlanDias(e.target.value)}
                            required
                            disabled={planSubmitting}
                          />
                        </label>
                        <label className="login-field" htmlFor="plan-precio">
                          Tarifa (COP)
                          <input
                            id="plan-precio"
                            type="number"
                            min={0}
                            step={1}
                            value={planPrecio}
                            onChange={(e) => setPlanPrecio(e.target.value)}
                            placeholder="50000"
                            required
                            disabled={planSubmitting}
                          />
                        </label>
                      </div>

                      {planFormError ? (
                        <p className="login-error" role="alert">
                          <AlertCircle size={16} strokeWidth={2} aria-hidden />
                          {planFormError}
                        </p>
                      ) : null}

                      <button type="submit" className="btn-primary" disabled={planSubmitting}>
                        {planSubmitting ? (
                          <>
                            <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Plus size={16} strokeWidth={2} aria-hidden />
                            Crear plan
                          </>
                        )}
                      </button>
                    </form>
                    ) : null}

                    {planesLoading ? (
                      <div className="proyectos-status">
                        <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                        Cargando planes...
                      </div>
                    ) : null}

                    {!planesLoading && planesError ? (
                      <div className="proyectos-status proyectos-status-error" role="alert">
                        <AlertCircle size={18} strokeWidth={2} aria-hidden />
                        {planesError}
                      </div>
                    ) : null}

                    {!planesLoading && !planesError && planes.length === 0 ? (
                      <div className="proyectos-empty">
                        <p>
                          No hay planes. Crea uno (por ejemplo 30 días) para venderlo en /
                          {esSistecontact ? 'sistecontact' : 'velix'}.
                        </p>
                      </div>
                    ) : null}

                    {!planesLoading && !planesError && planes.length > 0 ? (
                      <div className="plan-list">
                        {planes.map((plan) => (
                          <article key={plan.id} className="plan-card">
                            <div>
                              <h3>{plan.nombre}</h3>
                              <p>{plan.descripcion || 'Sin descripción'}</p>
                              <p className="plan-meta">
                                {plan.dias} días · {formatCop(plan.precio)}
                              </p>
                            </div>
                            {canManagePlans ? (
                            <button
                              type="button"
                              className="proyecto-delete"
                              onClick={() => void handleDeletePlan(plan)}
                              aria-label={`Eliminar plan ${plan.nombre}`}
                            >
                              <Trash2 size={16} strokeWidth={2} />
                            </button>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </section>
                  ) : null}

                <section className="usuarios-section" aria-label="Usuarios del proyecto">
                  <div className="section-heading">
                    <Users size={18} strokeWidth={2} aria-hidden />
                    <h2>
                      {esVelix
                        ? 'Usuarios y membresías (Velix)'
                        : 'Usuarios y membresías (Sistecontact)'}
                    </h2>
                  </div>
                  <p className="section-note">
                    {esVelix
                      ? 'Vigencias calculadas en zona horaria America/Bogota. Se guarda la fecha exacta de vencimiento en Firestore. Usa «Activar días» en cada usuario para sumar licencia manualmente.'
                      : 'El switch activa users/{uid}/settings/access. Los pagos de /sistecontact suman días de vigencia automáticamente.'}
                  </p>

                  {esVelix && membershipSuccess ? (
                    <p className="renew-link-success" role="status">
                      <Check size={16} strokeWidth={2} aria-hidden />
                      {membershipSuccess}
                    </p>
                  ) : null}

                  {esSistecontact && accessError ? (
                    <div className="proyectos-status proyectos-status-error" role="alert">
                      <AlertCircle size={18} strokeWidth={2} aria-hidden />
                      {accessError}
                    </div>
                  ) : null}

                  {loadingUsers ? (
                    <div className="proyectos-status">
                      <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                      Cargando usuarios...
                    </div>
                  ) : null}

                  {!loadingUsers && usersError ? (
                    <div className="proyectos-status proyectos-status-error" role="alert">
                      <AlertCircle size={18} strokeWidth={2} aria-hidden />
                      {usersError}
                    </div>
                  ) : null}

                  {!loadingUsers && !usersError && usuarios.length === 0 ? (
                    <div className="proyectos-empty">
                      <User size={28} strokeWidth={1.75} aria-hidden />
                      <p>No hay usuarios todavía. Crea el primero con correo y contraseña.</p>
                    </div>
                  ) : null}

                  {!loadingUsers && !usersError && usuarios.length > 0 ? (
                    <div className="usuarios-list">
                      {usuarios.map((item) => (
                        <article key={item.uid} className="usuario-row">
                          <div className="usuario-avatar" aria-hidden>
                            <Mail size={18} strokeWidth={1.75} />
                          </div>
                          <div className="usuario-info">
                            <h3>{item.email || 'Sin correo'}</h3>
                            <p>
                              UID: {item.uid}
                              {item.disabled ? ' · Deshabilitado' : ''}
                            </p>
                            {esVelix ? (
                              <p className="usuario-license">
                                Vence: {formatExpiresAt(item.licenseExpiresAt)}
                              </p>
                            ) : (
                              <p className="usuario-license">
                                Acceso: {item.access ? 'Activo' : 'Inactivo'}
                                {item.licenseExpiresAt
                                  ? ` · Vence: ${formatExpiresAt(item.licenseExpiresAt)}`
                                  : ''}
                                {item.diasRestantes > 0
                                  ? ` · ${item.diasRestantes} días`
                                  : ''}
                              </p>
                            )}
                          </div>
                          {esVelix ? (
                            <div
                              className={`membership-badge ${item.activa ? 'is-active' : 'is-expired'}`}
                            >
                              <strong>{item.diasRestantes}</strong>
                              <span>días</span>
                            </div>
                          ) : null}
                          <div className="usuario-actions">
                            {canActivateMemberships && esSistecontact ? (
                              <label
                                className={`access-switch ${item.access ? 'is-on' : 'is-off'}`}
                                title={
                                  item.access
                                    ? 'Membresía activa (puede usar la web)'
                                    : 'Membresía inactiva (sin acceso a la web)'
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.access)}
                                  disabled={accessSavingUid === item.uid}
                                  onChange={(e) =>
                                    void handleToggleAccess(item, e.target.checked)
                                  }
                                  aria-label={`Membresía de ${item.email || item.uid}`}
                                />
                                <span className="access-switch-track" aria-hidden>
                                  <span className="access-switch-thumb" />
                                </span>
                                <span className="access-switch-label">
                                  {accessSavingUid === item.uid
                                    ? 'Guardando...'
                                    : item.access
                                      ? 'Activo'
                                      : 'Inactivo'}
                                </span>
                              </label>
                            ) : null}
                            {canActivateMemberships && esVelix ? (
                              <button
                                type="button"
                                className="btn-secondary usuario-activate"
                                onClick={() => openMembershipModalForUser(item)}
                                aria-label={`Activar días para ${item.email || item.uid}`}
                              >
                                <Shield size={15} strokeWidth={2} aria-hidden />
                                Activar días
                              </button>
                            ) : null}
                            {canDeleteUsers ? (
                            <button
                              type="button"
                              className="proyecto-delete"
                              onClick={() => void handleDeleteUsuario(item)}
                              aria-label={`Eliminar usuario ${item.email || item.uid}`}
                            >
                              <Trash2 size={16} strokeWidth={2} />
                            </button>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>

                {esVelix ? (
                <section className="usuarios-section" aria-label="Pagos de membresías">
                  <div className="section-heading">
                    <Receipt size={18} strokeWidth={2} aria-hidden />
                    <h2>Pagos de membresías</h2>
                  </div>
                  <p className="section-note">
                    Registros en Firestore Nodefex: <code>pagos</code>. Incluye compras Wompi y
                    activaciones simuladas.
                  </p>

                  {pagosLoading ? (
                    <div className="proyectos-status">
                      <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
                      Cargando pagos...
                    </div>
                  ) : null}

                  {!pagosLoading && pagosError ? (
                    <div className="proyectos-status proyectos-status-error" role="alert">
                      <AlertCircle size={18} strokeWidth={2} aria-hidden />
                      {pagosError}
                    </div>
                  ) : null}

                  {!pagosLoading && !pagosError && pagos.length === 0 ? (
                    <div className="proyectos-empty">
                      <Receipt size={28} strokeWidth={1.75} aria-hidden />
                      <p>Aún no hay pagos registrados para este proyecto.</p>
                    </div>
                  ) : null}

                  {!pagosLoading && !pagosError && pagos.length > 0 ? (
                    <>
                      <div className="pagos-filters" role="search" aria-label="Filtrar pagos">
                        <label className="login-field" htmlFor="pago-query">
                          Buscar
                          <span className="login-input-wrap">
                            <Search
                              className="login-input-icon"
                              size={16}
                              strokeWidth={1.75}
                              aria-hidden
                            />
                            <input
                              id="pago-query"
                              type="search"
                              value={pagoQuery}
                              onChange={(e) => setPagoQuery(e.target.value)}
                              placeholder="Correo, referencia o UID"
                            />
                          </span>
                        </label>

                        <label className="login-field" htmlFor="pago-status">
                          Estado
                          <select
                            id="pago-status"
                            value={pagoStatusFilter}
                            onChange={(e) => setPagoStatusFilter(e.target.value)}
                          >
                            <option value="all">Todos</option>
                            {pagoStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {formatPagoStatus(status)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="login-field" htmlFor="pago-licencia">
                          Licencia
                          <select
                            id="pago-licencia"
                            value={pagoLicenciaFilter}
                            onChange={(e) => setPagoLicenciaFilter(e.target.value)}
                          >
                            <option value="all">Todas</option>
                            <option value="activated">Activada</option>
                            <option value="pending">Sin activar</option>
                          </select>
                        </label>

                        <label className="login-field" htmlFor="pago-tipo">
                          Tipo
                          <select
                            id="pago-tipo"
                            value={pagoTipoFilter}
                            onChange={(e) => setPagoTipoFilter(e.target.value)}
                          >
                            <option value="all">Todos</option>
                            <option value="real">Wompi real</option>
                            <option value="mock">Simulado</option>
                          </select>
                        </label>

                        <label className="login-field" htmlFor="pago-desde">
                          Desde
                          <input
                            id="pago-desde"
                            type="date"
                            value={pagoFechaDesde}
                            onChange={(e) => setPagoFechaDesde(e.target.value)}
                          />
                        </label>

                        <label className="login-field" htmlFor="pago-hasta">
                          Hasta
                          <input
                            id="pago-hasta"
                            type="date"
                            value={pagoFechaHasta}
                            onChange={(e) => setPagoFechaHasta(e.target.value)}
                          />
                        </label>

                        <button
                          type="button"
                          className="btn-secondary pagos-filters-clear"
                          onClick={clearPagoFilters}
                        >
                          Limpiar filtros
                        </button>
                      </div>

                      <p className="pagos-filter-meta">
                        Mostrando {filteredPagos.length} de {pagos.length} pagos
                      </p>

                      {filteredPagos.length === 0 ? (
                        <div className="proyectos-empty">
                          <Search size={28} strokeWidth={1.75} aria-hidden />
                          <p>No hay pagos que coincidan con los filtros.</p>
                        </div>
                      ) : (
                        <div className="pagos-table-wrap">
                          <table className="pagos-table">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Correo</th>
                                <th>Referencia</th>
                                <th>Días</th>
                                <th>Monto</th>
                                <th>Estado</th>
                                <th>Licencia</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredPagos.map((pago) => {
                                const monto =
                                  pago.precio != null
                                    ? formatCop(pago.precio)
                                    : pago.amountInCents != null
                                      ? formatCop(pago.amountInCents / 100)
                                      : '—'
                                return (
                                  <tr key={pago.id}>
                                    <td>{formatExpiresAt(pago.createdAt)}</td>
                                    <td>{pago.email || '—'}</td>
                                    <td className="pagos-ref">{pago.reference}</td>
                                    <td>{pago.dias}</td>
                                    <td>{monto}</td>
                                    <td>
                                      <span className={`pago-status ${statusClass(pago.status)}`}>
                                        {formatPagoStatus(pago.status)}
                                        {pago.mock ? ' · mock' : ''}
                                      </span>
                                    </td>
                                    <td>{pago.licenseGranted ? 'Activada' : '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : null}
                </section>
                ) : null}
                </>
              ) : (
                <div className="proyectos-empty">
                  <Users size={28} strokeWidth={1.75} aria-hidden />
                  <p>
                    Este proyecto aún no tiene gestión de usuarios Firebase Auth vinculada.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>

      {canCreateUsers && modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crear-usuario-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="crear-usuario-title">Crear usuario</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleCreateUser} noValidate>
              <label className="login-field" htmlFor="usuario-email">
                Correo
                <input
                  id="usuario-email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="usuario-password">
                Contraseña
                <input
                  id="usuario-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={submitting}
                />
              </label>

              {formError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {formError}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus size={16} strokeWidth={2} aria-hidden />
                      Crear
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canActivateMemberships && esVelix && membershipOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeMembershipModal}>
          <div
            className="modal-panel modal-panel-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="membresia-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="membresia-title">Activar licencia por días</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeMembershipModal}
                disabled={membershipSubmitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddMembership} noValidate>
              <p className="section-note" style={{ marginTop: 0 }}>
                Suma días de licencia al usuario seleccionado en Firestore Velix
                (<code> usuarios/{'{uid}'}</code>.
              </p>

              {selectedUid ? (
                <p className="membership-selected">
                  Usuario:{' '}
                  <strong>
                    {usuarios.find((u) => u.uid === selectedUid)?.email || selectedUid}
                  </strong>
                </p>
              ) : null}

              <label className="login-field" htmlFor="buscar-usuario">
                Buscar usuario
                <span className="login-input-wrap">
                  <Search className="login-input-icon" size={18} strokeWidth={1.75} aria-hidden />
                  <input
                    id="buscar-usuario"
                    type="search"
                    value={membershipQuery}
                    onChange={(e) => setMembershipQuery(e.target.value)}
                    placeholder="Correo o UID"
                    disabled={membershipSubmitting}
                    autoFocus
                  />
                </span>
              </label>

              <div className="user-picker" role="listbox" aria-label="Resultados de usuarios">
                {filteredUsers.length === 0 ? (
                  <p className="user-picker-empty">No hay coincidencias</p>
                ) : (
                  filteredUsers.map((item) => (
                    <button
                      key={item.uid}
                      type="button"
                      role="option"
                      aria-selected={selectedUid === item.uid}
                      className={`user-picker-item ${selectedUid === item.uid ? 'is-selected' : ''}`}
                      onClick={() => setSelectedUid(item.uid)}
                      disabled={membershipSubmitting}
                    >
                      <span className="user-picker-email">{item.email || 'Sin correo'}</span>
                      <span className="user-picker-meta">
                        {item.diasRestantes} días · {item.uid.slice(0, 8)}…
                      </span>
                    </button>
                  ))
                )}
              </div>

              <label className="login-field" htmlFor="dias-membresia">
                Días de licencia a agregar
                <input
                  id="dias-membresia"
                  type="number"
                  min={1}
                  step={1}
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  required
                  disabled={membershipSubmitting}
                />
              </label>

              {membershipError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {membershipError}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeMembershipModal}
                  disabled={membershipSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={membershipSubmitting}>
                  {membershipSubmitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Shield size={16} strokeWidth={2} aria-hidden />
                      Activar días
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
