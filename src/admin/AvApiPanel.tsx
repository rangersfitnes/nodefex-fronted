import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listAvCatalogoClientes,
  listAvCatalogoEquipos,
  listAvCatalogoPlanes,
  listAvCatalogoServicios,
  type AvCliente,
  type AvEquipo,
  type AvPlan,
  type AvServicioCredito,
} from '../api/audiovisual'
import { formatCop } from '../api/administradores'
import { API_URL } from '../config'
import { useAuth } from '../contexts/AuthContext'
import {
  AlertCircle,
  Code2,
  Download,
  FileText,
  Layers,
  LoaderCircle,
  Package,
  RefreshCw,
  Users,
} from '../icons'

type ApiSubvista = 'servicios' | 'planes' | 'clientes' | 'equipos'

const SUBVISTA_META: Record<
  ApiSubvista,
  { label: string; resource: string; endpointPath: string; campos: string }
> = {
  servicios: {
    label: 'Servicios',
    resource: 'servicios',
    endpointPath: '/api/audiovisual/catalogo/servicios',
    campos: 'referencia (código), nombre, descripcion, costo',
  },
  planes: {
    label: 'Planes',
    resource: 'planes',
    endpointPath: '/api/audiovisual/catalogo/planes',
    campos: 'nombre, descripcion, precio, activo, servicios[]',
  },
  clientes: {
    label: 'Clientes',
    resource: 'clientes',
    endpointPath: '/api/audiovisual/catalogo/clientes',
    campos: 'nombre, documento, telefono, correo, ciudad, responsable',
  },
  equipos: {
    label: 'Equipos',
    resource: 'equipos',
    endpointPath: '/api/audiovisual/catalogo/equipos',
    campos: 'codigo, nombre, descripcion, valorComercial, estado, responsable',
  },
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function docsHeader(title: string, baseUrl: string, path: string, extraEndpoints: string[] = []) {
  return [
    'NODEFEX AUDIO VISUAL — EL GENIO',
    `API de catálogo · ${title} (solo lectura)`,
    '================================================',
    '',
    'DESCRIPCIÓN',
    '-----------',
    `Consulta el catálogo de ${title.toLowerCase()}.`,
    'Esta API es de solo lectura: no acepta crear, editar ni eliminar.',
    '',
    'AUTENTICACIÓN',
    '-------------',
    'Header obligatorio:',
    '  Authorization: Bearer <Firebase ID Token>',
    '',
    'ENDPOINT',
    '--------',
    `GET ${baseUrl}${path}`,
    ...extraEndpoints.map((line) => `GET ${baseUrl}${line}`),
    '',
    'MÉTODOS PERMITIDOS',
    '------------------',
    'GET, HEAD, OPTIONS',
    'Cualquier POST / PUT / PATCH / DELETE responde 405.',
    '',
  ]
}

function buildServiciosDocs(baseUrl: string, servicios: AvServicioCredito[]): string {
  const lines = [
    ...docsHeader('SERVICIOS', baseUrl, '/api/audiovisual/catalogo/servicios'),
    'RESPUESTA (JSON)',
    '----------------',
    '{ "readonly": true, "resource": "servicios", "count": N, "servicios": [ ... ] }',
    '',
    'CAMPOS PRINCIPALES',
    '------------------',
    'referencia  → código del servicio',
    'nombre      → nombre comercial',
    'descripcion → detalle del servicio',
    'costo       → precio en COP',
    '',
    'EJEMPLO curl',
    '------------',
    `curl -X GET "${baseUrl}/api/audiovisual/catalogo/servicios" \\`,
    '  -H "Authorization: Bearer TU_TOKEN"',
    '',
    'SNAPSHOT ACTUAL',
    '---------------',
    `Total servicios: ${servicios.length}`,
    `Generado: ${new Date().toISOString()}`,
    '',
  ]
  for (const item of servicios) {
    lines.push(
      `· [${item.referencia || 's/c'}] ${item.nombre || 'Sin nombre'}`,
      `  Precio: ${formatCop(item.costo)}`,
      `  Descripción: ${item.descripcion || '—'}`,
      `  ID: ${item.id}`,
      '',
    )
  }
  return `${lines.join('\n')}\n`
}

function buildPlanesDocs(baseUrl: string, planes: AvPlan[]): string {
  const lines = [
    ...docsHeader('PLANES', baseUrl, '/api/audiovisual/catalogo/planes', [
      '/api/audiovisual/catalogo/planes?activos=1',
    ]),
    'RESPUESTA (JSON)',
    '----------------',
    '{ "readonly": true, "resource": "planes", "count": N, "planes": [ ... ] }',
    '',
    'CAMPOS PRINCIPALES',
    '------------------',
    'nombre / descripcion / precio / activo / servicios[]',
    '',
    'EJEMPLO curl',
    '------------',
    `curl -X GET "${baseUrl}/api/audiovisual/catalogo/planes?activos=1" \\`,
    '  -H "Authorization: Bearer TU_TOKEN"',
    '',
    'SNAPSHOT ACTUAL',
    '---------------',
    `Total planes: ${planes.length}`,
    `Generado: ${new Date().toISOString()}`,
    '',
  ]
  for (const plan of planes) {
    lines.push(
      `· ${plan.nombre || 'Sin nombre'} ${plan.activo ? '(activo)' : '(inactivo)'}`,
      `  Precio: ${formatCop(plan.precio)}`,
      `  Descripción: ${plan.descripcion || '—'}`,
      `  ID: ${plan.id}`,
      '',
    )
  }
  return `${lines.join('\n')}\n`
}

function buildClientesDocs(baseUrl: string, clientes: AvCliente[]): string {
  const lines = [
    ...docsHeader('CLIENTES', baseUrl, '/api/audiovisual/catalogo/clientes'),
    'RESPUESTA (JSON)',
    '----------------',
    '{ "readonly": true, "resource": "clientes", "count": N, "clientes": [ ... ] }',
    '',
    'CAMPOS PRINCIPALES',
    '------------------',
    'nombre, documento, telefono, correo, ciudad, direccion,',
    'tipoPersona, tipoComercial, responsable, notas',
    '',
    'EJEMPLO curl',
    '------------',
    `curl -X GET "${baseUrl}/api/audiovisual/catalogo/clientes" \\`,
    '  -H "Authorization: Bearer TU_TOKEN"',
    '',
    'SNAPSHOT ACTUAL',
    '---------------',
    `Total clientes: ${clientes.length}`,
    `Generado: ${new Date().toISOString()}`,
    '',
  ]
  for (const item of clientes) {
    lines.push(
      `· ${item.nombre || 'Sin nombre'}`,
      `  Documento: ${item.documento || '—'}`,
      `  Teléfono: ${item.telefono || '—'} · Correo: ${item.correo || '—'}`,
      `  Ciudad: ${item.ciudad || '—'} · Responsable: ${item.responsable || '—'}`,
      `  ID: ${item.id}`,
      '',
    )
  }
  return `${lines.join('\n')}\n`
}

function buildEquiposDocs(baseUrl: string, equipos: AvEquipo[]): string {
  const lines = [
    ...docsHeader('EQUIPOS', baseUrl, '/api/audiovisual/catalogo/equipos'),
    'RESPUESTA (JSON)',
    '----------------',
    '{ "readonly": true, "resource": "equipos", "count": N, "equipos": [ ... ] }',
    '',
    'CAMPOS PRINCIPALES',
    '------------------',
    'codigo (4 caracteres), nombre, descripcion, valorComercial,',
    'estado (bodega | produccion), responsableNombre, itemsRevision[]',
    '',
    'EJEMPLO curl',
    '------------',
    `curl -X GET "${baseUrl}/api/audiovisual/catalogo/equipos" \\`,
    '  -H "Authorization: Bearer TU_TOKEN"',
    '',
    'SNAPSHOT ACTUAL',
    '---------------',
    `Total equipos: ${equipos.length}`,
    `Generado: ${new Date().toISOString()}`,
    '',
  ]
  for (const item of equipos) {
    lines.push(
      `· [${item.codigo || 's/c'}] ${item.nombre || 'Sin nombre'}`,
      `  Estado: ${item.estado} · Valor: ${formatCop(item.valorComercial)}`,
      `  Descripción: ${item.descripcion || '—'}`,
      `  Responsable: ${item.responsableNombre || '—'}`,
      `  ID: ${item.id}`,
      '',
    )
  }
  return `${lines.join('\n')}\n`
}

export function AvApiPanel() {
  const { user } = useAuth()
  const [subvista, setSubvista] = useState<ApiSubvista>('servicios')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [servicios, setServicios] = useState<AvServicioCredito[]>([])
  const [planes, setPlanes] = useState<AvPlan[]>([])
  const [clientes, setClientes] = useState<AvCliente[]>([])
  const [equipos, setEquipos] = useState<AvEquipo[]>([])
  const [rawJson, setRawJson] = useState('')

  const meta = SUBVISTA_META[subvista]

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const token = await user.getIdToken()
      if (subvista === 'servicios') {
        const data = await listAvCatalogoServicios(token)
        setServicios(data.servicios || [])
        setRawJson(JSON.stringify(data, null, 2))
      } else if (subvista === 'planes') {
        const data = await listAvCatalogoPlanes(token)
        setPlanes(data.planes || [])
        setRawJson(JSON.stringify(data, null, 2))
      } else if (subvista === 'clientes') {
        const data = await listAvCatalogoClientes(token)
        setClientes(data.clientes || [])
        setRawJson(JSON.stringify(data, null, 2))
      } else {
        const data = await listAvCatalogoEquipos(token)
        setEquipos(data.equipos || [])
        setRawJson(JSON.stringify(data, null, 2))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo')
      setRawJson('')
    } finally {
      setLoading(false)
    }
  }, [subvista, user])

  useEffect(() => {
    void load()
  }, [load])

  const endpoint = useMemo(() => `${API_URL}${meta.endpointPath}`, [meta.endpointPath])

  function handleDownloadDocs() {
    if (subvista === 'servicios') {
      downloadTextFile('nodefex-api-catalogo-servicios.txt', buildServiciosDocs(API_URL, servicios))
      return
    }
    if (subvista === 'planes') {
      downloadTextFile('nodefex-api-catalogo-planes.txt', buildPlanesDocs(API_URL, planes))
      return
    }
    if (subvista === 'clientes') {
      downloadTextFile('nodefex-api-catalogo-clientes.txt', buildClientesDocs(API_URL, clientes))
      return
    }
    downloadTextFile('nodefex-api-catalogo-equipos.txt', buildEquiposDocs(API_URL, equipos))
  }

  function handleDownloadJson() {
    const blob = new Blob([rawJson || '{}'], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `nodefex-api-${meta.resource}-respuesta.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="av-api-panel" role="tabpanel" aria-label="Api de catálogo">
      <div className="section-heading">
        <Code2 size={18} strokeWidth={2} aria-hidden />
        <h3>Api · Catálogo de solo lectura</h3>
      </div>
      <p className="section-note">
        Consulta servicios, planes, clientes y equipos por API. Solo visualización: no recibe altas,
        cambios ni eliminaciones.
      </p>

      <div
        className="contable-tabs contable-period-tabs"
        role="tablist"
        aria-label="Subsecciones de Api"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subvista === 'servicios'}
          className={subvista === 'servicios' ? 'is-active' : ''}
          onClick={() => setSubvista('servicios')}
        >
          <FileText size={14} strokeWidth={2} aria-hidden />
          Servicios
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subvista === 'planes'}
          className={subvista === 'planes' ? 'is-active' : ''}
          onClick={() => setSubvista('planes')}
        >
          <Layers size={14} strokeWidth={2} aria-hidden />
          Planes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subvista === 'clientes'}
          className={subvista === 'clientes' ? 'is-active' : ''}
          onClick={() => setSubvista('clientes')}
        >
          <Users size={14} strokeWidth={2} aria-hidden />
          Clientes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subvista === 'equipos'}
          className={subvista === 'equipos' ? 'is-active' : ''}
          onClick={() => setSubvista('equipos')}
        >
          <Package size={14} strokeWidth={2} aria-hidden />
          Equipos
        </button>
      </div>

      <div className="av-api-toolbar">
        <code className="av-api-endpoint">{endpoint}</code>
        <div className="hero-actions">
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={16} strokeWidth={2} aria-hidden />
            Actualizar
          </button>
          <button type="button" className="btn-secondary" disabled={loading} onClick={handleDownloadDocs}>
            <Download size={16} strokeWidth={2} aria-hidden />
            Descargar docs (.txt)
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading || !rawJson}
            onClick={handleDownloadJson}
          >
            <Download size={16} strokeWidth={2} aria-hidden />
            Descargar JSON
          </button>
        </div>
      </div>

      <aside className="av-api-docs" aria-label="Documentación rápida">
        <h4>Documentación</h4>
        <ul>
          <li>
            <strong>Método:</strong> GET (solo lectura)
          </li>
          <li>
            <strong>Auth:</strong> Bearer token de Firebase
          </li>
          <li>
            <strong>Recurso:</strong> {meta.resource}
          </li>
          <li>
            <strong>Campos clave:</strong> {meta.campos}
          </li>
          <li>
            <strong>Mutaciones:</strong> no permitidas (HTTP 405)
          </li>
        </ul>
        <p>
          Usa «Descargar docs (.txt)» para la guía completa con ejemplos curl y el snapshot actual.
        </p>
      </aside>

      {error ? (
        <p className="proyectos-status proyectos-status-error" role="alert">
          <AlertCircle size={16} strokeWidth={2} aria-hidden />
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="proyectos-status">
          <LoaderCircle className="spin" size={22} strokeWidth={2} aria-hidden />
          Cargando catálogo...
        </div>
      ) : null}

      {!loading && subvista === 'servicios' ? (
        <div className="av-api-table-wrap">
          <table className="av-api-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {servicios.length === 0 ? (
                <tr>
                  <td colSpan={4}>No hay servicios en el catálogo.</td>
                </tr>
              ) : (
                servicios.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code>{item.referencia || '—'}</code>
                    </td>
                    <td>{item.nombre || '—'}</td>
                    <td>{item.descripcion || '—'}</td>
                    <td>{formatCop(item.costo)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && subvista === 'planes' ? (
        <div className="av-api-table-wrap">
          <table className="av-api-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Servicios</th>
              </tr>
            </thead>
            <tbody>
              {planes.length === 0 ? (
                <tr>
                  <td colSpan={5}>No hay planes en el catálogo.</td>
                </tr>
              ) : (
                planes.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.nombre || '—'}</td>
                    <td>{plan.descripcion || plan.resumen || '—'}</td>
                    <td>{formatCop(plan.precio)}</td>
                    <td>{plan.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      {(plan.servicios || [])
                        .map((svc) => `${svc.referencia || 's/c'}×${svc.unidades}`)
                        .join(', ') || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && subvista === 'clientes' ? (
        <div className="av-api-table-wrap">
          <table className="av-api-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Ciudad</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay clientes en el catálogo.</td>
                </tr>
              ) : (
                clientes.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nombre || '—'}</td>
                    <td>{item.documento || '—'}</td>
                    <td>{item.telefono || '—'}</td>
                    <td>{item.correo || '—'}</td>
                    <td>{item.ciudad || '—'}</td>
                    <td>{item.responsable || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && subvista === 'equipos' ? (
        <div className="av-api-table-wrap">
          <table className="av-api-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Valor</th>
                <th>Estado</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {equipos.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay equipos en el catálogo.</td>
                </tr>
              ) : (
                equipos.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code>{item.codigo || '—'}</code>
                    </td>
                    <td>{item.nombre || '—'}</td>
                    <td>{item.descripcion || '—'}</td>
                    <td>{formatCop(item.valorComercial)}</td>
                    <td>{item.estado === 'produccion' ? 'Producción' : 'Bodega'}</td>
                    <td>{item.responsableNombre || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && rawJson ? (
        <details className="av-api-raw">
          <summary>Respuesta JSON de la API</summary>
          <pre>{rawJson}</pre>
        </details>
      ) : null}
    </div>
  )
}
