import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { API_URL } from '../config'
import { formatCop } from '../api/administradores'
import {
  createContableApiKey,
  deleteContableApiKey,
  listContableAnios,
  listContableApiKeys,
  listContableMovimientos,
  setContableApiKeyActiva,
  type ContableApiKey,
  type ContableMovimiento,
  type ContableResumenAnual,
  type ContableTipo,
} from '../api/contable'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Check,
  Copy,
  FileText,
  Key,
  LoaderCircle,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
} from '../icons'

const POLL_MS = 8000

type ContableVista = 'movimientos' | 'claves' | 'docs'

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="contable-docs-block">
      <pre>
        <code>{code}</code>
      </pre>
      <button type="button" className="btn-secondary" onClick={() => void copy()}>
        {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={2} />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

function ContableApiDocs() {
  const ingresoExample = `curl -X POST "${API_URL}/api/contable/ingresos" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: nfx_TU_CLAVE" \\
  -d '{"fecha":"2026-08-14","nombre":"Juan Pérez","concepto":"recarga","valor":100000}'`

  const egresoExample = `curl -X POST "${API_URL}/api/contable/egresos" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: nfx_TU_CLAVE" \\
  -d '{"fecha":"2026-08-14","nombre":"Proveedor","concepto":"arriendo","valor":250000,"categoria":"gastos","metodoPago":"transferencia"}'`

  return (
    <section className="usuarios-section contable-docs" aria-label="Documentación de la API">
      <div className="section-heading">
        <FileText size={18} strokeWidth={2} aria-hidden />
        <h2>Documentación de la API</h2>
      </div>
      <p className="section-note">
        Base: <code>{API_URL}</code>. Autentica cada escritura con la API key del programa.
      </p>

      <article className="contable-docs-card">
        <h3>Autenticación</h3>
        <p>
          Crea una clave en la pestaña <strong>API keys</strong> con el nombre del programa. Envíala
          en cada petición:
        </p>
        <CopyBlock code={'X-Api-Key: nfx_TU_CLAVE'} />
        <p>También se acepta <code>Authorization: Bearer nfx_TU_CLAVE</code>.</p>
        <p>
          El movimiento queda con <code>programa</code>, <code>programaId</code> y{' '}
          <code>origen: "api-key"</code>.
        </p>
      </article>

      <article className="contable-docs-card">
        <h3>Registrar ingreso</h3>
        <p>
          <code>POST /api/contable/ingresos</code>
          {' · '}
          alias <code>POST /api/contable/entradas</code>
        </p>
        <CopyBlock code={ingresoExample} />
      </article>

      <article className="contable-docs-card">
        <h3>Registrar egreso</h3>
        <p>
          <code>POST /api/contable/egresos</code>
        </p>
        <CopyBlock code={egresoExample} />
      </article>

      <article className="contable-docs-card">
        <h3>Campos</h3>
        <div className="pagos-table-wrap">
          <table className="pagos-table">
            <thead>
              <tr>
                <th>Campo</th>
                <th>Obligatorio</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>fecha</code>
                </td>
                <td>Sí</td>
                <td>YYYY-MM-DD o ISO. Define el año del movimiento.</td>
              </tr>
              <tr>
                <td>
                  <code>nombre</code>
                </td>
                <td>Sí</td>
                <td>Nombre del cliente o tercero. También acepta <code>clienteNombre</code>.</td>
              </tr>
              <tr>
                <td>
                  <code>concepto</code>
                </td>
                <td>Sí</td>
                <td>Descripción del movimiento.</td>
              </tr>
              <tr>
                <td>
                  <code>valor</code>
                </td>
                <td>Sí</td>
                <td>Número mayor a 0, en COP. Ejemplo: 100000.</td>
              </tr>
              <tr>
                <td>
                  <code>categoria</code>
                </td>
                <td>No</td>
                <td>Membresías, recargas, arriendo, etc.</td>
              </tr>
              <tr>
                <td>
                  <code>clienteId</code>
                </td>
                <td>No</td>
                <td>Identificador interno del cliente.</td>
              </tr>
              <tr>
                <td>
                  <code>metodoPago</code>
                </td>
                <td>No</td>
                <td>efectivo, transferencia, wompi, etc.</td>
              </tr>
              <tr>
                <td>
                  <code>referencia</code>
                </td>
                <td>No</td>
                <td>Recibo, transacción o factura.</td>
              </tr>
              <tr>
                <td>
                  <code>estado</code>
                </td>
                <td>No</td>
                <td>Por defecto <code>confirmado</code>.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="contable-docs-card">
        <h3>Dónde se guarda</h3>
        <p>
          Firestore Nodefex:{' '}
          <code>proyectos/nodefex-contable/contabilidad/{'{tipo}'}/años/{'{año}'}/movimientos/{'{id}'}</code>
        </p>
      </article>
    </section>
  )
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function ContablePanel() {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()
  const [vista, setVista] = useState<ContableVista>('movimientos')
  const [tipo, setTipo] = useState<ContableTipo>('ingresos')
  const [anio, setAnio] = useState(currentYear)
  const [anios, setAnios] = useState<number[]>([currentYear])
  const [resumen, setResumen] = useState<ContableResumenAnual | null>(null)
  const [movimientos, setMovimientos] = useState<ContableMovimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const [apiKeys, setApiKeys] = useState<ContableApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [keysError, setKeysError] = useState('')
  const [programaNombre, setProgramaNombre] = useState('')
  const [keySubmitting, setKeySubmitting] = useState(false)
  const [createdKey, setCreatedKey] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadAnios() {
      if (!user) return
      try {
        const token = await user.getIdToken()
        const data = await listContableAnios(token, tipo)
        if (cancelled) return
        const years = Array.from(
          new Set([currentYear, ...data.map((item) => item.año)]),
        ).sort((a, b) => b - a)
        setAnios(years)
      } catch {
        if (!cancelled) {
          setAnios((current) =>
            current.includes(currentYear) ? current : [currentYear, ...current],
          )
        }
      }
    }

    void loadAnios()
    return () => {
      cancelled = true
    }
  }, [user, tipo, currentYear])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined

    async function loadMovimientos(silent = false) {
      if (!user || vista !== 'movimientos') return
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const token = await user.getIdToken()
        const data = await listContableMovimientos(token, tipo, anio)
        if (cancelled) return
        setResumen(data.resumenAnual)
        setMovimientos(data.movimientos)
        setUpdatedAt(new Date())
      } catch (err) {
        if (!cancelled && !silent) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los registros')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadMovimientos(false)
    timer = setInterval(() => {
      void loadMovimientos(true)
    }, POLL_MS)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [user, tipo, anio, vista])

  async function loadKeys() {
    if (!user) return
    setKeysLoading(true)
    setKeysError('')
    try {
      const token = await user.getIdToken()
      const data = await listContableApiKeys(token)
      setApiKeys(data)
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : 'No se pudieron cargar las API keys')
    } finally {
      setKeysLoading(false)
    }
  }

  useEffect(() => {
    void loadKeys()
  }, [user])

  async function handleCreateKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setKeySubmitting(true)
    setKeysError('')
    setCopied(false)
    try {
      const token = await user.getIdToken()
      const created = await createContableApiKey(token, programaNombre.trim())
      setApiKeys((current) => [...current, created].sort((a, b) =>
        String(a.programa).localeCompare(String(b.programa)),
      ))
      setCreatedKey(created.key || '')
      setProgramaNombre('')
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : 'No se pudo crear la API key')
    } finally {
      setKeySubmitting(false)
    }
  }

  async function handleToggleKey(item: ContableApiKey) {
    if (!user) return
    try {
      const token = await user.getIdToken()
      const updated = await setContableApiKeyActiva(token, item.id, !item.activa)
      setApiKeys((current) => current.map((key) => (key.id === item.id ? updated : key)))
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : 'No se pudo actualizar la API key')
    }
  }

  async function handleDeleteKey(item: ContableApiKey) {
    if (!user) return
    const ok = window.confirm(`¿Eliminar la API key de ${item.programa}?`)
    if (!ok) return
    try {
      const token = await user.getIdToken()
      await deleteContableApiKey(token, item.id)
      setApiKeys((current) => current.filter((key) => key.id !== item.id))
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : 'No se pudo eliminar la API key')
    }
  }

  async function copyCreatedKey() {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return movimientos
    return movimientos.filter((item) =>
      [
        item.clienteNombre,
        item.concepto,
        item.categoria,
        item.referencia,
        item.metodoPago,
        item.programa,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    )
  }, [movimientos, query])

  const total = resumen?.total ?? 0

  return (
    <>
      <div className="contable-tabs contable-page-tabs" role="tablist" aria-label="Secciones contables">
        <button
          type="button"
          className={vista === 'movimientos' ? 'is-active' : ''}
          onClick={() => setVista('movimientos')}
        >
          <Receipt size={16} strokeWidth={2} aria-hidden />
          Movimientos
        </button>
        <button
          type="button"
          className={vista === 'claves' ? 'is-active' : ''}
          onClick={() => setVista('claves')}
        >
          <Key size={16} strokeWidth={2} aria-hidden />
          API keys
        </button>
        <button
          type="button"
          className={vista === 'docs' ? 'is-active' : ''}
          onClick={() => setVista('docs')}
        >
          <FileText size={16} strokeWidth={2} aria-hidden />
          Documentación
        </button>
      </div>

      {vista === 'claves' ? (
      <section className="usuarios-section" aria-label="API keys contables">
        <div className="section-heading">
          <Key size={18} strokeWidth={2} aria-hidden />
          <h2>API keys por programa</h2>
        </div>
        <p className="section-note">
          Cada programa usa su clave en <code>X-Api-Key</code> al llamar{' '}
          <code>POST /api/contable/ingresos</code> o <code>/egresos</code>. El movimiento queda
          etiquetado con ese programa.
        </p>

        <form className="contable-key-form" onSubmit={(event) => void handleCreateKey(event)}>
          <label className="login-field" htmlFor="programa-nombre">
            Programa
            <input
              id="programa-nombre"
              value={programaNombre}
              onChange={(event) => setProgramaNombre(event.target.value)}
              placeholder="Velix, Sistecontact, caja..."
              required
              disabled={keySubmitting}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={keySubmitting}>
            {keySubmitting ? (
              <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
            ) : (
              <Plus size={16} strokeWidth={2} aria-hidden />
            )}
            Crear clave
          </button>
        </form>

        {createdKey ? (
          <div className="contable-key-secret" role="status">
            <p>Guarda esta clave ahora. No se volverá a mostrar.</p>
            <code>{createdKey}</code>
            <button type="button" className="btn-secondary" onClick={() => void copyCreatedKey()}>
              {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={2} />}
              {copied ? 'Copiada' : 'Copiar'}
            </button>
          </div>
        ) : null}

        {keysError ? (
          <div className="proyectos-status proyectos-status-error" role="alert">
            <AlertCircle size={18} strokeWidth={2} aria-hidden />
            {keysError}
          </div>
        ) : null}

        {keysLoading ? (
          <div className="proyectos-status">
            <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
            Cargando API keys...
          </div>
        ) : apiKeys.length === 0 ? (
          <p className="section-note">Aún no hay programas con clave.</p>
        ) : (
          <div className="pagos-table-wrap">
            <table className="pagos-table">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Clave</th>
                  <th>Usos</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((item) => (
                  <tr key={item.id}>
                    <td>{item.programa}</td>
                    <td className="pagos-ref">{item.prefix}…</td>
                    <td>{item.usos}</td>
                    <td>
                      <label className={`access-switch ${item.activa ? 'is-on' : 'is-off'}`}>
                        <input
                          type="checkbox"
                          checked={item.activa}
                          onChange={() => void handleToggleKey(item)}
                        />
                        <span className="access-switch-track" aria-hidden>
                          <span className="access-switch-thumb" />
                        </span>
                        <span className="access-switch-label">
                          {item.activa ? 'Activa' : 'Apagada'}
                        </span>
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="proyecto-delete"
                        onClick={() => void handleDeleteKey(item)}
                        aria-label={`Eliminar API key de ${item.programa}`}
                      >
                        <Trash2 size={16} strokeWidth={2} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      {vista === 'movimientos' ? (
      <section className="usuarios-section" aria-label="Registros contables">
        <div className="section-heading">
          <Receipt size={18} strokeWidth={2} aria-hidden />
          <h2>Movimientos</h2>
        </div>
        <p className="section-note">
          Cada registro muestra el programa que lo ingresó. La lista se actualiza sola.
        </p>

        <div className="contable-toolbar">
          <div className="contable-tabs">
            <button
              type="button"
              className={tipo === 'ingresos' ? 'is-active' : ''}
              onClick={() => setTipo('ingresos')}
            >
              Ingresos
            </button>
            <button
              type="button"
              className={tipo === 'egresos' ? 'is-active' : ''}
              onClick={() => setTipo('egresos')}
            >
              Egresos
            </button>
          </div>

          <label className="login-field contable-year" htmlFor="contable-anio">
            Año
            <select
              id="contable-anio"
              value={anio}
              onChange={(event) => setAnio(Number(event.target.value))}
            >
              {anios.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="login-field pagos-search" htmlFor="contable-q">
            Buscar
            <span className="login-input-wrap">
              <Search className="login-input-icon" size={16} strokeWidth={1.75} aria-hidden />
              <input
                id="contable-q"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Programa, nombre o concepto"
              />
            </span>
          </label>
        </div>

        <div className="contable-summary">
          <div>
            <span>Total {tipo}</span>
            <strong>{formatCop(total)}</strong>
          </div>
          <div>
            <span>Movimientos</span>
            <strong>{resumen?.cantidadMovimientos ?? movimientos.length}</strong>
          </div>
          <div>
            <span>Última lectura</span>
            <strong>
              {updatedAt
                ? updatedAt.toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '—'}
            </strong>
          </div>
        </div>

        {loading ? (
          <div className="proyectos-status">
            <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
            Cargando registros...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="proyectos-status proyectos-status-error" role="alert">
            <AlertCircle size={18} strokeWidth={2} aria-hidden />
            {error}
          </div>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <div className="proyectos-empty">
            <Receipt size={28} strokeWidth={1.75} aria-hidden />
            <p>
              Aún no hay {tipo} registrados en {anio}.
            </p>
          </div>
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="pagos-table-wrap">
            <table className="pagos-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Programa</th>
                  <th>Nombre</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Valor</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>{formatFecha(item.fecha)}</td>
                    <td>{item.programa || '—'}</td>
                    <td>{item.clienteNombre || '—'}</td>
                    <td>{item.concepto || '—'}</td>
                    <td>{item.categoria || '—'}</td>
                    <td>{item.valor != null ? formatCop(item.valor) : '—'}</td>
                    <td>
                      <span
                        className={`pago-status ${item.estado === 'confirmado' ? 'is-approved' : 'is-pending'}`}
                      >
                        {item.estado || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="pagos-filter-meta">
          <RefreshCw size={14} strokeWidth={2} aria-hidden />
          Mostrando {filtered.length} de {movimientos.length} registros
        </p>
      </section>
      ) : null}

      {vista === 'docs' ? <ContableApiDocs /> : null}
    </>
  )
}
