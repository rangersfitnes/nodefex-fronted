import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatCop } from '../api/administradores'
import {
  createAvCotizacion,
  deleteAvCotizacion,
  getAvEmpresaGenio,
  listAvCotizaciones,
  type AvCotizacion,
  type AvCotizacionItem,
  type AvEmpresaGenio,
} from '../api/audiovisual'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from '../icons'
import { downloadAvCotizacionPdf } from './avCotizacionPdf'

type DraftItem = { id: string; concepto: string; valor: string }

function newDraftItem(): DraftItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    concepto: '',
    valor: '',
  }
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
  }).format(new Date(iso))
}

export function AvCotizacionesPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { user } = useAuth()
  const [cotizaciones, setCotizaciones] = useState<AvCotizacion[]>([])
  const [empresa, setEmpresa] = useState<AvEmpresaGenio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [deletingId, setDeletingId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteDocumento, setClienteDocumento] = useState('')
  const [clienteCorreo, setClienteCorreo] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()])
  const [itemConcepto, setItemConcepto] = useState('')
  const [itemValor, setItemValor] = useState('')
  const [resumen, setResumen] = useState('')
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
        const [list, empresaData] = await Promise.all([
          listAvCotizaciones(token),
          getAvEmpresaGenio(token),
        ])
        if (cancelled) return
        setCotizaciones(list)
        setEmpresa(empresaData)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las cotizaciones')
          setCotizaciones([])
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

  const draftSubtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const valor = Number(String(item.valor).replace(/,/g, '').trim())
      return sum + (Number.isFinite(valor) && valor > 0 ? valor : 0)
    }, 0)
  }, [items])

  function openCreate() {
    setClienteNombre('')
    setClienteDocumento('')
    setClienteCorreo('')
    setClienteTelefono('')
    setItems([])
    setItemConcepto('')
    setItemValor('')
    setResumen('')
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setFormError('')
  }

  function addItem() {
    const concepto = itemConcepto.trim()
    const valor = Number(String(itemValor).replace(/,/g, '').trim())
    if (!concepto) {
      setFormError('Escribe el concepto del ítem.')
      return
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      setFormError('El valor del ítem debe ser mayor a 0.')
      return
    }
    setItems((current) => [...current, { id: newDraftItem().id, concepto, valor: String(valor) }])
    setItemConcepto('')
    setItemValor('')
    setFormError('')
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user || submitting) return

    const nombre = clienteNombre.trim()
    const resumenValue = resumen.trim()
    const payloadItems: AvCotizacionItem[] = items
      .map((item) => ({
        concepto: item.concepto.trim(),
        valor: Number(String(item.valor).replace(/,/g, '').trim()),
      }))
      .filter((item) => item.concepto && Number.isFinite(item.valor) && item.valor > 0)

    if (!nombre) {
      setFormError('El nombre del cliente es obligatorio.')
      return
    }
    if (!payloadItems.length) {
      setFormError('Agrega al menos un concepto con valor al subtotal.')
      return
    }
    if (!resumenValue) {
      setFormError('El resumen es obligatorio.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await user.getIdToken()
      const created = await createAvCotizacion(token, {
        clienteNombre: nombre,
        clienteDocumento: clienteDocumento.trim() || undefined,
        clienteCorreo: clienteCorreo.trim() || undefined,
        clienteTelefono: clienteTelefono.trim() || undefined,
        items: payloadItems,
        resumen: resumenValue,
      })
      setCotizaciones((current) => [created, ...current])
      setModalOpen(false)
      void downloadAvCotizacionPdf(created, empresa)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la cotización')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(cotizacion: AvCotizacion) {
    if (!user || readOnly || deletingId) return
    const ok = window.confirm(
      `¿Eliminar la cotización ${cotizacion.numero || ''} de «${cotizacion.clienteNombre || 'cliente'}»?`,
    )
    if (!ok) return
    setDeletingId(cotizacion.id)
    try {
      const token = await user.getIdToken()
      await deleteAvCotizacion(token, cotizacion.id)
      setCotizaciones((current) => current.filter((item) => item.id !== cotizacion.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="av-cotizaciones" role="tabpanel" aria-label="Cotizaciones">
      <div className="av-ingresos-toolbar">
        <div>
          <h3>Cotizaciones</h3>
          <p className="section-note">
            Crea cotizaciones con ítems y subtotal. Al guardar se descarga el PDF con los datos de
            empresa del Genio.
          </p>
        </div>
        <div className="av-ingresos-toolbar-actions">
          <button
            type="button"
            className="btn-secondary contable-refresh"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} strokeWidth={2} aria-hidden className={loading ? 'spin' : undefined} />
            Actualizar
          </button>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nueva cotización
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando cotizaciones...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          {error}
        </div>
      ) : null}

      {!loading && !error && cotizaciones.length === 0 ? (
        <div className="proyectos-empty">
          <FileText size={28} strokeWidth={1.75} aria-hidden />
          <p>Aún no hay cotizaciones. Configura los datos de empresa arriba y crea la primera.</p>
          {!readOnly ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} strokeWidth={2} aria-hidden />
              Nueva cotización
            </button>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && cotizaciones.length > 0 ? (
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Ítems</th>
                <th>Subtotal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map((cotizacion) => (
                <tr key={cotizacion.id}>
                  <td>
                    <span className="av-credito-ref">{cotizacion.numero || '—'}</span>
                  </td>
                  <td>{cotizacion.clienteNombre || '—'}</td>
                  <td>{formatFecha(cotizacion.creadoEn)}</td>
                  <td>{cotizacion.items.length}</td>
                  <td>{formatCop(cotizacion.subtotal)}</td>
                  <td>
                    <div className="av-ingresos-row-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void downloadAvCotizacionPdf(cotizacion, empresa)}
                      >
                        <Download size={14} strokeWidth={2} aria-hidden />
                        PDF
                      </button>
                      {!readOnly ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={deletingId === cotizacion.id}
                          onClick={() => void handleDelete(cotizacion)}
                        >
                          {deletingId === cotizacion.id ? (
                            <LoaderCircle className="spin" size={14} strokeWidth={2} aria-hidden />
                          ) : (
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                          )}
                          Eliminar
                        </button>
                      ) : null}
                    </div>
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
            className="modal-panel av-cotizacion-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-cotizacion-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="av-cotizacion-modal-title">Nueva cotización</h2>
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
              <div className="av-ingresos-form-grid">
                <label className="login-field av-ingresos-span-2" htmlFor="av-cot-cliente">
                  Nombre del cliente
                  <input
                    id="av-cot-cliente"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    disabled={submitting}
                    required
                    autoFocus
                  />
                </label>
                <label className="login-field" htmlFor="av-cot-doc">
                  Documento / NIT cliente
                  <input
                    id="av-cot-doc"
                    value={clienteDocumento}
                    onChange={(e) => setClienteDocumento(e.target.value)}
                    disabled={submitting}
                  />
                </label>
                <label className="login-field" htmlFor="av-cot-tel">
                  Teléfono cliente
                  <input
                    id="av-cot-tel"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    disabled={submitting}
                  />
                </label>
                <label className="login-field av-ingresos-span-2" htmlFor="av-cot-mail">
                  Correo cliente
                  <input
                    id="av-cot-mail"
                    type="email"
                    value={clienteCorreo}
                    onChange={(e) => setClienteCorreo(e.target.value)}
                    disabled={submitting}
                  />
                </label>
              </div>

              <section className="av-cotizacion-items">
                <h3>Ítems de la cotización</h3>
                <p className="section-note">Agrega concepto y valor; se acumulan en el subtotal.</p>

                {items.length > 0 ? (
                  <ul className="av-cotizacion-items-list">
                    {items.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.concepto}</strong>
                          <span>{formatCop(Number(item.valor) || 0)}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => removeItem(item.id)}
                          disabled={submitting}
                        >
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="section-note">Todavía no hay ítems.</p>
                )}

                <div className="av-cotizacion-add-row">
                  <label className="login-field" htmlFor="av-cot-concepto">
                    Concepto
                    <input
                      id="av-cot-concepto"
                      value={itemConcepto}
                      onChange={(e) => setItemConcepto(e.target.value)}
                      disabled={submitting}
                      placeholder="Ej. Producción de video"
                    />
                  </label>
                  <label className="login-field" htmlFor="av-cot-valor">
                    Valor
                    <input
                      id="av-cot-valor"
                      type="number"
                      min={1}
                      step={1}
                      value={itemValor}
                      onChange={(e) => setItemValor(e.target.value)}
                      disabled={submitting}
                      placeholder="0"
                    />
                  </label>
                  <button type="button" className="btn-secondary" onClick={addItem} disabled={submitting}>
                    <Plus size={16} strokeWidth={2} aria-hidden />
                    Agregar al subtotal
                  </button>
                </div>

                <div className="av-cotizacion-subtotal">
                  <span>Subtotal</span>
                  <strong>{formatCop(draftSubtotal)}</strong>
                </div>
              </section>

              <label className="login-field" htmlFor="av-cot-resumen">
                Resumen
                <textarea
                  id="av-cot-resumen"
                  value={resumen}
                  onChange={(e) => setResumen(e.target.value)}
                  rows={4}
                  disabled={submitting}
                  required
                  placeholder="Condiciones, alcance, vigencia, notas finales…"
                />
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
                  ) : (
                    <>
                      <Download size={16} strokeWidth={2} aria-hidden />
                      Guardar y descargar PDF
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
