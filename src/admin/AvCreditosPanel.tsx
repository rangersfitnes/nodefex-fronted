import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  createAvConceptoParticion,
  createAvServicioCredito,
  createAvServicioDistribucion,
  deleteAvConceptoParticion,
  deleteAvServicioCredito,
  deleteAvServicioDistribucion,
  listAvConceptosParticion,
  listAvServicioDistribuciones,
  listAvServiciosCreditos,
  updateAvConceptoParticion,
  updateAvServicioCredito,
  updateAvServicioDistribucion,
  type AvConceptoParticion,
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
  Tags,
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

function normalizeConceptoKey(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, ' ')
}

function rowsFromItems(
  items: AvServicioDistribucionItem[] | undefined,
  conceptos: AvConceptoParticion[] = [],
): DistRow[] {
  if (!items?.length) return [newDistRow()]
  const byKey = new Map(
    conceptos
      .map((item) => [normalizeConceptoKey(item.nombre || ''), item.nombre || ''] as const)
      .filter(([key, nombre]) => key && nombre),
  )
  return items.map((item) => {
    const key = normalizeConceptoKey(item.concepto)
    const canonical = byKey.get(key) || item.concepto
    return newDistRow({
      id: item.id,
      concepto: canonical,
      porcentaje: String(item.porcentaje),
    })
  })
}

function useDistStats(
  distribucion: DistRow[],
  costoNum = 0,
  allowedConceptos: AvConceptoParticion[] = [],
) {
  return useMemo(() => {
    const allowedKeys = new Set(
      allowedConceptos
        .map((item) => normalizeConceptoKey(item.nombre || ''))
        .filter(Boolean),
    )
    const usedKeys = new Set<string>()
    let hasDupes = false
    const rows = distribucion.map((row) => {
      const key = normalizeConceptoKey(row.concepto)
      const inCatalog = Boolean(key) && allowedKeys.has(key)
      if (inCatalog) {
        if (usedKeys.has(key)) hasDupes = true
        else usedKeys.add(key)
      }
      return {
        ...row,
        pct: parsePct(row.porcentaje),
        conceptoOk: inCatalog,
      }
    })
    const totalCents = rows.reduce((acc, row) => acc + Math.round(row.pct * 100), 0)
    const totalPct = totalCents / 100
    const restante = Math.round(10000 - totalCents) / 100
    const allConceptos = rows.every((row) => row.conceptoOk) && !hasDupes
    const allPctPositive = rows.every((row) => row.pct > 0)
    const exact100 = totalCents === 10000
    const catalogReady = allowedKeys.size > 0
    return {
      rows,
      totalPct,
      restante,
      exact100,
      hasDupes,
      catalogReady,
      canSave:
        catalogReady &&
        rows.length > 0 &&
        allConceptos &&
        allPctPositive &&
        exact100 &&
        (costoNum <= 0 || costoNum > 0),
      canSaveWithCosto:
        catalogReady &&
        rows.length > 0 &&
        allConceptos &&
        allPctPositive &&
        exact100 &&
        costoNum > 0,
    }
  }, [distribucion, costoNum, allowedConceptos])
}

function DistRowsEditor({
  rows,
  onChange,
  conceptos,
  costoNum = 0,
  showMoney = true,
  submitting = false,
}: {
  rows: DistRow[]
  onChange: (next: DistRow[]) => void
  conceptos: AvConceptoParticion[]
  costoNum?: number
  showMoney?: boolean
  submitting?: boolean
}) {
  const stats = useDistStats(rows, costoNum, conceptos)
  const conceptoNombres = conceptos.map((item) => item.nombre || '').filter(Boolean)

  function updateRow(key: string, patch: Partial<DistRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  return (
    <>
      {conceptoNombres.length === 0 ? (
        <p className="section-note av-concepto-empty-hint">
          Primero crea conceptos de partición con el botón «Conceptos de partición». Sin ellos no se
          puede armar la distribución.
        </p>
      ) : null}
      <div className="av-servicio-dist-list">
        {rows.map((row) => {
          const pct = parsePct(row.porcentaje)
          const valor = showMoney && costoNum > 0 && pct > 0 ? Math.round((costoNum * pct) / 100) : 0
          const rowKey = normalizeConceptoKey(row.concepto)
          const orphan =
            Boolean(row.concepto.trim()) &&
            !conceptoNombres.some((nombre) => normalizeConceptoKey(nombre) === rowKey)
          const usedByOthers = new Set(
            rows
              .filter((item) => item.key !== row.key)
              .map((item) => normalizeConceptoKey(item.concepto))
              .filter(Boolean),
          )
          return (
            <div key={row.key} className="av-servicio-dist-row">
              <label className="login-field">
                Concepto
                <select
                  value={row.concepto}
                  onChange={(event) => updateRow(row.key, { concepto: event.target.value })}
                  disabled={submitting || conceptoNombres.length === 0}
                  required
                >
                  <option value="">Selecciona un concepto…</option>
                  {orphan ? (
                    <option value={row.concepto}>
                      {row.concepto} (no estandarizado — elige otro)
                    </option>
                  ) : null}
                  {conceptoNombres.map((nombre) => {
                    const optionKey = normalizeConceptoKey(nombre)
                    const taken = usedByOthers.has(optionKey) && optionKey !== rowKey
                    return (
                      <option key={nombre} value={nombre} disabled={taken}>
                        {taken ? `${nombre} (ya usado)` : nombre}
                      </option>
                    )
                  })}
                </select>
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
        disabled={
          submitting ||
          conceptoNombres.length === 0 ||
          rows.length >= conceptoNombres.length
        }
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
  const [conceptos, setConceptos] = useState<AvConceptoParticion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')
  const [deletingPlantillaId, setDeletingPlantillaId] = useState('')
  const [deletingConceptoId, setDeletingConceptoId] = useState('')

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

  const [conceptosModalOpen, setConceptosModalOpen] = useState(false)
  const [conceptoNombre, setConceptoNombre] = useState('')
  const [editingConcepto, setEditingConcepto] = useState<AvConceptoParticion | null>(null)
  const [conceptoFormError, setConceptoFormError] = useState('')
  const [conceptoSubmitting, setConceptoSubmitting] = useState(false)

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

  const distStats = useDistStats(distribucion, costoNum, conceptos)
  const plantillaStats = useDistStats(plantillaItems, 0, conceptos)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const [serviciosData, plantillasData, conceptosData] = await Promise.all([
          listAvServiciosCreditos(token),
          listAvServicioDistribuciones(token),
          listAvConceptosParticion(token),
        ])
        if (!cancelled) {
          setServicios(serviciosData)
          setPlantillas(plantillasData)
          setConceptos(conceptosData)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los servicios')
          setServicios([])
          setPlantillas([])
          setConceptos([])
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
    setDistribucion(rowsFromItems(servicio.distribucion, conceptos))
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
    setPlantillaItems(rowsFromItems(plantilla.items, conceptos))
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
    setDistribucion(rowsFromItems(plantilla.items, conceptos))
  }

  function openConceptosModal() {
    setConceptoNombre('')
    setEditingConcepto(null)
    setConceptoFormError('')
    setConceptosModalOpen(true)
  }

  function closeConceptosModal() {
    if (conceptoSubmitting) return
    setConceptosModalOpen(false)
    setConceptoNombre('')
    setEditingConcepto(null)
    setConceptoFormError('')
  }

  function startEditConcepto(concepto: AvConceptoParticion) {
    setEditingConcepto(concepto)
    setConceptoNombre(concepto.nombre || '')
    setConceptoFormError('')
  }

  function cancelEditConcepto() {
    setEditingConcepto(null)
    setConceptoNombre('')
    setConceptoFormError('')
  }

  async function handleConceptoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!user || conceptoSubmitting) return

    const nombreValue = conceptoNombre.trim()
    if (!nombreValue) {
      setConceptoFormError('El nombre del concepto es obligatorio.')
      return
    }

    setConceptoSubmitting(true)
    setConceptoFormError('')
    try {
      const token = await user.getIdToken()
      if (editingConcepto) {
        const updated = await updateAvConceptoParticion(token, editingConcepto.id, {
          nombre: nombreValue,
        })
        setConceptos((current) =>
          current
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) =>
              String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'),
            ),
        )
      } else {
        const created = await createAvConceptoParticion(token, { nombre: nombreValue })
        setConceptos((current) =>
          [...current, created].sort((a, b) =>
            String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'),
          ),
        )
      }
      setEditingConcepto(null)
      setConceptoNombre('')
    } catch (err) {
      setConceptoFormError(
        err instanceof Error ? err.message : 'No se pudo guardar el concepto de partición',
      )
    } finally {
      setConceptoSubmitting(false)
    }
  }

  async function handleDeleteConcepto(concepto: AvConceptoParticion) {
    if (!user || readOnly || deletingConceptoId) return
    const ok = window.confirm(
      `¿Eliminar el concepto «${concepto.nombre || 'sin nombre'}»? Los servicios que ya lo usan conservan el texto, pero no podrás volver a elegirlo hasta recrearlo.`,
    )
    if (!ok) return

    setDeletingConceptoId(concepto.id)
    setConceptoFormError('')
    try {
      const token = await user.getIdToken()
      await deleteAvConceptoParticion(token, concepto.id)
      setConceptos((current) => current.filter((item) => item.id !== concepto.id))
      if (editingConcepto?.id === concepto.id) cancelEditConcepto()
    } catch (err) {
      setConceptoFormError(
        err instanceof Error ? err.message : 'No se pudo eliminar el concepto de partición',
      )
    } finally {
      setDeletingConceptoId('')
    }
  }

  async function saveServicio() {
    if (!user || submitting) return

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
    if (!distStats.catalogReady) {
      setFormError('Crea al menos un concepto de partición estandarizado antes de guardar.')
      return
    }
    if (distStats.hasDupes) {
      setFormError('No puedes repetir el mismo concepto en la distribución.')
      return
    }
    if (!distStats.rows.every((row) => row.conceptoOk && row.pct > 0)) {
      setFormError('Cada ítem debe usar un concepto de la lista estandarizada y un % mayor a 0.')
      return
    }
    if (modalMode === 'editar' && !editing) {
      setFormError('No se encontró el servicio a editar. Vuelve a abrir el modal.')
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
      } else {
        setFormError('No se pudo determinar el servicio a guardar.')
        return
      }
      // Solo cerrar tras guardar con éxito (el listado ya se actualizó arriba).
      setModalOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el servicio')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    await saveServicio()
  }

  /**
   * Enter en un input dispara submit del form y, si los datos ya son válidos,
   * guardaba y cerraba el modal “solo”. Bloqueamos Enter; solo guarda el botón.
   */
  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter') return
    const target = event.target as HTMLElement | null
    if (target?.tagName === 'TEXTAREA') return
    event.preventDefault()
    event.stopPropagation()
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
    if (!plantillaStats.catalogReady) {
      setDistFormError('Crea al menos un concepto de partición estandarizado antes de guardar.')
      return
    }
    if (plantillaStats.hasDupes) {
      setDistFormError('No puedes repetir el mismo concepto en la distribución.')
      return
    }
    if (!plantillaStats.rows.every((row) => row.conceptoOk && row.pct > 0)) {
      setDistFormError('Cada ítem debe usar un concepto de la lista estandarizada y un % mayor a 0.')
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
            Define servicios con costo en dinero. Estandariza los conceptos de partición, crea
            distribuciones reutilizables en % y asígnalas a varios servicios. Al crear un servicio se
            genera una referencia de 4 dígitos única.
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
              <button type="button" className="btn-secondary" onClick={openConceptosModal}>
                <Tags size={16} strokeWidth={2} aria-hidden />
                Conceptos de partición
              </button>
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
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            // Solo cerrar si el clic fue en el fondo, no al soltar desde dentro del panel.
            if (event.target === event.currentTarget && !submitting) closeModal()
          }}
        >
          <div
            className="modal-panel av-servicio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-servicio-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
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

            <form
              className="modal-form"
              onSubmit={(event) => void handleSubmit(event)}
              onKeyDown={handleFormKeyDown}
              noValidate
            >
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
                  conceptos={conceptos}
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
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !distSubmitting) closeDistModal()
          }}
        >
          <div
            className="modal-panel av-servicio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-dist-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
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
              onSubmit={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void handleDistSubmit(event)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                const target = event.target as HTMLElement | null
                if (target?.tagName === 'TEXTAREA') return
                event.preventDefault()
                event.stopPropagation()
              }}
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
                  conceptos={conceptos}
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
                  disabled={
                    distSubmitting ||
                    !plantillaStats.canSave ||
                    !plantillaNombre.trim()
                  }
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

      {conceptosModalOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !conceptoSubmitting) closeConceptosModal()
          }}
        >
          <div
            className="modal-panel av-servicio-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-conceptos-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-conceptos-modal-title">Conceptos de partición</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeConceptosModal}
                disabled={conceptoSubmitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="modal-form">
              <p className="section-note">
                Estos nombres son los únicos que puedes elegir al armar la partición de ganancias de
                un servicio o de una distribución guardada.
              </p>

              <form
                className="av-concepto-form"
                onSubmit={(event) => {
                  void handleConceptoSubmit(event)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <label className="login-field" htmlFor="av-concepto-nombre">
                  {editingConcepto ? 'Editar concepto' : 'Nuevo concepto'}
                  <input
                    id="av-concepto-nombre"
                    type="text"
                    value={conceptoNombre}
                    onChange={(event) => setConceptoNombre(event.target.value)}
                    disabled={conceptoSubmitting}
                    required
                    autoFocus
                    placeholder="Ej. Producción, Comisión, Postproducción…"
                    maxLength={120}
                  />
                </label>
                <div className="av-concepto-form-actions">
                  {editingConcepto ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={cancelEditConcepto}
                      disabled={conceptoSubmitting}
                    >
                      Cancelar edición
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={conceptoSubmitting || !conceptoNombre.trim()}
                  >
                    {conceptoSubmitting ? (
                      <>
                        <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                        Guardando...
                      </>
                    ) : editingConcepto ? (
                      'Guardar cambios'
                    ) : (
                      'Agregar concepto'
                    )}
                  </button>
                </div>
              </form>

              {conceptoFormError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {conceptoFormError}
                </p>
              ) : null}

              {conceptos.length === 0 ? (
                <p className="section-note">Aún no hay conceptos. Agrega el primero arriba.</p>
              ) : (
                <ul className="av-concepto-list" aria-label="Conceptos estandarizados">
                  {conceptos.map((concepto) => (
                    <li key={concepto.id} className="av-concepto-list-item">
                      <strong>{concepto.nombre || 'Sin nombre'}</strong>
                      <div className="av-concepto-list-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => startEditConcepto(concepto)}
                          disabled={conceptoSubmitting || deletingConceptoId === concepto.id}
                          aria-label={`Editar ${concepto.nombre || 'concepto'}`}
                        >
                          <Pencil size={14} strokeWidth={2} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            void handleDeleteConcepto(concepto)
                          }}
                          disabled={conceptoSubmitting || deletingConceptoId === concepto.id}
                          aria-label={`Eliminar ${concepto.nombre || 'concepto'}`}
                        >
                          {deletingConceptoId === concepto.id ? (
                            <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                          ) : (
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                          )}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={closeConceptosModal}
                  disabled={conceptoSubmitting}
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
