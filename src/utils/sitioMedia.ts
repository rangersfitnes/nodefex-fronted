import { API_URL } from '../config'
import type { SitioMediaSlot } from '../api/sitio'

type CompressResult = {
  fileName: string
  mimeType: string
  contentBase64: string
  size: number
}

type SlotCompressProfile = {
  maxSide: number
  targetBytes: number
  hardMaxBytes: number
}

function profileForSlot(slot: SitioMediaSlot | string): SlotCompressProfile {
  if (slot === 'hero-bg' || slot === 'band-bg') {
    return { maxSide: 1600, targetBytes: 280 * 1024, hardMaxBytes: 420 * 1024 }
  }
  return { maxSide: 900, targetBytes: 140 * 1024, hardMaxBytes: 220 * 1024 }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality)
  })
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function supportsWebpEncode(canvas: HTMLCanvasElement): Promise<boolean> {
  const blob = await canvasToBlob(canvas, 'image/webp', 0.8)
  return Boolean(blob && blob.type === 'image/webp' && blob.size > 0)
}

/** Resuelve src usable en <img> (API relativa → URL absoluta). */
export function resolveSitioMediaSrc(url?: string | null): string {
  if (!url) return ''
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url
  }
  if (url.startsWith('/')) return `${API_URL}${url}`
  return url
}

/**
 * Comprime una imagen para el sitio público.
 * Prioriza WebP, baja resolución según el slot y apunta a pesos bajos.
 */
export async function compressSitioImage(
  source: File | Blob,
  slot: SitioMediaSlot | string,
  originalName = 'imagen',
): Promise<CompressResult> {
  const profile = profileForSlot(slot)
  const objectUrl = URL.createObjectURL(source)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo leer la imagen'))
      img.src = objectUrl
    })

    const scale = Math.min(1, profile.maxSide / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo procesar la imagen')
    ctx.fillStyle = '#05070d'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    const useWebp = await supportsWebpEncode(canvas)
    const mimeType = useWebp ? 'image/webp' : 'image/jpeg'
    const extension = useWebp ? 'webp' : 'jpg'
    const qualities = useWebp
      ? [0.78, 0.68, 0.58, 0.48, 0.38]
      : [0.78, 0.66, 0.54, 0.42, 0.32]

    let best: CompressResult | null = null
    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, mimeType, quality)
      if (!blob) continue
      const contentBase64 = await blobToBase64(blob)
      best = {
        fileName: `${originalName.replace(/\.[^.]+$/, '') || 'imagen'}.${extension}`,
        mimeType,
        contentBase64,
        size: blob.size,
      }
      if (blob.size <= profile.targetBytes) break
    }

    if (!best?.contentBase64) throw new Error('No se pudo comprimir la imagen')
    if (best.size > profile.hardMaxBytes) {
      throw new Error(
        'La imagen sigue siendo muy pesada. Prueba otra con menor resolución.',
      )
    }
    return best
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function compressSitioImageFromUrl(
  url: string,
  slot: SitioMediaSlot | string,
): Promise<CompressResult> {
  const src = resolveSitioMediaSrc(url)
  const response = await fetch(src, { mode: 'cors' })
  if (!response.ok) throw new Error('No se pudo leer la imagen actual')
  const blob = await response.blob()
  return compressSitioImage(blob, slot, `${slot}`)
}
