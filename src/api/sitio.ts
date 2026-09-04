import { API_URL } from '../config'

export type SitioContactoTipo = 'whatsapp' | 'tel' | 'url'

export type SitioContacto = {
  id: string
  activo: boolean
  etiqueta: string
  tipo: SitioContactoTipo
  valor: string
  href: string
  updatedAt: string | null
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string }
    if (data?.error) return data.error
  } catch {
    /* ignore */
  }
  return 'No se pudo completar la solicitud'
}

export async function getSitioContacto(): Promise<SitioContacto> {
  const response = await fetch(`${API_URL}/api/sitio/contacto`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const data = (await response.json()) as { contacto: SitioContacto }
  return data.contacto
}

export async function saveSitioContacto(
  token: string,
  payload: {
    activo: boolean
    etiqueta: string
    tipo: SitioContactoTipo
    valor: string
  },
): Promise<SitioContacto> {
  const response = await fetch(`${API_URL}/api/sitio/contacto`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const data = (await response.json()) as { contacto: SitioContacto }
  return data.contacto
}
