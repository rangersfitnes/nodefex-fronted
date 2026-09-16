import { useEffect, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvPlan,
  listAvPlanes,
  updateAvPlan,
  type AvPlan,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  X,
} from '../icons'

type ModalMode = 'crear' | 'editar'

export function AvPlanesPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [planes, setPlanes] = useState<AvPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [togglingId, setTogglingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('crear')
  const [editing, setEditing] = useState<AvPlan | null>(null)
  const [nombre, setNombre] = useState('')
  const [creditos, setCreditos] = useState('')
  const [precio, setPrecio] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [activo, setActivo] = useState(true)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listAvPlanes(token)
        if (!cancelled) setPlanes(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los planes')
          setPlanes([])
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
    setCreditos('')
    setPrecio('')
    setDescripcion('')
    setActivo(true)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(plan: AvPlan) {
    setModalMode('editar')
    setEditing(plan)
    setNombre(plan.nombre || '')
    setCreditos(String(plan.creditos || ''))
    setPrecio(String(plan.precio || ''))
    setDescripcion(plan.descripcion || '')
    setActivo(plan.activo)
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setFormError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const nombreValue = nombre.trim()
    const creditosValue = Number(String(creditos).trim())
    const precioValue = Number(String(precio).replace(/,/g, '').trim())
    const descripcionValue = descripcion.trim()

    if (!nombreValue) {
      setFormError('El nombre es obligatorio.')
      return
    }
    if (!Number.isInteger(creditosValue) || creditosValue <= 0) {
      setFormError('Los créditos deben ser un entero mayor a 0.')
      return
    }
    if (!Number.isFinite(precioValue) || precioValue <= 0) {
      setFormError('El precio debe ser un número mayor a 0.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      if (modalMode === 'crear') {
        await createAvPlan(token, {
          nombre: nombreValue,
          creditos: creditosValue,
          precio: precioValue,
          descripcion: descripcionValue || undefined,
          activo,
        })
      } else if (editing) {
        await updateAvPlan(token, editing.id, {
          nombre: nombreValue,
          creditos: creditosValue,
          precio: precioValue,
          descripcion: descripcionValue || null,
          activo,
        })
      }
      setModalOpen(false)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el plan')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(plan: AvPlan) {
    if (!user) return
    setTogglingId(plan.id)
    setError('')
    try {
      const token = await user.getIdToken()
      const updated = await updateAvPlan(token, plan.id, { activo: !plan.activo })
      setPlanes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del plan')
    } finally {
      setTogglingId('')
    }
  }

  return (
    <div className="av-planes" role="tabpanel" aria-label="Planes">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Planes de créditos</h3>
          <p className="section-note">
            Catálogo global de planes disponibles para Finanzas → Ingresos.
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
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nuevo plan
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando planes...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && planes.length === 0 ? (
        <div className="proyectos-empty">
          <Layers size={28} strokeWidth={1.75} aria-hidden />
          <p>No hay planes configurados. Crea el primero para empezar.</p>
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} strokeWidth={2} aria-hidden />
            Nuevo plan
          </button>
        </div>
      ) : null}

      {!loading && !error && planes.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Créditos</th>
                <th>Precio</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {planes.map((plan) => (
                <tr key={plan.id}>
                  <td>{plan.nombre || '—'}</td>
                  <td>{plan.creditos}</td>
                  <td>{formatCop(plan.precio)}</td>
                  <td>{plan.descripcion || '—'}</td>
                  <td>
                    <span className={`av-estado ${plan.activo ? 'av-estado-pagado' : 'av-estado-vencido'}`}>
                      {plan.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    {!readOnly ? (
                      <div className="av-ingresos-row-actions">
                        <button type="button" className="btn-secondary" onClick={() => openEdit(plan)}>
                          <Pencil size={14} strokeWidth={2} aria-hidden />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={togglingId === plan.id}
                          onClick={() => void handleToggle(plan)}
                        >
                          {togglingId === plan.id ? (
                            <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                          ) : null}
                          {plan.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-plan-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-plan-modal-title">
                {modalMode === 'crear' ? 'Nuevo plan' : 'Editar plan'}
              </h2>
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

            <form className="modal-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
              <label className="login-field" htmlFor="av-plan-nombre">
                Nombre
                <input
                  id="av-plan-nombre"
                  type="text"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Plan 5"
                  required
                  disabled={submitting}
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="av-plan-creditos">
                Créditos
                <input
                  id="av-plan-creditos"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={creditos}
                  onChange={(event) => setCreditos(event.target.value)}
                  placeholder="5"
                  required
                  disabled={submitting}
                />
              </label>

              <label className="login-field" htmlFor="av-plan-precio">
                Precio (COP)
                <input
                  id="av-plan-precio"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={precio}
                  onChange={(event) => setPrecio(event.target.value)}
                  placeholder="1671000"
                  required
                  disabled={submitting}
                />
              </label>

              <label className="login-field" htmlFor="av-plan-descripcion">
                Descripción
                <textarea
                  id="av-plan-descripcion"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  rows={3}
                  placeholder="Detalle del paquete de créditos"
                  disabled={submitting}
                />
              </label>

              <label className="av-plan-activo" htmlFor="av-plan-activo">
                <input
                  id="av-plan-activo"
                  type="checkbox"
                  checked={activo}
                  onChange={(event) => setActivo(event.target.checked)}
                  disabled={submitting}
                />
                Plan activo (visible en Finanzas → Ingresos)
              </label>

              {formError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {formError}
                </p>
              ) : null}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : modalMode === 'crear' ? (
                    'Crear plan'
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
