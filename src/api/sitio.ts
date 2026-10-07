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

export type SitioMediaSlot = 'hero-bg' | 'band-bg' | `project-${number}`

export const MAX_SITIO_PROJECTS = 12

export type SitioServiceItem = {
  title: string
}

export type SitioProjectItem = {
  name: string
  category: string
  description: string
  href: string
  mediaSlot: SitioMediaSlot
}

export function projectMediaSlot(index: number): SitioMediaSlot {
  return `project-${index}` as SitioMediaSlot
}

export function nextProjectMediaSlot(projects: SitioProjectItem[]): SitioMediaSlot {
  const used = new Set(projects.map((project) => project.mediaSlot))
  for (let i = 0; i < MAX_SITIO_PROJECTS; i += 1) {
    const slot = projectMediaSlot(i)
    if (!used.has(slot)) return slot
  }
  return projectMediaSlot(0)
}

export type SitioSocialItem = {
  label: string
  href: string
}

export type SitioWebContent = {
  brand: string
  navCta: string
  /** Texto único del hero minimalista (ej. WE BUILD.). */
  heroTitle: string
  heroEyebrow: string
  heroTitleLine1: string
  heroTitleLine2: string
  heroCta: string
  servicesTitle: string
  services: SitioServiceItem[]
  projectsTitle: string
  projectsCta: string
  projects: SitioProjectItem[]
  bandBrand: string
  bandTitleLine1: string
  bandTitleLine2: string
  footerContactLabel: string
  legalCompanyName: string
  legalNit: string
  legalAddress: string
  legalCity: string
  legalEmail: string
  legalPhone: string
  termsText: string
  privacyText: string
  socials: SitioSocialItem[]
  media: Record<
    string,
    {
      storagePath: string | null
      url: string
      mimeType: string | null
      fileName: string | null
    }
  >
  mediaUrls: Partial<Record<SitioMediaSlot, string>>
  updatedAt: string | null
}

export type SitioWebPayload = {
  brand: string
  navCta: string
  heroTitle: string
  heroEyebrow?: string
  heroTitleLine1?: string
  heroTitleLine2?: string
  heroCta?: string
  servicesTitle: string
  services: SitioServiceItem[]
  projectsTitle: string
  projectsCta: string
  projects: SitioProjectItem[]
  bandBrand?: string
  bandTitleLine1?: string
  bandTitleLine2?: string
  footerContactLabel: string
  legalCompanyName: string
  legalNit: string
  legalAddress: string
  legalCity: string
  legalEmail: string
  legalPhone: string
  termsText: string
  privacyText: string
  socials: SitioSocialItem[]
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

export async function getSitioWeb(): Promise<SitioWebContent> {
  const response = await fetch(`${API_URL}/api/sitio/web`)
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const data = (await response.json()) as { content: SitioWebContent }
  return data.content
}

export async function saveSitioWeb(
  token: string,
  payload: SitioWebPayload,
): Promise<SitioWebContent> {
  const response = await fetch(`${API_URL}/api/sitio/web`, {
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
  const data = (await response.json()) as { content: SitioWebContent }
  return data.content
}

export async function uploadSitioWebMedia(
  token: string,
  slot: SitioMediaSlot,
  payload: {
    fileName: string
    mimeType: string
    contentBase64: string
  },
): Promise<SitioWebContent> {
  const response = await fetch(`${API_URL}/api/sitio/web/media/${encodeURIComponent(slot)}`, {
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
  const data = (await response.json()) as { content: SitioWebContent }
  return data.content
}

export async function deleteSitioWebMedia(
  token: string,
  slot: SitioMediaSlot,
): Promise<SitioWebContent> {
  const response = await fetch(`${API_URL}/api/sitio/web/media/${encodeURIComponent(slot)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    throw new Error(await parseError(response))
  }
  const data = (await response.json()) as { content: SitioWebContent }
  return data.content
}
