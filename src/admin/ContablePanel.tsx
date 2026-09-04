import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { API_URL } from '../config'
import { formatCop } from '../api/administradores'
import {
  createContableApiKey,
  createContableMovimiento,
  deleteContableApiKey,
  deleteContableMovimiento,
  deleteContableMovimientos,
  listContableApiKeys,
  listContableMovimientosRango,
  setContableApiKeyActiva,
  type ContableApiKey,
  type ContableMovimiento,
  type ContableResumenAnual,
  type ContableResumenPeriodo,
  type ContableTipo,
} from '../api/contable'
import { useAuth } from '../contexts/AuthContext'
import { buildContablePdf, buildContableXlsx } from './contableReports'
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
  X,
} from '../icons'

const PAGE_SIZE = 20

type ContableVista = 'movimientos' | 'claves' | 'docs'
type PeriodoPreset = 'hoy' | 'semana' | 'mes' | 'personalizado'

function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function startOfWeekBogota(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  return shiftYmd(ymd, -offset)
}

function startOfMonthBogota(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

function resolvePeriodo(
  preset: PeriodoPreset,
  today: string,
  customDesde: string,
  customHasta: string,
): { desde: string; hasta: string } {
  if (preset === 'hoy') {
    return { desde: today, hasta: today }
  }
  if (preset === 'semana') {
    const desde = startOfWeekBogota(today)
    const finSemana = shiftYmd(desde, 6)
    return { desde, hasta: finSemana > today ? today : finSemana }
  }
  if (preset === 'mes') {
    return { desde: startOfMonthBogota(today), hasta: today }
  }
  let desde = customDesde || today
  let hasta = customHasta || today
  if (desde > hasta) {
    const swap = desde
    desde = hasta
    hasta = swap
  }
  if (hasta > today) hasta = today
  return { desde, hasta }
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

function formatPeriodoLabel(desde: string, hasta: string): string {
  if (desde === hasta) return formatDiaLargo(desde)
  return `${formatDiaLargo(desde)} → ${formatDiaLargo(hasta)}`
}

function yearFromMovimiento(item: ContableMovimiento, fallback: number): number {
  const raw = item.fecha?.slice(0, 4)
  const year = Number(raw)
  return Number.isInteger(year) && year >= 2000 ? year : fallback
}

function buildContableApiTxt() {
  /** URL que deben usar los proyectos externos (nunca localhost). */
  const base = 'https://nodefex.onrender.com'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

  return `NODEFEX CONTABLE — INTEGRACIÓN PARA TU PROYECTO
============================================================
Documento para el equipo / sistema que enviará ingresos (y opcionalmente
egresos) a Nodefex usando una API key.

Fecha del documento: ${today}
Destinatario: proyecto externo con API key (nfx_...)

OBJETIVO
--------
Cada vez que en TU proyecto ocurra un ingreso (pago, recarga,
membresía, venta, etc.), debes hacer un POST HTTP a Nodefex para
que el movimiento quede registrado en contabilidad.

Nodefex identifica tu proyecto por la API key. No uses login de
admin ni Firebase Auth para esta integración.


1) URL OBLIGATORIA (backend de Nodefex, no el sitio web)
-------------------------------------------------------
POST ${base}/api/contable/ingresos

NO uses:
- https://www.nodefex.com/...
- https://nodefex.com/...
- http://localhost:...
- rutas relativas de tu propio dominio

Alias válido de ingresos:
POST ${base}/api/contable/entradas

Egresos (si aplica):
POST ${base}/api/contable/egresos


2) HEADERS OBLIGATORIOS
-----------------------
Content-Type: application/json
X-Api-Key: PEGA_AQUI_TU_API_KEY_COMPLETA

La API key:
- Empieza por nfx_
- Te la entrega el administrador de Nodefex Contable (pestaña API keys)
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
- valor = number en pesos COP (no centavos), mayor a 0. Obligatorio.
  Correcto:   100000
  Incorrecto: "100.000"  "$100.000"  "100000 COP"  10000000 (si pensabas en centavos)
- fecha = "YYYY-MM-DD" (día contable Bogotá) o ISO con zona (Z / offset).
  ISO sin zona (ej. 2026-01-01T15:00:00) se interpreta como Bogotá (-05:00).
  Si no la envías, Nodefex usa la hora actual (Bogotá).
  No uses toISOString().slice(0,10): ese día es UTC y falla de noche en Colombia.
- nombre = string con el cliente/tercero. Si no llega, Nodefex usa el nombre del programa de tu API key.
  En la respuesta verás clienteNombre y también nombre (alias).
  fecha = día contable; creadoEn = momento en que se registró en el API.
  unidad de valor en respuesta: "COP".

Alias aceptados (por si tu código ya usa otros nombres):
- concepto   → tambien: descripcion, description, detalle, motivo, conceptoPago
- valor      → tambien: amount, monto, value, total, precio
- nombre     → tambien: clienteNombre, name, cliente, customer, tercero
- fecha      → tambien: date, fechaRegistro, createdAt
- metodoPago → tambien: paymentMethod, metodo
- referencia → tambien: reference, recibo, factura
- clienteId  → tambien: customerId, userId
- categoria  → tambien: category
- estado     → tambien: status


5) EJEMPLO LISTO PARA COPIAR (JavaScript / Node)
------------------------------------------------
const NODEFEX_API = "${base}";
const NODEFEX_API_KEY = process.env.NODEFEX_CONTABLE_API_KEY; // nfx_...

async function registrarIngresoEnNodefex({ concepto, valor, nombre, referencia, clienteId, metodoPago, categoria }) {
  const response = await fetch(\`\${NODEFEX_API}/api/contable/ingresos\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": NODEFEX_API_KEY,
    },
    body: JSON.stringify({
      // Día contable en America/Bogota (NO uses toISOString().slice(0,10): es UTC).
      fecha: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date()),
      concepto,
      valor: Number(valor),
      nombre,
      referencia,
      clienteId,
      metodoPago,
      categoria,
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
//   categoria: "membresias",
// });


6) EJEMPLO CURL (prueba manual)
-------------------------------
curl -X POST "${base}/api/contable/ingresos" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: PEGA_AQUI_TU_API_KEY" \\
  -d '{"fecha":"${today}","nombre":"Cliente Demo","concepto":"pago prueba","valor":100000,"referencia":"TEST-001"}'


7) RESPUESTA ESPERADA
---------------------
HTTP 201 Created

{
  "movimiento": {
    "id": "...",
    "fecha": "2026-09-04T...Z",
    "fechaEnviada": "${today}",
    "concepto": "pago prueba",
    "categoria": null,
    "clienteId": null,
    "nombre": "Cliente Demo",
    "clienteNombre": "Cliente Demo",
    "metodoPago": null,
    "valor": 100000,
    "unidad": "COP",
    "referencia": "TEST-001",
    "estado": "confirmado",
    "programa": "nombre de tu programa",
    "programaId": "...",
    "origen": "api-key",
    "creadoEn": "2026-09-04T...Z",
    "createdBy": "..."
  },
  "resumenAnual": {
    "tipo": "ingresos",
    "año": 2026,
    "total": 100000,
    "totalIngresos": 100000,
    "totalEgresos": 0,
    "cantidadMovimientos": 1,
    "actualizadoEn": "..."
  },
  "path": "proyectos/nodefex-contable/contabilidad/ingresos/años/2026/movimientos/ID"
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

400  La fecha no es válida
     → Revisa el formato YYYY-MM-DD o ISO.

404 o HTML del sitio Nodefex
     → Estás llamando nodefex.com / www.nodefex.com en vez de:
       ${base}/api/contable/ingresos

503  Sin cuota temporal de base de datos
     → Reintenta más tarde.


9) CHECKLIST ANTES DE SUBIR A PRODUCCIÓN
----------------------------------------
[ ] Usas exactamente: ${base}/api/contable/ingresos
[ ] Headers: Content-Type application/json + X-Api-Key
[ ] Body JSON con al menos concepto (string) y valor (number en COP)
[ ] La fecha usa día Bogotá (no toISOString().slice(0,10))
[ ] La llamada ocurre solo cuando el pago/cobro ya está confirmado
[ ] La API key está en variable de entorno del backend de TU proyecto
[ ] Probaste con curl o un pago de prueba y recibiste HTTP 201


10) EGRESOS (MISMO CONTRATO)
----------------------------
POST ${base}/api/contable/egresos

Mismos headers y misma forma de body (concepto + valor obligatorios).

curl -X POST "${base}/api/contable/egresos" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: PEGA_AQUI_TU_API_KEY" \\
  -d '{"fecha":"${today}","nombre":"Proveedor","concepto":"arriendo","valor":250000,"categoria":"gastos"}'


11) DÓNDE SE GUARDA
-------------------
Firestore Nodefex:
proyectos/nodefex-contable/contabilidad/{ingresos|egresos}/años/{AAAA}/movimientos/{id}
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
  const today = todayBogota()
  const publicApiBase = 'https://nodefex.onrender.com'

  const ingresoExample = `curl -X POST "${publicApiBase}/api/contable/ingresos" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: nfx_TU_CLAVE" \\
  -d '{"fecha":"${today}","nombre":"Juan Pérez","concepto":"recarga","valor":100000,"referencia":"TX-001"}'`

  const egresoExample = `curl -X POST "${publicApiBase}/api/contable/egresos" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: nfx_TU_CLAVE" \\
  -d '{"fecha":"${today}","nombre":"Proveedor","concepto":"arriendo","valor":250000,"categoria":"gastos","metodoPago":"transferencia"}'`

  const jsExample = `const NODEFEX_API = "${publicApiBase}";
const NODEFEX_API_KEY = process.env.NODEFEX_CONTABLE_API_KEY;

async function registrarIngresoEnNodefex(payload) {
  const response = await fetch(\`\${NODEFEX_API}/api/contable/ingresos\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": NODEFEX_API_KEY,
    },
    body: JSON.stringify({
      fecha: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date()),
      ...payload,
      valor: Number(payload.valor),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || \`HTTP \${response.status}\`);
  return data;
}`

  const responseExample = `{
  "movimiento": {
    "id": "...",
    "fecha": "...",
    "concepto": "recarga",
    "nombre": "Juan Pérez",
    "clienteNombre": "Juan Pérez",
    "valor": 100000,
    "unidad": "COP",
    "estado": "confirmado",
    "programa": "Tu programa",
    "origen": "api-key"
  },
  "resumenAnual": { "tipo": "ingresos", "año": ${today.slice(0, 4)}, "total": 100000, "cantidadMovimientos": 1 },
  "path": "proyectos/nodefex-contable/contabilidad/ingresos/años/.../movimientos/..."
}`

  function handleDownloadApiTxt() {
    downloadTextFile('nodefex-contable-api.txt', buildContableApiTxt())
  }

  return (
    <section className="usuarios-section contable-docs" aria-label="Documentación de la API">
      <div className="section-heading">
        <FileText size={18} strokeWidth={2} aria-hidden />
        <h2>Documentación de la API</h2>
        <button type="button" className="btn-secondary" onClick={handleDownloadApiTxt}>
          <Download size={16} strokeWidth={2} aria-hidden />
          Descargar TXT para el proyecto
        </button>
      </div>
      <p className="section-note">
        URL pública de integración: <code>{publicApiBase}</code>. El TXT está pensado para
        entregárselo al otro proyecto que usará la API key: incluye URL, headers, body, ejemplos y
        checklist. El panel local puede usar <code>{API_URL}</code> solo para pruebas internas.
      </p>

      <article className="contable-docs-card">
        <h3>Autenticación</h3>
        <p>
          Crea una clave en la pestaña <strong>API keys</strong> con el nombre del programa. Envíala
          en cada petición:
        </p>
        <CopyBlock code={'X-Api-Key: nfx_TU_CLAVE'} />
        <p>
          También se acepta <code>Authorization: Bearer nfx_TU_CLAVE</code>.
        </p>
        <p>
          El movimiento queda con <code>programa</code>, <code>programaId</code> y{' '}
          <code>origen: &quot;api-key&quot;</code>.
        </p>
      </article>

      <article className="contable-docs-card">
        <h3>Registrar ingreso</h3>
        <p>
          <code>POST {publicApiBase}/api/contable/ingresos</code>
          {' · '}
          alias <code>/api/contable/entradas</code>
        </p>
        <CopyBlock code={ingresoExample} />
      </article>

      <article className="contable-docs-card">
        <h3>Registrar egreso</h3>
        <p>
          <code>POST {publicApiBase}/api/contable/egresos</code>
        </p>
        <p>Mismo contrato de body que ingresos (concepto + valor obligatorios).</p>
        <CopyBlock code={egresoExample} />
      </article>

      <article className="contable-docs-card">
        <h3>Ejemplo JavaScript / Node</h3>
        <CopyBlock code={jsExample} />
      </article>

      <article className="contable-docs-card">
        <h3>Respuesta (HTTP 201)</h3>
        <CopyBlock code={responseExample} />
      </article>

      <article className="contable-docs-card">
        <h3>Campos del body</h3>
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
                  <code>concepto</code>
                </td>
                <td>Sí</td>
                <td>Descripción del movimiento. Alias: descripcion, detalle, motivo.</td>
              </tr>
              <tr>
                <td>
                  <code>valor</code>
                </td>
                <td>Sí</td>
                <td>Número &gt; 0 en pesos COP (no centavos). Ejemplo: 100000.</td>
              </tr>
              <tr>
                <td>
                  <code>fecha</code>
                </td>
                <td>No</td>
                <td>
                  YYYY-MM-DD (día Bogotá) o ISO. Si no llega, se usa ahora (Bogotá). No uses{' '}
                  <code>toISOString().slice(0,10)</code>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>nombre</code>
                </td>
                <td>No</td>
                <td>
                  Cliente o tercero. Alias: clienteNombre. Si no llega, se usa el nombre del
                  programa de la API key. En la respuesta: clienteNombre + nombre.
                </td>
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
        <h3>Errores comunes</h3>
        <p>
          <code>401</code> clave inválida o desactivada · <code>400</code> concepto/valor/fecha
          inválidos · <code>503</code> cuota temporal de Firestore · HTML del sitio → estás
          llamando nodefex.com en vez de <code>{publicApiBase}</code>.
        </p>
      </article>

      <article className="contable-docs-card">
        <h3>Dónde se guarda</h3>
        <p>
          Firestore Nodefex:{' '}
          <code>
            proyectos/nodefex-contable/contabilidad/{'{ingresos|egresos}'}/años/{'{año}'}/movimientos/
            {'{id}'}
          </code>
        </p>
      </article>

      <article className="contable-docs-card">
        <h3>Notas del panel (solo administradores)</h3>
        <p>
          Listar por rango: <code>GET /api/contable/{'{tipo}'}/rango?desde=YYYY-MM-DD&amp;hasta=YYYY-MM-DD</code>{' '}
          con Bearer de admin. Eliminar: <code>DELETE /api/contable/{'{tipo}'}/{'{año}'}/{'{id}'}</code>.
          Los egresos también se pueden registrar desde el panel sin API key.
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
  const [vista, setVista] = useState<ContableVista>('movimientos')
  const [tipo, setTipo] = useState<ContableTipo>('ingresos')
  const [periodo, setPeriodo] = useState<PeriodoPreset>('hoy')
  const [customDesde, setCustomDesde] = useState(today)
  const [customHasta, setCustomHasta] = useState(today)
  const { desde, hasta } = useMemo(
    () => resolvePeriodo(periodo, today, customDesde, customHasta),
    [periodo, today, customDesde, customHasta],
  )
  const [resumen, setResumen] = useState<ContableResumenAnual | null>(null)
  const [resumenPeriodo, setResumenPeriodo] = useState<ContableResumenPeriodo | null>(null)
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

  const [egresoModalOpen, setEgresoModalOpen] = useState(false)
  const [egresoFecha, setEgresoFecha] = useState(today)
  const [egresoConcepto, setEgresoConcepto] = useState('')
  const [egresoValor, setEgresoValor] = useState('')
  const [egresoError, setEgresoError] = useState('')
  const [egresoSubmitting, setEgresoSubmitting] = useState(false)

  const [reporteDesde, setReporteDesde] = useState(today)
  const [reporteHasta, setReporteHasta] = useState(today)
  const [reporteBusy, setReporteBusy] = useState<'pdf' | 'xlsx' | null>(null)
  const [reporteError, setReporteError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadMovimientos() {
      if (!user || vista !== 'movimientos') return
      setLoading(true)
      setError('')
      try {
        const token = await user.getIdToken()
        const data = await listContableMovimientosRango(token, tipo, { desde, hasta })
        if (cancelled) return
        setResumen(data.resumenAnual)
        setResumenPeriodo(data.resumenPeriodo)
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
  }, [user, tipo, desde, hasta, vista, refreshTick])

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
    const year = yearFromMovimiento(item, Number(desde.slice(0, 4)))
    setDeletingId(item.id)
    setError('')
    try {
      const token = await user.getIdToken()
      const nextResumen = await deleteContableMovimiento(token, tipo, year, item.id)
      setMovimientos((current) => current.filter((mov) => mov.id !== item.id))
      setSelectedIds((current) => current.filter((id) => id !== item.id))
      setResumen(nextResumen)
      setResumenPeriodo((current) =>
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
      const byYear = new Map<number, string[]>()
      for (const item of items) {
        const year = yearFromMovimiento(item, Number(desde.slice(0, 4)))
        const list = byYear.get(year) || []
        list.push(item.id)
        byYear.set(year, list)
      }

      let nextResumen: ContableResumenAnual | null = null
      for (const [year, ids] of byYear) {
        nextResumen = await deleteContableMovimientos(token, tipo, year, ids)
      }

      const removed = new Set(items.map((item) => item.id))
      setMovimientos((current) => current.filter((mov) => !removed.has(mov.id)))
      setSelectedIds([])
      if (nextResumen) setResumen(nextResumen)
      setResumenPeriodo((current) =>
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
      const aTime = Date.parse(a.fecha || a.creadoEn || '') || 0
      const bTime = Date.parse(b.fecha || b.creadoEn || '') || 0
      return bTime - aTime
    })
  }, [movimientos, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id))
  const selectedCount = selectedIds.length
  const totalPeriodo =
    resumenPeriodo?.total ?? filtered.reduce((sum, item) => sum + (Number(item.valor) || 0), 0)
  const totalAnio = resumen?.total ?? 0
  const cantidadPeriodo = resumenPeriodo?.cantidad ?? filtered.length
  const isSingleDay = desde === hasta

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function toggleSelectAll() {
    setSelectedIds(allFilteredSelected ? [] : filtered.map((item) => item.id))
  }

  function applyPreset(next: PeriodoPreset) {
    setPeriodo(next)
    if (next === 'personalizado') {
      setCustomDesde(desde)
      setCustomHasta(hasta)
    }
    setPage(1)
    setSelectedIds([])
  }

  function openEgresoModal() {
    setEgresoFecha(todayBogota())
    setEgresoConcepto('')
    setEgresoValor('')
    setEgresoError('')
    setEgresoModalOpen(true)
  }

  function closeEgresoModal() {
    if (egresoSubmitting) return
    setEgresoModalOpen(false)
    setEgresoError('')
  }

  async function handleCreateEgreso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const concepto = egresoConcepto.trim()
    const valor = Number(String(egresoValor).replace(/,/g, '').trim())
    const fecha = egresoFecha || todayBogota()

    if (!concepto) {
      setEgresoError('El concepto es obligatorio.')
      return
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      setEgresoError('El valor debe ser un número mayor a 0 (en pesos COP).')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      setEgresoError('La fecha no es válida.')
      return
    }

    setEgresoSubmitting(true)
    setEgresoError('')
    try {
      const token = await user.getIdToken()
      await createContableMovimiento(token, 'egresos', {
        fecha,
        concepto,
        valor,
        nombre: 'Panel Nodefex',
      })
      setEgresoModalOpen(false)
      setTipo('egresos')
      if (fecha < desde || fecha > hasta) {
        if (fecha === todayBogota()) {
          setPeriodo('hoy')
        } else {
          setPeriodo('personalizado')
          setCustomDesde(fecha)
          setCustomHasta(fecha)
        }
      }
      setPage(1)
      setSelectedIds([])
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setEgresoError(err instanceof Error ? err.message : 'No se pudo registrar el egreso')
    } finally {
      setEgresoSubmitting(false)
    }
  }

  async function generateReporte(format: 'pdf' | 'xlsx') {
    if (!user) return

    let desdeR = reporteDesde || todayBogota()
    let hastaR = reporteHasta || todayBogota()
    if (desdeR > hastaR) {
      const swap = desdeR
      desdeR = hastaR
      hastaR = swap
      setReporteDesde(desdeR)
      setReporteHasta(hastaR)
    }

    setReporteBusy(format)
    setReporteError('')
    try {
      const token = await user.getIdToken()
      const [ingresosData, egresosData] = await Promise.all([
        listContableMovimientosRango(token, 'ingresos', { desde: desdeR, hasta: hastaR }),
        listContableMovimientosRango(token, 'egresos', { desde: desdeR, hasta: hastaR }),
      ])
      const payload = {
        desde: desdeR,
        hasta: hastaR,
        ingresos: ingresosData.movimientos,
        egresos: egresosData.movimientos,
      }
      if (format === 'pdf') buildContablePdf(payload)
      else buildContableXlsx(payload)
    } catch (err) {
      setReporteError(err instanceof Error ? err.message : 'No se pudo generar el reporte')
    } finally {
      setReporteBusy(null)
    }
  }

  return (
    <>
      <section className="contable-reports" aria-label="Reportes contables">
        <div className="contable-reports-head">
          <h2>Reportes</h2>
          <p>Descarga ingresos y egresos en un rango de fechas personalizado.</p>
        </div>
        <div className="contable-reports-controls">
          <label className="login-field" htmlFor="reporte-desde">
            Desde
            <input
              id="reporte-desde"
              type="date"
              value={reporteDesde}
              max={today}
              onChange={(event) => setReporteDesde(event.target.value || today)}
              disabled={Boolean(reporteBusy)}
            />
          </label>
          <label className="login-field" htmlFor="reporte-hasta">
            Hasta
            <input
              id="reporte-hasta"
              type="date"
              value={reporteHasta}
              max={today}
              min={reporteDesde}
              onChange={(event) => setReporteHasta(event.target.value || today)}
              disabled={Boolean(reporteBusy)}
            />
          </label>
          <div className="contable-reports-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void generateReporte('pdf')}
              disabled={Boolean(reporteBusy)}
            >
              {reporteBusy === 'pdf' ? (
                <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
              ) : (
                <FileText size={16} strokeWidth={2} aria-hidden />
              )}
              PDF
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void generateReporte('xlsx')}
              disabled={Boolean(reporteBusy)}
            >
              {reporteBusy === 'xlsx' ? (
                <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
              ) : (
                <Download size={16} strokeWidth={2} aria-hidden />
              )}
              Excel
            </button>
          </div>
        </div>
        {reporteError ? (
          <p className="contable-reports-error" role="alert">
            <AlertCircle size={16} strokeWidth={2} aria-hidden />
            {reporteError}
          </p>
        ) : null}
      </section>

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
                'nodefex-contable-api.txt',
                buildContableApiTxt(),
              )
            }
          >
            <Download size={16} strokeWidth={2} aria-hidden />
            Descargar TXT para el proyecto
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
          <div className="hero-actions">
            {tipo === 'egresos' ? (
              <button type="button" className="btn-primary" onClick={openEgresoModal}>
                <Plus size={16} strokeWidth={2} aria-hidden />
                Registrar egreso
              </button>
            ) : null}
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
        </div>
        <p className="section-note">
          {formatPeriodoLabel(desde, hasta)}. Cada registro muestra el programa que lo ingresó.
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

          <div className="contable-period-tabs" role="group" aria-label="Filtro de periodo">
            {(
              [
                ['hoy', 'Hoy'],
                ['semana', 'Esta semana'],
                ['mes', 'Este mes'],
                ['personalizado', 'Personalizado'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={periodo === value ? 'is-active' : ''}
                onClick={() => applyPreset(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {periodo === 'personalizado' ? (
            <div className="contable-range">
              <label className="login-field" htmlFor="contable-desde">
                Desde
                <input
                  id="contable-desde"
                  type="date"
                  value={customDesde}
                  max={today}
                  onChange={(event) => {
                    setCustomDesde(event.target.value || today)
                    setPage(1)
                    setSelectedIds([])
                  }}
                />
              </label>
              <label className="login-field" htmlFor="contable-hasta">
                Hasta
                <input
                  id="contable-hasta"
                  type="date"
                  value={customHasta}
                  max={today}
                  min={customDesde}
                  onChange={(event) => {
                    setCustomHasta(event.target.value || today)
                    setPage(1)
                    setSelectedIds([])
                  }}
                />
              </label>
            </div>
          ) : null}

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
            <span>{isSingleDay ? 'Total del día' : 'Total del periodo'}</span>
            <strong>{formatCop(totalPeriodo)}</strong>
          </div>
          <div>
            <span>
              {isSingleDay
                ? tipo === 'ingresos'
                  ? 'Ingresos del día'
                  : 'Egresos del día'
                : tipo === 'ingresos'
                  ? 'Ingresos del periodo'
                  : 'Egresos del periodo'}
            </span>
            <strong>{cantidadPeriodo}</strong>
          </div>
          <div>
            <span>Total {resumen?.año ?? Number(hasta.slice(0, 4))}</span>
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
              No hay {tipo} en {isSingleDay ? formatDiaLargo(desde) : 'este periodo'}.
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
                    <td title={item.creadoEn ? `Registrado: ${formatFecha(item.creadoEn)}` : undefined}>
                      {formatFecha(item.fecha || item.creadoEn)}
                    </td>
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
              {filtered.length} {tipo}
              {isSingleDay ? ` el ${formatDiaLargo(desde)}` : ' en el periodo'}
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

      {egresoModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeEgresoModal}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="egreso-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="egreso-modal-title">Registrar egreso</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeEgresoModal}
                disabled={egresoSubmitting}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <form className="modal-form" onSubmit={(event) => void handleCreateEgreso(event)} noValidate>
              <label className="login-field" htmlFor="egreso-fecha">
                Fecha
                <input
                  id="egreso-fecha"
                  type="date"
                  value={egresoFecha}
                  max={todayBogota()}
                  onChange={(event) => setEgresoFecha(event.target.value || todayBogota())}
                  required
                  disabled={egresoSubmitting}
                />
              </label>

              <label className="login-field" htmlFor="egreso-concepto">
                Concepto
                <input
                  id="egreso-concepto"
                  type="text"
                  value={egresoConcepto}
                  onChange={(event) => setEgresoConcepto(event.target.value)}
                  placeholder="Pago proveedor, arriendo, insumos..."
                  required
                  disabled={egresoSubmitting}
                  autoFocus
                />
              </label>

              <label className="login-field" htmlFor="egreso-valor">
                Valor (COP)
                <input
                  id="egreso-valor"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={egresoValor}
                  onChange={(event) => setEgresoValor(event.target.value)}
                  placeholder="100000"
                  required
                  disabled={egresoSubmitting}
                />
              </label>

              {egresoError ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} strokeWidth={2} aria-hidden />
                  {egresoError}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeEgresoModal}
                  disabled={egresoSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={egresoSubmitting}>
                  {egresoSubmitting ? (
                    <>
                      <LoaderCircle className="spin" size={16} strokeWidth={2} aria-hidden />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus size={16} strokeWidth={2} aria-hidden />
                      Guardar egreso
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
