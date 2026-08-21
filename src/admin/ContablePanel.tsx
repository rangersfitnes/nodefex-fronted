import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { API_URL } from '../config'
import { formatCop } from '../api/administradores'
import {
  createContableApiKey,
  deleteContableApiKey,
  deleteContableMovimiento,
  deleteContableMovimientos,
  listContableAnios,
  listContableApiKeys,
  listContableMovimientos,
  setContableApiKeyActiva,
  type ContableApiKey,
  type ContableMovimiento,
  type ContableResumenAnual,
  type ContableResumenDiario,
  type ContableTipo,
} from '../api/contable'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Key,
  LoaderCircle,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
} from '../icons'

const PAGE_SIZE = 20

type ContableVista = 'movimientos' | 'claves' | 'docs'

function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function formatDiaLargo(ymd: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${ymd}T12:00:00-05:00`))
}

function buildContableIngresosApiTxt() {
  const base = API_URL.replace(/\/$/, '')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

  return `NODEFEX CONTABLE — INTEGRACIÓN PARA TU PROYECTO
============================================================
Documento para el equipo / sistema que enviará ingresos a Nodefex
usando una API key.

Fecha: ${today}
Destinatario: proyecto externo con API key (nfx_...)

OBJETIVO
--------
Cada vez que en TU proyecto ocurra un ingreso (pago, recarga,
membresía, venta, etc.), debes hacer un POST HTTP a Nodefex para
que el movimiento quede registrado en contabilidad.

Nodefex identifica tu proyecto por la API key. No uses login de
admin ni Firebase Auth para esta integración.


1) URL OBLIGATORIA (backend, no el sitio web)
--------------------------------------------
POST ${base}/api/contable/ingresos

NO uses:
- https://www.nodefex.com/...
- https://nodefex.com/...
- rutas relativas de tu propio dominio

Alias válido:
POST ${base}/api/contable/entradas


2) HEADERS OBLIGATORIOS
-----------------------
Content-Type: application/json
X-Api-Key: PEGA_AQUI_TU_API_KEY_COMPLETA

La API key:
- Empieza por nfx_
- Te la entrega el administrador de Nodefex Contable
- Guárdala solo en el backend / variables de entorno de TU proyecto
- Nunca la expongas en el frontend público ni en repositorios

También se acepta:
Authorization: Bearer PEGA_AQUI_TU_API_KEY_COMPLETA


3) CUÁNDO LLAMAR LA API
-----------------------
Llama el endpoint DESPUÉS de confirmar el cobro en tu sistema
(pago aprobado, recarga exitosa, membresía pagada, etc.).

Si el cobro falla o queda pendiente, NO envíes el ingreso.


4) BODY JSON — CAMPOS QUE DEBES ENVIAR
--------------------------------------
Mínimo obligatorio:

{
  "concepto": "texto descriptivo del ingreso",
  "valor": 100000
}

Recomendado (mejor trazabilidad):

{
  "fecha": "${today}",
  "nombre": "Nombre del cliente",
  "concepto": "recarga membresía 30 días",
  "valor": 100000,
  "categoria": "membresias",
  "metodoPago": "nequi",
  "referencia": "ID_DE_TU_TRANSACCION",
  "clienteId": "ID_INTERNO_DE_TU_USUARIO"
}

Reglas de tipos:
- concepto = string (texto). Obligatorio.
- valor = number en pesos COP, mayor a 0. Obligatorio.
  Correcto:   100000
  Incorrecto: "100.000"  "$100.000"  "100000 COP"
- fecha = "YYYY-MM-DD" o ISO. Si no la envías, Nodefex usa la hora actual (Bogotá).
- nombre = string con el cliente/tercero. Si no llega, Nodefex usa el nombre del programa de tu API key.

Alias aceptados (por si tu código ya usa otros nombres):
- concepto  → tambien: descripcion, detalle, motivo
- valor     → tambien: amount, monto, value, total, precio
- nombre    → tambien: clienteNombre, name, cliente, customer
- fecha     → tambien: date
- metodoPago → tambien: paymentMethod
- referencia → tambien: reference, recibo, factura
- clienteId  → tambien: customerId, userId


5) EJEMPLO LISTO PARA COPIAR (JavaScript / Node)
------------------------------------------------
const NODEFEX_API = "${base}";
const NODEFEX_API_KEY = process.env.NODEFEX_CONTABLE_API_KEY; // nfx_...

async function registrarIngresoEnNodefex({ concepto, valor, nombre, referencia, clienteId, metodoPago }) {
  const response = await fetch(\`\${NODEFEX_API}/api/contable/ingresos\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": NODEFEX_API_KEY,
    },
    body: JSON.stringify({
      fecha: new Date().toISOString().slice(0, 10),
      concepto,
      valor: Number(valor),
      nombre,
      referencia,
      clienteId,
      metodoPago,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || \`Nodefex respondió \${response.status}\`);
  }
  return data; // 201 Created
}

// Ejemplo de uso después de un pago aprobado en TU proyecto:
// await registrarIngresoEnNodefex({
//   concepto: "Membresía 30 días",
//   valor: 49900,
//   nombre: "correo@cliente.com",
//   referencia: "TX-ABC-123",
//   clienteId: "uid-del-usuario",
//   metodoPago: "wompi",
// });


6) EJEMPLO CURL (prueba manual)
-------------------------------
curl -X POST "${base}/api/contable/ingresos" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: PEGA_AQUI_TU_API_KEY" \\
  -d "{\\"fecha\\":\\"${today}\\",\\"nombre\\":\\"Cliente Demo\\",\\"concepto\\":\\"pago prueba\\",\\"valor\\":100000,\\"referencia\\":\\"TEST-001\\"}"


7) RESPUESTA ESPERADA
---------------------
HTTP 201

{
  "movimiento": {
    "id": "...",
    "concepto": "pago prueba",
    "valor": 100000,
    "clienteNombre": "Cliente Demo",
    "programa": "nombre de tu programa",
    "origen": "api-key"
  },
  "resumenAnual": { ... },
  "path": "proyectos/nodefex-contable/contabilidad/ingresos/años/AAAA/movimientos/ID"
}

Si recibes 201, el ingreso quedó registrado.


8) ERRORES QUE DEBES MANEJAR
----------------------------
401  API key inválida o desactivada
     → Revisa la clave completa (nfx_...) y que no tenga espacios.

400  El concepto es obligatorio
     → El body no es JSON, falta Content-Type: application/json,
       o no enviaste "concepto" como texto.

400  El valor debe ser un número mayor a 0
     → Envía valor numérico (100000), no string formateado.

404 o HTML del sitio Nodefex
     → Estás llamando nodefex.com / www.nodefex.com en vez de:
       ${base}/api/contable/ingresos

503  Sin cuota temporal de base de datos
     → Reintenta más tarde.


9) CHECKLIST ANTES DE SUBIR A PRODUCCIÓN
----------------------------------------
[ ] Usas exactamente: ${base}/api/contable/ingresos
[ ] Headers: Content-Type application/json + X-Api-Key
[ ] Body JSON con al menos concepto (string) y valor (number)
[ ] La llamada ocurre solo cuando el pago/cobro ya está confirmado
[ ] La API key está en variable de entorno del backend de TU proyecto
[ ] Probaste con curl o un pago de prueba y recibiste HTTP 201


10) EGRESOS (OPCIONAL)
----------------------
Si también debes registrar salidas de dinero:
POST ${base}/api/contable/egresos
Mismos headers y misma forma de body.
`
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

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

  function handleDownloadIngresosTxt() {
    downloadTextFile('nodefex-contable-api-ingresos.txt', buildContableIngresosApiTxt())
  }

  return (
    <section className="usuarios-section contable-docs" aria-label="Documentación de la API">
      <div className="section-heading">
        <FileText size={18} strokeWidth={2} aria-hidden />
        <h2>Documentación de la API</h2>
        <button type="button" className="btn-secondary" onClick={handleDownloadIngresosTxt}>
          <Download size={16} strokeWidth={2} aria-hidden />
          Descargar TXT para el proyecto
        </button>
      </div>
      <p className="section-note">
        Base: <code>{API_URL}</code>. El TXT está pensado para entregárselo al otro proyecto que
        usará la API key: incluye URL, headers, body, ejemplo de código y checklist.
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
        <h3>Eliminar movimiento</h3>
        <p>
          Desde el panel, o con sesión de administrador:{' '}
          <code>DELETE /api/contable/ingresos/2026/{'{id}'}</code>
        </p>
        <CopyBlock
          code={`curl -X DELETE "${API_URL}/api/contable/ingresos/2026/ID_MOVIMIENTO" \\
  -H "Authorization: Bearer TOKEN_ADMIN"`}
        />
        <p>Al borrar se resta el valor de los totales del año.</p>
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
                <td>No</td>
                <td>YYYY-MM-DD o ISO. Si no llega, se usa ahora (Bogotá). Si solo envías el día, se completa con la hora actual.</td>
              </tr>
              <tr>
                <td>
                  <code>nombre</code>
                </td>
                <td>No</td>
                <td>Nombre del cliente o tercero. También acepta <code>clienteNombre</code>. Si no llega, se usa el nombre del programa.</td>
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
  const today = todayBogota()
  const currentYear = Number(today.slice(0, 4))
  const [vista, setVista] = useState<ContableVista>('movimientos')
  const [tipo, setTipo] = useState<ContableTipo>('ingresos')
  const [dia, setDia] = useState(today)
  const anio = Number(dia.slice(0, 4))
  const [anios, setAnios] = useState<number[]>([currentYear])
  const [resumen, setResumen] = useState<ContableResumenAnual | null>(null)
  const [resumenDia, setResumenDia] = useState<ContableResumenDiario | null>(null)
  const [movimientos, setMovimientos] = useState<ContableMovimiento[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [deletingId, setDeletingId] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const [apiKeys, setApiKeys] = useState<ContableApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
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
  }, [user, tipo, currentYear, refreshTick])

  useEffect(() => {
    let cancelled = false

    async function loadMovimientos() {
      if (!user || vista !== 'movimientos') return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listContableMovimientos(token, tipo, anio, { dia })
        if (cancelled) return
        setResumen(data.resumenAnual)
        setResumenDia(data.resumenDia)
        setMovimientos(data.movimientos)
        setSelectedIds((current) => {
          const valid = new Set(data.movimientos.map((item) => item.id))
          return current.filter((id) => valid.has(id))
        })
        setUpdatedAt(new Date())
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los registros')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadMovimientos()
    return () => {
      cancelled = true
    }
  }, [user, tipo, anio, dia, vista, refreshTick])

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
    if (vista !== 'claves' || !user) return
    void loadKeys()
  }, [user, vista])

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

  async function handleDeleteMovimiento(item: ContableMovimiento) {
    if (!user) return
    const label = item.concepto || item.clienteNombre || item.id
    const ok = window.confirm(
      `¿Eliminar el movimiento "${label}"${item.valor != null ? ` de ${formatCop(item.valor)}` : ''}?`,
    )
    if (!ok) return
    setDeletingId(item.id)
    setError('')
    try {
      const token = await user.getIdToken()
      const nextResumen = await deleteContableMovimiento(token, tipo, anio, item.id)
      setMovimientos((current) => current.filter((mov) => mov.id !== item.id))
      setSelectedIds((current) => current.filter((id) => id !== item.id))
      setResumen(nextResumen)
      setResumenDia((current) =>
        current
          ? {
              ...current,
              total: Math.max(0, current.total - (Number(item.valor) || 0)),
              cantidad: Math.max(0, current.cantidad - 1),
            }
          : current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el movimiento')
    } finally {
      setDeletingId('')
    }
  }

  async function handleDeleteSelected() {
    if (!user || selectedIds.length === 0) return
    const items = movimientos.filter((item) => selectedIds.includes(item.id))
    if (!items.length) return
    const total = items.reduce((sum, item) => sum + (Number(item.valor) || 0), 0)
    const ok = window.confirm(
      `¿Eliminar ${items.length} movimiento(s) por ${formatCop(total)}? Esta acción no se puede deshacer.`,
    )
    if (!ok) return
    setDeletingBulk(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const nextResumen = await deleteContableMovimientos(
        token,
        tipo,
        anio,
        items.map((item) => item.id),
      )
      const removed = new Set(items.map((item) => item.id))
      setMovimientos((current) => current.filter((mov) => !removed.has(mov.id)))
      setSelectedIds([])
      setResumen(nextResumen)
      setResumenDia((current) =>
        current
          ? {
              ...current,
              total: Math.max(0, current.total - total),
              cantidad: Math.max(0, current.cantidad - items.length),
            }
          : current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron eliminar los movimientos')
    } finally {
      setDeletingBulk(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = !q
      ? movimientos
      : movimientos.filter((item) =>
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
    return [...list].sort((a, b) => {
      const aTime = Date.parse(a.creadoEn || a.fecha || '') || 0
      const bTime = Date.parse(b.creadoEn || b.fecha || '') || 0
      return bTime - aTime
    })
  }, [movimientos, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id))
  const selectedCount = selectedIds.length
  const totalDia = resumenDia?.total ?? filtered.reduce((sum, item) => sum + (Number(item.valor) || 0), 0)
  const totalAnio = resumen?.total ?? 0
  const isToday = dia === today

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function toggleSelectAll() {
    setSelectedIds(allFilteredSelected ? [] : filtered.map((item) => item.id))
  }

  function goToDia(next: string) {
    setDia(next)
    setPage(1)
    setSelectedIds([])
  }

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
        <div className="hero-actions" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              downloadTextFile(
                'nodefex-contable-api-ingresos.txt',
                buildContableIngresosApiTxt(),
              )
            }
          >
            <Download size={16} strokeWidth={2} aria-hidden />
            Descargar TXT para el proyecto (API ingresos)
          </button>
        </div>

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
          <button
            type="button"
            className="btn-secondary contable-refresh"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw className={loading ? 'spin' : undefined} size={16} strokeWidth={2} aria-hidden />
            Actualizar
          </button>
        </div>
        <p className="section-note">
          {formatDiaLargo(dia)}. Cada registro muestra el programa que lo ingresó.
        </p>

        <div className="contable-toolbar">
          <div className="contable-tabs">
            <button
              type="button"
              className={tipo === 'ingresos' ? 'is-active' : ''}
              onClick={() => {
                setTipo('ingresos')
                setPage(1)
                setSelectedIds([])
              }}
            >
              Ingresos
            </button>
            <button
              type="button"
              className={tipo === 'egresos' ? 'is-active' : ''}
              onClick={() => {
                setTipo('egresos')
                setPage(1)
                setSelectedIds([])
              }}
            >
              Egresos
            </button>
          </div>

          <div className="contable-day-nav">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => goToDia(shiftYmd(dia, -1))}
              aria-label="Día anterior"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            </button>
            <label className="login-field contable-day" htmlFor="contable-dia">
              Día
              <input
                id="contable-dia"
                type="date"
                value={dia}
                max={today}
                onChange={(event) => goToDia(event.target.value || today)}
              />
            </label>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => goToDia(shiftYmd(dia, 1))}
              disabled={dia >= today}
              aria-label="Día siguiente"
            >
              <ChevronRight size={16} strokeWidth={2} aria-hidden />
            </button>
            {!isToday ? (
              <button type="button" className="btn-secondary" onClick={() => goToDia(today)}>
                Hoy
              </button>
            ) : null}
          </div>

          <label className="login-field contable-year" htmlFor="contable-anio">
            Año
            <select
              id="contable-anio"
              value={anio}
              onChange={(event) => {
                const year = Number(event.target.value)
                goToDia(`${year}${dia.slice(4)}`)
              }}
            >
              {Array.from(new Set([...anios, anio]))
                .sort((a, b) => b - a)
                .map((year) => (
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
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Programa, nombre o concepto"
              />
            </span>
          </label>
        </div>

        <div className="contable-summary">
          <div>
            <span>Total del día</span>
            <strong>{formatCop(totalDia)}</strong>
          </div>
          <div>
            <span>{tipo === 'ingresos' ? 'Ingresos del día' : 'Egresos del día'}</span>
            <strong>{resumenDia?.cantidad ?? filtered.length}</strong>
          </div>
          <div>
            <span>Total {anio}</span>
            <strong>{formatCop(totalAnio)}</strong>
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
              No hay {tipo} el {formatDiaLargo(dia)}.
            </p>
          </div>
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="contable-bulk">
            <p className="contable-bulk-count">
              {selectedCount
                ? `${selectedCount} seleccionado${selectedCount === 1 ? '' : 's'}`
                : 'Selecciona movimientos para borrar'}
            </p>
            <button
              type="button"
              className="btn-danger"
              disabled={selectedCount === 0 || deletingBulk}
              onClick={() => void handleDeleteSelected()}
            >
              {deletingBulk ? (
                <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
              ) : (
                <Trash2 size={16} strokeWidth={2} aria-hidden />
              )}
              Borrar todo
            </button>
          </div>
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="pagos-table-wrap">
            <table className="pagos-table">
              <thead>
                <tr>
                  <th className="contable-check-cell">
                    <input
                      type="checkbox"
                      className="contable-check"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      aria-label="Seleccionar todos los movimientos del día"
                    />
                  </th>
                  <th>Fecha</th>
                  <th>Programa</th>
                  <th>Nombre</th>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((item) => (
                  <tr key={item.id} className={selectedIds.includes(item.id) ? 'is-selected' : undefined}>
                    <td className="contable-check-cell">
                      <input
                        type="checkbox"
                        className="contable-check"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        aria-label={`Seleccionar ${item.concepto || item.id}`}
                      />
                    </td>
                    <td>{formatFecha(item.creadoEn || item.fecha)}</td>
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
                    <td>
                      <button
                        type="button"
                        className="proyecto-delete"
                        onClick={() => void handleDeleteMovimiento(item)}
                        disabled={deletingId === item.id || deletingBulk}
                        aria-label={`Eliminar movimiento ${item.concepto || item.id}`}
                      >
                        {deletingId === item.id ? (
                          <LoaderCircle className="spin" size={16} strokeWidth={2} />
                        ) : (
                          <Trash2 size={16} strokeWidth={2} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="contable-pager">
            <p className="pagos-filter-meta">
              <RefreshCw size={14} strokeWidth={2} aria-hidden />
              {filtered.length} {tipo} el {dia}
              {pageCount > 1 ? ` · página ${safePage} de ${pageCount}` : ''}
            </p>
            {pageCount > 1 ? (
              <div className="contable-day-btns">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={safePage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                  Anterior
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                >
                  Siguiente
                  <ChevronRight size={16} strokeWidth={2} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      ) : null}

      {vista === 'docs' ? <ContableApiDocs /> : null}
    </>
  )
}
