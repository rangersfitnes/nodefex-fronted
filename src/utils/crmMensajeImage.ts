import type { AvCrmMensajeImagenPayload } from '../api/audiovisual'

const MAX_SIDE = 1600
const TARGET_BYTES = 450 * 1024
const HARD_MAX_BYTES = 1.5 * 1024 * 1024
const QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42, 0.34]

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality)
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('No se pudo leer la imagen comprimida'))
    reader.readAsDataURL(blob)
  })
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(
        new Error(
          'No se pudo leer la imagen. Usa JPG, PNG o WebP (HEIC de iPhone no es compatible).',
        ),
      )
    }
    img.src = objectUrl
  })
}

/**
 * Comprime una imagen para mensajes rápidos del CRM (JPEG).
 * Evita payloads enormes que rompen el guardado / JSON.
 */
export async function compressCrmMensajeImage(file: File): Promise<AvCrmMensajeImagenPayload> {
  if (!file || file.size <= 0) {
    throw new Error('La imagen está vacía')
  }

  const image = await loadImageFromFile(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width || 1, image.height || 1))
  const width = Math.max(1, Math.round((image.width || 1) * scale))
  const height = Math.max(1, Math.round((image.height || 1) * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  let best: { blob: Blob; dataBase64: string } | null = null
  for (const quality of QUALITIES) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    if (!blob || blob.size <= 0) continue
    const dataBase64 = await blobToBase64(blob)
    best = { blob, dataBase64 }
    if (blob.size <= TARGET_BYTES) break
  }

  if (!best) throw new Error('No se pudo comprimir la imagen')
  if (best.blob.size > HARD_MAX_BYTES) {
    throw new Error('La imagen sigue siendo muy pesada. Prueba otra con menor resolución.')
  }

  const baseName = (file.name || 'imagen').replace(/\.[^.]+$/, '') || 'imagen'
  return {
    dataBase64: best.dataBase64,
    mimetype: 'image/jpeg',
    fileName: `${baseName}.jpg`.slice(0, 180),
  }
}
