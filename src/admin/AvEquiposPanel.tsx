import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createAvEquipo,
  copyAvEquipo,
  createAvEquipoSalida,
  deleteAvEquipo,
  listAvEquipos,
  listAvEquiposResponsables,
  updateAvEquipo,
  type AvEquipo,
  type AvEquipoResponsable,
} from '../api/audiovisual'
import { formatCop } from '../api/administradores'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Copy,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from '../icons'

type ModalMode = 'crear' | 'editar'
type SalidaStep = 'seleccion' | 'revision' | 'responsable'

type ItemRow = {
  key: string
  id?: string
  nombre: string
}

type SalidaItemState = {
  itemId: string
  nombre: string
  ok: boolean
  observacion: string
}

type SalidaEquipoState = {
  equipoId: string
  nombre: string
  items: SalidaItemState[]
}

function newItemRow(partial?: Partial<ItemRow>): ItemRow {
  return {
    key: `ir-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    id: partial?.id,
    nombre: partial?.nombre || '',
  }
}

function estadoLabel(estado: AvEquipo['estado'] | undefined): string {
  return estado === 'produccion' ? 'En producción' : 'En bodega'
}

export function AvEquiposPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [equipos, setEquipos] = useState<AvEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvEquipo | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [valorComercial, setValorComercial] = useState('')
  const [items, setItems] = useState<ItemRow[]>([])
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copyingId, setCopyingId] = useState('')
  const [copiedCodigo, setCopiedCodigo] = useState('')

  const [salidaOpen, setSalidaOpen] = useState(false)
  const [salidaStep, setSalidaStep] = useState<SalidaStep>('seleccion')
  const [salidaQuery, setSalidaQuery] = useState('')
  const [salidaSeleccion, setSalidaSeleccion] = useState<SalidaEquipoState[]>([])
  const [salidaResponsables, setSalidaResponsables] = useState<AvEquipoResponsable[]>([])
  const [salidaResponsableKey, setSalidaResponsableKey] = useState('')
  const [salidaError, setSalidaError] = useState('')
  const [salidaSubmitting, setSalidaSubmitting] = useState(false)
  const [salidaLoadingResponsables, setSalidaLoadingResponsables] = useState(false)

  const [ingresoNotice, setIngresoNotice] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvEquipos(token)
        if (!cancelled) setEquipos(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los equipos')
          setEquipos([])
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

  const equiposEnBodega = useMemo(
    () => equipos.filter((item) => (item.estado || 'bodega') !== 'produccion'),
    [equipos],
  )

  const salidaBusqueda = useMemo(() => {
    const q = salidaQuery.trim().toLowerCase()
    const selected = new Set(salidaSeleccion.map((item) => item.equipoId))
    return equiposEnBodega
      .filter((item) => !selected.has(item.id))
      .filter((item) => {
        if (!q) return true
        return (
          String(item.nombre || '').toLowerCase().includes(q) ||
          String(item.descripcion || '').toLowerCase().includes(q) ||
          String(item.codigo || '').toLowerCase().includes(q)
        )
      })
  }, [equiposEnBodega, salidaQuery, salidaSeleccion])

  const revisionCompleta = useMemo(() => {
    if (salidaSeleccion.length === 0) return false
    return salidaSeleccion.every((equipo) =>
      equipo.items.every((item) => item.ok),
    )
  }, [salidaSeleccion])

  function openCreate() {
    setModalMode('crear')
    setEditing(null)
    setNombre('')
    setDescripcion('')
    setValorComercial('')
    setItems([newItemRow()])
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(equipo: AvEquipo) {
    setModalMode('editar')
    setEditing(equipo)
    setNombre(equipo.nombre || '')
    setDescripcion(equipo.descripcion || '')
    setValorComercial(
      equipo.valorComercial != null && equipo.valorComercial > 0
        ? String(equipo.valorComercial)
        : equipo.valorComercial === 0
          ? '0'
          : '',
    )
    const nextItems =
      Array.isArray(equipo.itemsRevision) && equipo.itemsRevision.length > 0
        ? equipo.itemsRevision.map((item) =>
            newItemRow({ id: item.id, nombre: item.nombre }),
          )
        : [newItemRow()]
    setItems(nextItems)
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setFormError('')
  }

  async function openSalida() {
    setSalidaOpen(true)
    setSalidaStep('seleccion')
    setSalidaQuery('')
    setSalidaSeleccion([])
    setSalidaResponsableKey('')
    setSalidaError('')
    setSalidaLoadingResponsables(true)
    try {
      if (!user) return
      const token = await user.getIdToken()
      const responsables = await listAvEquiposResponsables(token)
      setSalidaResponsables(responsables)
    } catch (err) {
      setSalidaError(
        err instanceof Error ? err.message : 'No se pudieron cargar administradores y vendedores',
      )
      setSalidaResponsables([])
    } finally {
      setSalidaLoadingResponsables(false)
    }
  }

  function closeSalida() {
    if (salidaSubmitting) return
    setSalidaOpen(false)
    setSalidaError('')
  }

  function addEquipoASalida(equipo: AvEquipo) {
    if ((equipo.estado || 'bodega') === 'produccion') return
    setSalidaSeleccion((current) => {
      if (current.some((item) => item.equipoId === equipo.id)) return current
      return [
        ...current,
        {
          equipoId: equipo.id,
          nombre: equipo.nombre || 'Equipo',
          items: (equipo.itemsRevision || []).map((item) => ({
            itemId: item.id,
            nombre: item.nombre,
            ok: false,
            observacion: '',
          })),
        },
      ]
    })
    setSalidaQuery('')
    setSalidaError('')
  }

  function removeEquipoDeSalida(equipoId: string) {
    setSalidaSeleccion((current) => current.filter((item) => item.equipoId !== equipoId))
  }

  function updateSalidaItem(
    equipoId: string,
    itemId: string,
    patch: Partial<SalidaItemState>,
  ) {
    setSalidaSeleccion((current) =>
      current.map((equipo) =>
        equipo.equipoId !== equipoId
          ? equipo
          : {
              ...equipo,
              items: equipo.items.map((item) =>
                item.itemId === itemId ? { ...item, ...patch } : item,
              ),
            },
      ),
    )
  }

  function confirmarBuenEstadoTodos() {
    setSalidaSeleccion((current) =>
      current.map((equipo) => ({
        ...equipo,
        items: equipo.items.map((item) => ({ ...item, ok: true })),
      })),
    )
    setSalidaError('')
  }

  async function confirmarSalida() {
    if (!user || salidaSubmitting) return
    if (salidaSeleccion.length === 0) {
      setSalidaError('Agrega al menos un equipo a la salida.')
      setSalidaStep('seleccion')
      return
    }
    if (!revisionCompleta) {
      setSalidaError('Confirma el buen estado de todos los ítems de revisión.')
      setSalidaStep('revision')
      return
    }
    const responsable = salidaResponsables.find(
      (item) => `${item.rol}:${item.uid}` === salidaResponsableKey,
    )
    if (!responsable) {
      setSalidaError('Selecciona quién se lleva los equipos.')
      setSalidaStep('responsable')
      return
    }

    setSalidaSubmitting(true)
    setSalidaError('')
    try {
      const token = await user.getIdToken()
      const { equipos: actualizados } = await createAvEquipoSalida(token, {
        responsableUid: responsable.uid,
        responsableNombre: responsable.nombre,
        responsableRol: responsable.rol,
        equipos: salidaSeleccion.map((equipo) => ({
          equipoId: equipo.equipoId,
          items: equipo.items.map((item) => ({
            itemId: item.itemId,
            ok: item.ok,
            observacion: item.observacion.trim() || null,
          })),
        })),
      })
      setEquipos((current) => {
        const byId = new Map(actualizados.map((item) => [item.id, item]))
        return current.map((item) => byId.get(item.id) || item)
      })
      setSalidaOpen(false)
    } catch (err) {
      setSalidaError(err instanceof Error ? err.message : 'No se pudo confirmar la salida')
    } finally {
      setSalidaSubmitting(false)
    }
  }

  async function handleCopyCodigo(codigo: string | null | undefined) {
    if (!codigo) return
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiedCodigo(codigo)
      window.setTimeout(() => {
        setCopiedCodigo((current) => (current === codigo ? '' : current))
      }, 1500)
    } catch {
      setError('No se pudo copiar el código')
    }
  }

  async function handleCopyEquipo(equipo: AvEquipo) {
    if (!user || readOnly || copyingId) return
    setCopyingId(equipo.id)
    setError('')
    try {
      const token = await user.getIdToken()
      const created = await copyAvEquipo(token, equipo.id)
      setEquipos((current) => [created, ...current])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo copiar el equipo')
    } finally {
      setCopyingId('')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const nombreValue = nombre.trim()
    const descripcionValue = descripcion.trim()
    const valorValue = Number(String(valorComercial).replace(/,/g, '').trim())
    const itemsPayload = items
      .map((item) => ({
        id: item.id,
        nombre: item.nombre.trim(),
      }))
      .filter((item) => item.nombre)

    if (!nombreValue) {
      setFormError('El nombre del equipo es obligatorio.')
      return
    }
    if (!Number.isFinite(valorValue) || valorValue < 0) {
      setFormError('El valor comercial debe ser un número mayor o igual a 0.')
      return
    }

    const nombres = itemsPayload.map((item) => item.nombre.toLowerCase())
    if (new Set(nombres).size !== nombres.length) {
      setFormError('Hay ítems de revisión duplicados.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      if (modalMode === 'crear') {
        const created = await createAvEquipo(token, {
          nombre: nombreValue,
          descripcion: descripcionValue || null,
          valorComercial: Math.round(valorValue),
          itemsRevision: itemsPayload,
        })
        setEquipos((current) => [created, ...current])
      } else if (editing) {
        const updated = await updateAvEquipo(token, editing.id, {
          nombre: nombreValue,
          descripcion: descripcionValue || null,
          valorComercial: Math.round(valorValue),
          itemsRevision: itemsPayload,
        })
        setEquipos((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      }
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el equipo')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(equipo: AvEquipo) {
    if (!user || readOnly || deletingId) return
    const ok = window.confirm(
      `¿Eliminar el equipo «${equipo.nombre || 'sin nombre'}»?`,
    )
    if (!ok) return

    setDeletingId(equipo.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvEquipo(token, equipo.id)
      setEquipos((current) => current.filter((item) => item.id !== equipo.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el equipo')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="av-equipos" role="tabpanel" aria-label="Equipos">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Equipos</h3>
          <p className="section-note">
            Catálogo, salida a producción y control de estado (bodega / producción).
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
          {!readOnly ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => void openSalida()}>
                Salida
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIngresoNotice(true)}
              >
                Ingreso
              </button>
              <button type="button" className="btn-primary" onClick={openCreate}>
                <Plus size={16} strokeWidth={2} aria-hidden />
                Crear equipo
              </button>
            </>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando equipos...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && equipos.length === 0 ? (
        <div className="proyectos-empty">
          <Package size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay equipos. Crea el primero con sus ítems de revisión.</p>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Crear equipo
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && equipos.length > 0 ? (
        <div className="av-equipos-list" role="list">
          {equipos.map((equipo) => {
            const enProduccion = (equipo.estado || 'bodega') === 'produccion'
            const items = equipo.itemsRevision || []
            const previewItems = items.slice(0, 3)
            const itemsExtra = items.length - previewItems.length
            return (
              <article
                key={equipo.id}
                className={`av-equipo-card ${enProduccion ? 'is-produccion' : 'is-bodega'}`}
                role="listitem"
              >
                <div className="av-equipo-card-head">
                  <h4 className="av-equipo-card-name">{equipo.nombre || 'Sin nombre'}</h4>
                  <span
                    className={`av-equipo-estado ${enProduccion ? 'is-produccion' : 'is-bodega'}`}
                  >
                    {estadoLabel(equipo.estado)}
                  </span>
                </div>

                <div className="av-equipo-card-stats">
                  {equipo.codigo ? (
                    <button
                      type="button"
                      className="av-equipo-codigo"
                      onClick={() => void handleCopyCodigo(equipo.codigo)}
                      title="Copiar código"
                    >
                      {equipo.codigo}
                      <Copy size={12} strokeWidth={2} aria-hidden />
                      {copiedCodigo === equipo.codigo ? (
                        <span className="av-equipo-codigo-copied">Copiado</span>
                      ) : null}
                    </button>
                  ) : (
                    <span className="av-equipo-codigo is-missing">Sin código</span>
                  )}
                  <p className="av-equipo-card-valor">
                    <span className="av-equipo-card-valor-label">Valor</span>
                    <strong>{formatCop(equipo.valorComercial || 0)}</strong>
                  </p>
                </div>

                <div className="av-equipo-card-body">
                  {enProduccion && equipo.responsableNombre ? (
                    <p className="av-equipo-card-meta">
                      A cargo de {equipo.responsableNombre}
                      {equipo.responsableRol === 'vendedor'
                        ? ' (vendedor)'
                        : equipo.responsableRol === 'admin'
                          ? ' (admin)'
                          : ''}
                    </p>
                  ) : null}
                  {equipo.descripcion ? (
                    <p className="av-equipo-card-desc">{equipo.descripcion}</p>
                  ) : null}
                  {items.length > 0 ? (
                    <div className="av-equipo-card-items">
                      <span className="av-equipo-items-count">
                        {items.length} ítem{items.length === 1 ? '' : 's'} de revisión
                      </span>
                      <ul className="av-equipo-items-preview">
                        {previewItems.map((item) => (
                          <li key={item.id}>{item.nombre}</li>
                        ))}
                        {itemsExtra > 0 ? (
                          <li className="av-equipo-items-more">+{itemsExtra}</li>
                        ) : null}
                      </ul>
                    </div>
                  ) : (
                    <p className="av-equipo-card-empty">Sin ítems de revisión</p>
                  )}
                </div>

                {!readOnly ? (
                  <div className="av-ingresos-row-actions av-equipo-card-actions">
                    <button type="button" className="btn-secondary" onClick={() => openEdit(equipo)}>
                      <Pencil size={14} strokeWidth={2} aria-hidden />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={copyingId === equipo.id}
                      onClick={() => void handleCopyEquipo(equipo)}
                    >
                      {copyingId === equipo.id ? (
                        <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                      ) : (
                        <Copy size={14} strokeWidth={2} aria-hidden />
                      )}
                      Copiar
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={deletingId === equipo.id}
                      onClick={() => void handleDelete(equipo)}
                    >
                      {deletingId === equipo.id ? (
                        <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                      ) : (
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      )}
                      Eliminar
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel av-equipo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-equipo-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-equipo-modal-title">
                {modalMode === 'crear' ? 'Crear equipo' : 'Editar equipo'}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <form className="modal-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
              {modalMode === 'editar' && editing?.codigo ? (
                <p className="section-note">
                  Código:{' '}
                  <strong className="av-equipo-codigo-inline">{editing.codigo}</strong> (se genera
                  solo al crear; no cambia al editar)
                </p>
              ) : (
                <p className="section-note">
                  Al guardar se generará automáticamente un código alfanumérico único de 4
                  caracteres.
                </p>
              )}

              <label className="login-field" htmlFor="av-equipo-nombre">
                Nombre del equipo
                <input
                  id="av-equipo-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Ej. Cámara"
                  required
                  disabled={submitting}
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="av-equipo-descripcion">
                Descripción <span className="av-equipo-optional">(opcional)</span>
                <textarea
                  id="av-equipo-descripcion"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  rows={3}
                  placeholder="Detalle del equipo"
                  disabled={submitting}
                />
              </label>

              <label className="login-field" htmlFor="av-equipo-valor">
                Valor comercial
                <input
                  id="av-equipo-valor"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={valorComercial}
                  onChange={(event) => setValorComercial(event.target.value)}
                  placeholder="0"
                  required
                  disabled={submitting}
                />
              </label>

              <fieldset className="av-equipo-items" disabled={submitting}>
                <legend>Ítems de revisión</legend>
                <p className="section-note">
                  Agrega lo que se debe revisar con el equipo (ej. lente, correa, batería).
                </p>

                <div className="av-equipo-items-list">
                  {items.map((item, index) => (
                    <div key={item.key} className="av-equipo-item-row">
                      <label className="login-field">
                        Ítem {index + 1}
                        <input
                          type="text"
                          value={item.nombre}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((row) =>
                                row.key === item.key
                                  ? { ...row, nombre: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="Ej. Lente"
                          disabled={submitting}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-secondary av-equipo-item-remove"
                        onClick={() =>
                          setItems((current) => {
                            const next = current.filter((row) => row.key !== item.key)
                            return next.length > 0 ? next : [newItemRow()]
                          })
                        }
                        disabled={submitting}
                        aria-label="Quitar ítem"
                      >
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setItems((current) => [...current, newItemRow()])}
                  disabled={submitting}
                >
                  <Plus size={14} strokeWidth={2} aria-hidden />
                  Agregar ítem
                </button>
              </fieldset>

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
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !nombre.trim()}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : modalMode === 'crear' ? (
                    'Crear equipo'
                  ) : (
                    'Guardar cambios'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {salidaOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeSalida}>
          <div
            className="modal-panel av-equipo-modal av-equipo-salida-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-equipo-salida-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-equipo-salida-title">Salida de equipos</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeSalida}
                disabled={salidaSubmitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="av-equipo-salida-steps" aria-label="Pasos de salida">
              <button
                type="button"
                className={salidaStep === 'seleccion' ? 'is-active' : ''}
                onClick={() => setSalidaStep('seleccion')}
                disabled={salidaSubmitting}
              >
                1. Equipos
              </button>
              <button
                type="button"
                className={salidaStep === 'revision' ? 'is-active' : ''}
                onClick={() => setSalidaStep('revision')}
                disabled={salidaSubmitting || salidaSeleccion.length === 0}
              >
                2. Revisión
              </button>
              <button
                type="button"
                className={salidaStep === 'responsable' ? 'is-active' : ''}
                onClick={() => setSalidaStep('responsable')}
                disabled={salidaSubmitting || !revisionCompleta}
              >
                3. Responsable
              </button>
            </div>

            <div className="modal-form av-equipo-salida-body">
              {salidaStep === 'seleccion' ? (
                <>
                  <label className="login-field" htmlFor="av-equipo-salida-buscar">
                    Buscar equipos en bodega
                    <input
                      id="av-equipo-salida-buscar"
                      type="search"
                      value={salidaQuery}
                      onChange={(event) => setSalidaQuery(event.target.value)}
                      placeholder="Nombre del equipo"
                      disabled={salidaSubmitting}
                      autoFocus
                    />
                  </label>

                  <div className="av-equipo-salida-results">
                    {salidaBusqueda.length === 0 ? (
                      <p className="section-note">
                        {equiposEnBodega.length === 0
                          ? 'No hay equipos en bodega disponibles.'
                          : 'Sin resultados para esa búsqueda.'}
                      </p>
                    ) : (
                      salidaBusqueda.map((equipo) => (
                        <button
                          key={equipo.id}
                          type="button"
                          className="av-equipo-salida-result"
                          onClick={() => addEquipoASalida(equipo)}
                          disabled={salidaSubmitting}
                        >
                          <span>
                            <strong>{equipo.nombre || 'Equipo'}</strong>
                            {equipo.codigo ? (
                              <span className="av-equipo-salida-codigo">{equipo.codigo}</span>
                            ) : null}
                          </span>
                          <span>
                            {(equipo.itemsRevision || []).length} ítem
                            {(equipo.itemsRevision || []).length === 1 ? '' : 's'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="av-equipo-salida-selected">
                    <h3>Seleccionados ({salidaSeleccion.length})</h3>
                    {salidaSeleccion.length === 0 ? (
                      <p className="section-note">Agrega equipos con el buscador.</p>
                    ) : (
                      <ul>
                        {salidaSeleccion.map((equipo) => (
                          <li key={equipo.equipoId}>
                            <span>{equipo.nombre}</span>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => removeEquipoDeSalida(equipo.equipoId)}
                              disabled={salidaSubmitting}
                            >
                              Quitar
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={closeSalida}
                      disabled={salidaSubmitting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={salidaSubmitting || salidaSeleccion.length === 0}
                      onClick={() => setSalidaStep('revision')}
                    >
                      Continuar a revisión
                    </button>
                  </div>
                </>
              ) : null}

              {salidaStep === 'revision' ? (
                <>
                  <p className="section-note">
                    Confirma el buen estado de cada ítem y deja observaciones si hace falta.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={confirmarBuenEstadoTodos}
                    disabled={salidaSubmitting || revisionCompleta}
                  >
                    Confirmar buen estado de todos
                  </button>

                  <div className="av-equipo-salida-revision-list">
                    {salidaSeleccion.map((equipo) => (
                      <section key={equipo.equipoId} className="av-equipo-salida-revision-card">
                        <h3>{equipo.nombre}</h3>
                        {equipo.items.length === 0 ? (
                          <p className="section-note">Este equipo no tiene ítems de revisión.</p>
                        ) : (
                          <ul>
                            {equipo.items.map((item) => (
                              <li key={item.itemId}>
                                <label className="av-equipo-salida-check">
                                  <input
                                    type="checkbox"
                                    checked={item.ok}
                                    onChange={(event) =>
                                      updateSalidaItem(equipo.equipoId, item.itemId, {
                                        ok: event.target.checked,
                                      })
                                    }
                                    disabled={salidaSubmitting}
                                  />
                                  <span>{item.nombre}</span>
                                </label>
                                <label className="login-field">
                                  Observaciones
                                  <input
                                    type="text"
                                    value={item.observacion}
                                    onChange={(event) =>
                                      updateSalidaItem(equipo.equipoId, item.itemId, {
                                        observacion: event.target.value,
                                      })
                                    }
                                    placeholder="Opcional"
                                    disabled={salidaSubmitting}
                                  />
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    ))}
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSalidaStep('seleccion')}
                      disabled={salidaSubmitting}
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={salidaSubmitting || !revisionCompleta}
                      onClick={() => setSalidaStep('responsable')}
                    >
                      Continuar
                    </button>
                  </div>
                </>
              ) : null}

              {salidaStep === 'responsable' ? (
                <>
                  <label className="login-field" htmlFor="av-equipo-salida-responsable">
                    Quién se lleva los equipos
                    <select
                      id="av-equipo-salida-responsable"
                      value={salidaResponsableKey}
                      onChange={(event) => setSalidaResponsableKey(event.target.value)}
                      disabled={salidaSubmitting || salidaLoadingResponsables}
                      required
                    >
                      <option value="">
                        {salidaLoadingResponsables
                          ? 'Cargando…'
                          : 'Selecciona administrador o vendedor'}
                      </option>
                      {salidaResponsables.map((item) => (
                        <option key={`${item.rol}:${item.uid}`} value={`${item.rol}:${item.uid}`}>
                          {item.nombre} ({item.rol === 'vendedor' ? 'Vendedor' : 'Admin'})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="av-equipo-salida-resumen">
                    <p>
                      <strong>{salidaSeleccion.length}</strong> equipo
                      {salidaSeleccion.length === 1 ? '' : 's'} pasarán a{' '}
                      <strong>En producción</strong>.
                    </p>
                    <ul>
                      {salidaSeleccion.map((equipo) => (
                        <li key={equipo.equipoId}>{equipo.nombre}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSalidaStep('revision')}
                      disabled={salidaSubmitting}
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={salidaSubmitting || !salidaResponsableKey || !revisionCompleta}
                      onClick={() => void confirmarSalida()}
                    >
                      {salidaSubmitting ? (
                        <>
                          <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                          Confirmando...
                        </>
                      ) : (
                        'Confirmar salida'
                      )}
                    </button>
                  </div>
                </>
              ) : null}

              {salidaError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {salidaError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {ingresoNotice ? (
        <div className="modal-overlay" role="presentation" onClick={() => setIngresoNotice(false)}>
          <div
            className="modal-panel av-equipo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-equipo-ingreso-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-equipo-ingreso-title">Ingreso de equipos</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIngresoNotice(false)}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="modal-form">
              <p className="section-note">
                La entrada de equipos se implementará a continuación. Por ahora solo está
                disponible la salida a producción.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setIngresoNotice(false)}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
