import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createAvServicioCredito,
  createAvServicioDistribucion,
  deleteAvServicioCredito,
  deleteAvServicioDistribucion,
  listAvServicioDistribuciones,
  listAvServiciosCreditos,
  updateAvServicioCredito,
  updateAvServicioDistribucion,
  type AvServicioCredito,
  type AvServicioDistribucionItem,
  type AvServicioDistribucionPlantilla,
} from '../api/audiovisual'
import { formatCop } from '../api/administradores'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  ChevronDown,
  Coins,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from '../icons'

type ModalMode = 'crear' | 'editar'

type DistRow = {
  key: string
  id?: string
  concepto: string
  porcentaje: string
}

type EntregableRow = {
  key: string
  id?: string
  texto: string
}

function newDistRow(partial?: Partial<DistRow>): DistRow {
  return {
    key: `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    id: partial?.id,
    concepto: partial?.concepto || '',
    porcentaje: partial?.porcentaje || '',
  }
}

function newEntregableRow(partial?: Partial<EntregableRow>): EntregableRow {
  return {
    key: `ent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    id: partial?.id,
    texto: partial?.texto || '',
  }
}

function parsePct(raw: string): number {
  const n = Number(String(raw).replace(',', '.').trim())
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function rowsFromItems(items: AvServicioDistribucionItem[] | undefined): DistRow[] {
  if (!items?.length) return [newDistRow()]
  return items.map((item) =>
    newDistRow({
      id: item.id,
      concepto: item.concepto,
      porcentaje: String(item.porcentaje),
    }),
  )
}

function useDistStats(distribucion: DistRow[], costoNum = 0) {
  return useMemo(() => {
    const rows = distribucion.map((row) => ({
      ...row,
      pct: parsePct(row.porcentaje),
      conceptoOk: Boolean(row.concepto.trim()),
    }))
    const totalCents = rows.reduce((acc, row) => acc + Math.round(row.pct * 100), 0)
    const totalPct = totalCents / 100
    const restante = Math.round(10000 - totalCents) / 100
    const allConceptos = rows.every((row) => row.conceptoOk)
    const allPctPositive = rows.every((row) => row.pct > 0)
    const exact100 = totalCents === 10000
    return {
      rows,
      totalPct,
      restante,
      exact100,
      canSave: rows.length > 0 && allConceptos && allPctPositive && exact100 && (costoNum <= 0 || costoNum > 0),
      canSaveWithCosto:
        rows.length > 0 && allConceptos && allPctPositive && exact100 && costoNum > 0,
    }
  }, [distribucion, costoNum])
}

function DistRowsEditor({
  rows,
  onChange,
  costoNum = 0,
  showMoney = true,
  submitting = false,
}: {
  rows: DistRow[]
  onChange: (next: DistRow[]) => void
  costoNum?: number
  showMoney?: boolean
  submitting?: boolean
}) {
  const stats = useDistStats(rows, costoNum)

  function updateRow(key: string, patch: Partial<DistRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  return (
    <>
      <div className="av-servicio-dist-list">
        {rows.map((row) => {
          const pct = parsePct(row.porcentaje)
          const valor = showMoney && costoNum > 0 && pct > 0 ? Math.round((costoNum * pct) / 100) : 0
          return (
            <div key={row.key} className="av-servicio-dist-row">
              <label className="login-field">
                Concepto
                <input
                  type="text"
                  value={row.concepto}
                  onChange={(event) => updateRow(row.key, { concepto: event.target.value })}
                  placeholder="Ej. Producción, Comisión…"
                  disabled={submitting}
                  required
                />
              </label>
              <label className="login-field">
                %
                <input
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  inputMode="decimal"
                  value={row.porcentaje}
                  onChange={(event) => updateRow(row.key, { porcentaje: event.target.value })}
                  disabled={submitting}
                  required
                />
              </label>
              {showMoney ? (
                <div className="av-servicio-dist-valor" aria-live="polite">
                  <span>Valor</span>
                  <strong>{formatCop(valor)}</strong>
                </div>
              ) : (
                <div className="av-servicio-dist-valor" aria-live="polite">
                  <span>%</span>
                  <strong>{pct > 0 ? `${pct}%` : '—'}</strong>
                </div>
              )}
              <button
                type="button"
                className="btn-secondary av-servicio-dist-remove"
                onClick={() => {
                  if (rows.length <= 1) return
                  onChange(rows.filter((item) => item.key !== row.key))
                }}
                disabled={submitting || rows.length <= 1}
                aria-label="Quitar ítem"
              >
                <Trash2 size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        className="btn-secondary"
        onClick={() => onChange([...rows, newDistRow()])}
        disabled={submitting}
      >
        <Plus size={14} strokeWidth={2} aria-hidden />
        Agregar ítem
      </button>

      <div
        className={`av-servicio-dist-summary ${stats.exact100 ? 'is-ok' : 'is-pending'}`}
        aria-live="polite"
      >
        <span>
          Total %: <strong>{stats.totalPct.toFixed(2)}%</strong>
        </span>
        {showMoney ? (
          <>
            <span>
              Destinado:{' '}
              <strong>
                {formatCop(Math.round((costoNum * Math.min(stats.totalPct, 100)) / 100))}
              </strong>
            </span>
            <span>
              Restante:{' '}
              <strong>
                {stats.restante.toFixed(2)}% ·{' '}
                {formatCop(Math.round((costoNum * Math.max(stats.restante, 0)) / 100))}
              </strong>
            </span>
          </>
        ) : (
          <span>
            Restante: <strong>{stats.restante.toFixed(2)}%</strong>
          </span>
        )}
      </div>
    </>
  )
}

export function AvCreditosPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [servicios, setServicios] = useState<AvServicioCredito[]>([])
  const [plantillas, setPlantillas] = useState<AvServicioDistribucionPlantilla[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')
  const [deletingPlantillaId, setDeletingPlantillaId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvServicioCredito | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [costo, setCosto] = useState('')
  const [entregables, setEntregables] = useState<EntregableRow[]>([newEntregableRow()])
  const [distribucion, setDistribucion] = useState<DistRow[]>([newDistRow()])
  const [plantillaId, setPlantillaId] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [distModalOpen, setDistModalOpen] = useState(false)
  const [distModalMode, setDistModalMode] = useState<ModalMode>('crear')
  const [editingPlantilla, setEditingPlantilla] =
    useState<AvServicioDistribucionPlantilla | null>(null)
  const [plantillaNombre, setPlantillaNombre] = useState('')
  const [plantillaItems, setPlantillaItems] = useState<DistRow[]>([newDistRow()])
  const [distFormError, setDistFormError] = useState('')
  const [distSubmitting, setDistSubmitting] = useState(false)
  const [expandedServicioIds, setExpandedServicioIds] = useState<Set<string>>(() => new Set())
  const [expandedPlantillaIds, setExpandedPlantillaIds] = useState<Set<string>>(() => new Set())

  function toggleServicioExpanded(id: string) {
    setExpandedServicioIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePlantillaExpanded(id: string) {
    setExpandedPlantillaIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const costoNum = useMemo(() => {
    const n = Number(String(costo).replace(/,/g, '').trim())
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [costo])

  const distStats = useDistStats(distribucion, costoNum)
  const plantillaStats = useDistStats(plantillaItems, 0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const [serviciosData, plantillasData] = await Promise.all([
          listAvServiciosCreditos(token),
          listAvServicioDistribuciones(token),
        ])
        if (!cancelled) {
          setServicios(serviciosData)
          setPlantillas(plantillasData)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los servicios')
          setServicios([])
          setPlantillas([])
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

  function openCreate() {
    setModalMode('crear')
    setEditing(null)
    setNombre('')
    setDescripcion('')
    setCosto('')
    setEntregables([newEntregableRow()])
    setDistribucion([newDistRow()])
    setPlantillaId('')
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(servicio: AvServicioCredito) {
    setModalMode('editar')
    setEditing(servicio)
    setNombre(servicio.nombre || '')
    setDescripcion(servicio.descripcion || '')
    setCosto(String(servicio.costo || ''))
    setEntregables(
      (servicio.entregables || []).length > 0
        ? servicio.entregables.map((item) =>
            newEntregableRow({ id: item.id, texto: item.texto }),
          )
        : [newEntregableRow()],
    )
    setDistribucion(rowsFromItems(servicio.distribucion))
    setPlantillaId(servicio.distribucionPlantillaId || '')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setFormError('')
  }

  function openCreateDist() {
    setDistModalMode('crear')
    setEditingPlantilla(null)
    setPlantillaNombre('')
    setPlantillaItems([newDistRow()])
    setDistFormError('')
    setDistModalOpen(true)
  }

  function openEditDist(plantilla: AvServicioDistribucionPlantilla) {
    setDistModalMode('editar')
    setEditingPlantilla(plantilla)
    setPlantillaNombre(plantilla.nombre || '')
    setPlantillaItems(rowsFromItems(plantilla.items))
    setDistFormError('')
    setDistModalOpen(true)
  }

  function closeDistModal() {
    if (distSubmitting) return
    setDistModalOpen(false)
    setDistFormError('')
  }

  function applyPlantilla(id: string) {
    setPlantillaId(id)
    if (!id) return
    const plantilla = plantillas.find((item) => item.id === id)
    if (!plantilla) return
    setDistribucion(rowsFromItems(plantilla.items))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const nombreValue = nombre.trim()
    const descripcionValue = descripcion.trim()
    const costoValue = Number(String(costo).replace(/,/g, '').trim())

    if (!nombreValue) {
      setFormError('El nombre del servicio es obligatorio.')
      return
    }
    if (!descripcionValue) {
      setFormError('La descripción es obligatoria.')
      return
    }
    if (!Number.isFinite(costoValue) || costoValue <= 0) {
      setFormError('El costo debe ser un valor en dinero mayor a 0.')
      return
    }

    const entregablesPayload = entregables
      .map((row) => ({
        id: row.id,
        texto: row.texto.trim(),
      }))
      .filter((row) => row.texto)

    if (!entregablesPayload.length) {
      setFormError('Agrega al menos un entregable que reciba el cliente.')
      return
    }

    if (!distStats.exact100) {
      if (distStats.restante > 0) {
        setFormError(
          `Falta destinar ${distStats.restante.toFixed(2)}%. La distribución debe sumar exactamente 100%.`,
        )
      } else {
        setFormError(`La distribución suma ${distStats.totalPct}% y debe ser exactamente 100%.`)
      }
      return
    }
    if (!distStats.rows.every((row) => row.conceptoOk && row.pct > 0)) {
      setFormError('Cada ítem necesita concepto y un porcentaje mayor a 0.')
      return
    }

    const plantilla = plantillas.find((item) => item.id === plantillaId) || null
    const distribucionPayload = distStats.rows.map((row) => ({
      id: row.id,
      concepto: row.concepto.trim(),
      porcentaje: row.pct,
    }))

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      const payload = {
        nombre: nombreValue,
        descripcion: descripcionValue,
        costo: Math.round(costoValue),
        entregables: entregablesPayload,
        distribucion: distribucionPayload,
        distribucionPlantillaId: plantilla?.id || null,
        distribucionPlantillaNombre: plantilla?.nombre || null,
      }
      if (modalMode === 'crear') {
        const created = await createAvServicioCredito(token, payload)
        setServicios((current) => [created, ...current])
      } else if (editing) {
        const updated = await updateAvServicioCredito(token, editing.id, payload)
        setServicios((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      }
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el servicio')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDistSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const nombreValue = plantillaNombre.trim()
    if (!nombreValue) {
      setDistFormError('El nombre de la distribución es obligatorio.')
      return
    }
    if (!plantillaStats.exact100) {
      if (plantillaStats.restante > 0) {
        setDistFormError(
          `Falta destinar ${plantillaStats.restante.toFixed(2)}%. Debe sumar exactamente 100%.`,
        )
      } else {
        setDistFormError(
          `La distribución suma ${plantillaStats.totalPct}% y debe ser exactamente 100%.`,
        )
      }
      return
    }
    if (!plantillaStats.rows.every((row) => row.conceptoOk && row.pct > 0)) {
      setDistFormError('Cada ítem necesita concepto y un porcentaje mayor a 0.')
      return
    }

    const items = plantillaStats.rows.map((row) => ({
      id: row.id,
      concepto: row.concepto.trim(),
      porcentaje: row.pct,
    }))

    setDistSubmitting(true)
    setDistFormError('')
    try {
      const token = await user.getIdToken()
      if (distModalMode === 'crear') {
        const created = await createAvServicioDistribucion(token, {
          nombre: nombreValue,
          items,
        })
        setPlantillas((current) => [created, ...current])
      } else if (editingPlantilla) {
        const updated = await updateAvServicioDistribucion(token, editingPlantilla.id, {
          nombre: nombreValue,
          items,
        })
        setPlantillas((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      }
      setDistModalOpen(false)
    } catch (err) {
      setDistFormError(err instanceof Error ? err.message : 'No se pudo guardar la distribución')
    } finally {
      setDistSubmitting(false)
    }
  }

  async function handleDelete(servicio: AvServicioCredito) {
    if (!user || readOnly || deletingId) return
    const ok = window.confirm(
      `¿Eliminar el servicio «${servicio.nombre || 'sin nombre'}» (ref ${servicio.referencia || '—'})?`,
    )
    if (!ok) return

    setDeletingId(servicio.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvServicioCredito(token, servicio.id)
      setServicios((current) => current.filter((item) => item.id !== servicio.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el servicio')
    } finally {
      setDeletingId('')
    }
  }

  async function handleDeletePlantilla(plantilla: AvServicioDistribucionPlantilla) {
    if (!user || readOnly || deletingPlantillaId) return
    const ok = window.confirm(
      `¿Eliminar la distribución «${plantilla.nombre || 'sin nombre'}»? Los servicios que ya la usan conservan su copia.`,
    )
    if (!ok) return

    setDeletingPlantillaId(plantilla.id)
    setError('')
    try {
      const token = await user.getIdToken()
      await deleteAvServicioDistribucion(token, plantilla.id)
      setPlantillas((current) => current.filter((item) => item.id !== plantilla.id))
      if (plantillaId === plantilla.id) setPlantillaId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la distribución')
    } finally {
      setDeletingPlantillaId('')
    }
  }

  return (
    <div className="av-creditos" role="tabpanel" aria-label="Servicios">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Servicios</h3>
          <p className="section-note">
            Define servicios con costo en dinero. Crea distribuciones reutilizables en % y asígnalas
            a varios servicios sin repetirlas. Al crear un servicio se genera una referencia de 4
            dígitos única.
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
              <button type="button" className="btn-secondary" onClick={openCreateDist}>
                <Layers size={16} strokeWidth={2} aria-hidden />
                Crear distribución
              </button>
              <button type="button" className="btn-primary" onClick={openCreate}>
                <Plus size={16} strokeWidth={2} aria-hidden />
                Nuevo servicio
              </button>
            </>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando servicios...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && plantillas.length > 0 ? (
        <section className="av-servicio-plantillas" aria-label="Distribuciones guardadas">
          <div className="av-servicio-plantillas-head">
            <h4>Distribuciones guardadas</h4>
            <p className="section-note">Asígnelas al crear o editar un servicio.</p>
          </div>
          <div className="av-servicio-plantillas-list">
            {plantillas.map((plantilla) => {
              const expanded = expandedPlantillaIds.has(plantilla.id)
              const itemsCount = (plantilla.items || []).length
              return (
                <article
                  key={plantilla.id}
                  className={`av-servicio-plantilla-card ${expanded ? 'is-expanded' : ''}`}
                >
                  <button
                    type="button"
                    className="av-servicio-card-toggle"
                    aria-expanded={expanded}
                    onClick={() => togglePlantillaExpanded(plantilla.id)}
                  >
                    <span className="av-servicio-card-toggle-main">
                      <strong>{plantilla.nombre || 'Sin nombre'}</strong>
                      <span className="av-servicio-card-meta">
                        {itemsCount} partida{itemsCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden
                      className={`av-servicio-card-chevron ${expanded ? 'is-open' : ''}`}
                    />
                  </button>
                  {expanded ? (
                    <div className="av-servicio-card-body">
                      <ul className="av-servicio-dist-preview">
                        {(plantilla.items || []).map((item) => (
                          <li key={item.id}>
                            <span>{item.concepto}</span>
                            <strong>{item.porcentaje}%</strong>
                          </li>
                        ))}
                      </ul>
                      {!readOnly ? (
                        <div className="av-ingresos-row-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openEditDist(plantilla)}
                          >
                            <Pencil size={14} strokeWidth={2} aria-hidden />
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={deletingPlantillaId === plantilla.id}
                            onClick={() => void handleDeletePlantilla(plantilla)}
                          >
                            {deletingPlantillaId === plantilla.id ? (
                              <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                            ) : (
                              <Trash2 size={14} strokeWidth={2} aria-hidden />
                            )}
                            Eliminar
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {!loading && !error && servicios.length === 0 ? (
        <div className="proyectos-empty">
          <Coins size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay servicios. Crea una distribución y luego el primer servicio.</p>
          {!readOnly ? (
            <div className="av-ingresos-toolbar-actions">
              <button type="button" className="btn-secondary" onClick={openCreateDist}>
                <Layers size={16} strokeWidth={2} aria-hidden />
                Crear distribución
              </button>
              <button type="button" className="btn-primary" onClick={openCreate}>
                <Plus size={16} strokeWidth={2} aria-hidden />
                Nuevo servicio
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && servicios.length > 0 ? (
        <div className="av-servicios-cards" role="list">
          {servicios.map((servicio) => {
            const expanded = expandedServicioIds.has(servicio.id)
            const distCount = (servicio.distribucion || []).length
            return (
              <article
                key={servicio.id}
                className={`av-servicio-card ${expanded ? 'is-expanded' : ''}`}
                role="listitem"
              >
                <button
                  type="button"
                  className="av-servicio-card-toggle"
                  aria-expanded={expanded}
                  onClick={() => toggleServicioExpanded(servicio.id)}
                >
                  <span className="av-servicio-card-toggle-main">
                    <span className="av-servicio-card-title-row">
                      <span className="av-credito-ref">{servicio.referencia || '—'}</span>
                      <strong className="av-servicio-card-name">
                        {servicio.nombre || 'Sin nombre'}
                      </strong>
                    </span>
                    <span className="av-servicio-card-summary">
                      <span className="av-servicio-card-costo">{formatCop(servicio.costo || 0)}</span>
                      <span className="av-servicio-card-meta">
                        {(servicio.entregables || []).length} entregable
                        {(servicio.entregables || []).length === 1 ? '' : 's'}
                        {' · '}
                        {distCount} partida{distCount === 1 ? '' : 's'}
                        {servicio.distribucionPlantillaNombre
                          ? ` · ${servicio.distribucionPlantillaNombre}`
                          : ''}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    strokeWidth={2}
                    aria-hidden
                    className={`av-servicio-card-chevron ${expanded ? 'is-open' : ''}`}
                  />
                </button>

                {expanded ? (
                  <div className="av-servicio-card-body">
                    {servicio.descripcion ? (
                      <p className="av-servicio-card-desc">{servicio.descripcion}</p>
                    ) : null}
                    {(servicio.entregables || []).length > 0 ? (
                      <div className="av-servicio-entregables-preview">
                        <span className="av-servicio-entregables-label">Entregables</span>
                        <ul>
                          {servicio.entregables.map((item) => (
                            <li key={item.id}>{item.texto}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {servicio.distribucionPlantillaNombre ? (
                      <p className="av-servicio-plantilla-tag">
                        Plantilla: {servicio.distribucionPlantillaNombre}
                      </p>
                    ) : null}
                    {distCount > 0 ? (
                      <ul className="av-servicio-dist-preview">
                        {servicio.distribucion.map((item) => (
                          <li key={item.id}>
                            <span>{item.concepto}</span>
                            <strong>
                              {item.porcentaje}% ·{' '}
                              {formatCop(
                                item.valor ??
                                  Math.round((servicio.costo * item.porcentaje) / 100),
                              )}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="av-servicio-card-empty">Sin distribución</p>
                    )}
                    {!readOnly ? (
                      <div className="av-ingresos-row-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openEdit(servicio)}
                        >
                          <Pencil size={14} strokeWidth={2} aria-hidden />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={deletingId === servicio.id}
                          onClick={() => void handleDelete(servicio)}
                        >
                          {deletingId === servicio.id ? (
                            <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                          ) : (
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                          )}
                          Eliminar
                        </button>
                      </div>
                    ) : null}
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
            className="modal-panel av-servicio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-servicio-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-servicio-modal-title">
                {modalMode === 'crear' ? 'Nuevo servicio' : 'Editar servicio'}
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
              {modalMode === 'editar' && editing?.referencia ? (
                <p className="section-note">
                  Referencia: <strong className="av-credito-ref">{editing.referencia}</strong> (no
                  cambia al editar)
                </p>
              ) : (
                <p className="section-note">
                  Al guardar se generará automáticamente un número de referencia de 4 dígitos único.
                </p>
              )}

              <label className="login-field" htmlFor="av-servicio-nombre">
                Nombre del servicio
                <input
                  id="av-servicio-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  disabled={submitting}
                  required
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="av-servicio-descripcion">
                Descripción
                <textarea
                  id="av-servicio-descripcion"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  rows={3}
                  disabled={submitting}
                  required
                />
              </label>

              <fieldset className="av-servicio-entregables" disabled={submitting}>
                <legend>Entregables al cliente</legend>
                <p className="section-note">
                  Lista qué recibe el cliente con este servicio (archivos, piezas, sesiones, etc.).
                </p>
                <div className="av-servicio-entregables-list">
                  {entregables.map((row, index) => (
                    <div key={row.key} className="av-servicio-entregable-row">
                      <label className="login-field">
                        Entregable {index + 1}
                        <input
                          type="text"
                          value={row.texto}
                          onChange={(event) =>
                            setEntregables((current) =>
                              current.map((item) =>
                                item.key === row.key
                                  ? { ...item, texto: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Ej. Video editado en 4K, 60 s"
                          disabled={submitting}
                          required={index === 0}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-secondary av-servicio-entregable-remove"
                        onClick={() =>
                          setEntregables((current) =>
                            current.length <= 1
                              ? [newEntregableRow()]
                              : current.filter((item) => item.key !== row.key),
                          )
                        }
                        disabled={submitting}
                        aria-label={`Quitar entregable ${index + 1}`}
                      >
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEntregables((current) => [...current, newEntregableRow()])}
                  disabled={submitting || entregables.length >= 40}
                >
                  <Plus size={14} strokeWidth={2} aria-hidden />
                  Agregar entregable
                </button>
              </fieldset>

              <label className="login-field" htmlFor="av-servicio-costo">
                Costo del servicio
                <input
                  id="av-servicio-costo"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={costo}
                  onChange={(event) => setCosto(event.target.value)}
                  disabled={submitting}
                  required
                />
              </label>
              {costoNum > 0 ? (
                <p className="av-servicio-costo-live">
                  Valor total: <strong>{formatCop(Math.round(costoNum))}</strong>
                </p>
              ) : null}

              <fieldset className="av-servicio-dist" disabled={submitting}>
                <legend>Distribución del valor</legend>
                <label className="login-field" htmlFor="av-servicio-plantilla">
                  Asignar distribución guardada
                  <select
                    id="av-servicio-plantilla"
                    value={plantillaId}
                    onChange={(event) => applyPlantilla(event.target.value)}
                    disabled={submitting}
                  >
                    <option value="">Personalizada / sin plantilla</option>
                    {plantillas.map((plantilla) => (
                      <option key={plantilla.id} value={plantilla.id}>
                        {plantilla.nombre || 'Sin nombre'}
                      </option>
                    ))}
                  </select>
                </label>
                {plantillas.length === 0 ? (
                  <p className="section-note">
                    Aún no hay distribuciones guardadas.{' '}
                    <button
                      type="button"
                      className="av-servicio-inline-link"
                      onClick={() => {
                        closeModal()
                        openCreateDist()
                      }}
                    >
                      Crear una
                    </button>
                  </p>
                ) : (
                  <p className="section-note">
                    Al elegir una plantilla se copian sus %. Puedes ajustarlas después si hace falta.
                  </p>
                )}

                <DistRowsEditor
                  rows={distribucion}
                  onChange={(next) => {
                    setDistribucion(next)
                    setPlantillaId('')
                  }}
                  costoNum={costoNum}
                  showMoney
                  submitting={submitting}
                />
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
                  disabled={submitting || !distStats.canSaveWithCosto}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : modalMode === 'crear' ? (
                    'Crear servicio'
                  ) : (
                    'Guardar cambios'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {distModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeDistModal}>
          <div
            className="modal-panel av-servicio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-dist-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-dist-modal-title">
                {distModalMode === 'crear' ? 'Crear distribución' : 'Editar distribución'}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeDistModal}
                disabled={distSubmitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={(event) => void handleDistSubmit(event)}
              noValidate
            >
              <p className="section-note">
                Define una plantilla de porcentajes (debe sumar 100%) para reutilizarla en varios
                servicios.
              </p>

              <label className="login-field" htmlFor="av-dist-nombre">
                Nombre de la distribución
                <input
                  id="av-dist-nombre"
                  type="text"
                  value={plantillaNombre}
                  onChange={(event) => setPlantillaNombre(event.target.value)}
                  disabled={distSubmitting}
                  required
                  autoFocus
                  placeholder="Ej. Estándar producción"
                />
              </label>

              <fieldset className="av-servicio-dist" disabled={distSubmitting}>
                <legend>Porcentajes</legend>
                <DistRowsEditor
                  rows={plantillaItems}
                  onChange={setPlantillaItems}
                  showMoney={false}
                  submitting={distSubmitting}
                />
              </fieldset>

              {distFormError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {distFormError}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeDistModal}
                  disabled={distSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={distSubmitting || !plantillaStats.exact100 || !plantillaNombre.trim()}
                >
                  {distSubmitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : distModalMode === 'crear' ? (
                    'Crear distribución'
                  ) : (
                    'Guardar cambios'
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
