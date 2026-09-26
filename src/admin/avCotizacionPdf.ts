import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCop } from '../api/administradores'
import type { AvCotizacion, AvEmpresaGenio } from '../api/audiovisual'

/** Paleta oficial Genio (manual creativo) */
const GENIO = {
  blue: [0, 3, 255] as [number, number, number],
  blueMid: [4, 89, 255] as [number, number, number],
  orange: [255, 106, 0] as [number, number, number],
  orangeSoft: [255, 166, 93] as [number, number, number],
  ink: [20, 24, 40] as [number, number, number],
  muted: [90, 98, 120] as [number, number, number],
  line: [220, 226, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  wash: [248, 250, 255] as [number, number, number],
}

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
  }).format(new Date(iso))
}

async function loadBrandImage(path: string): Promise<string | null> {
  try {
    const response = await fetch(path)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export type AvCotizacionPdfBuilt = {
  fileName: string
  blob: Blob
  base64: string
}

async function buildAvCotizacionPdfDoc(
  cotizacion: AvCotizacion,
  empresaFallback?: AvEmpresaGenio | null,
): Promise<{ doc: jsPDF; fileName: string }> {
  const empresa = cotizacion.empresaSnapshot || empresaFallback || null
  const [logoData, iconWhite, iconBlue] = await Promise.all([
    loadBrandImage('/genio/logo-elgenio.png'),
    loadBrandImage('/genio/logo-icon-white.png'),
    loadBrandImage('/genio/logo-icon.png'),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 42

  // Barra superior naranja marca
  doc.setFillColor(...GENIO.orange)
  doc.rect(0, 0, pageW, 10, 'F')

  // Header azul Genio
  const headerH = 108
  doc.setFillColor(...GENIO.blue)
  doc.rect(0, 10, pageW, headerH, 'F')

  // Acento azul medio
  doc.setFillColor(...GENIO.blueMid)
  doc.rect(0, 10 + headerH, pageW, 5, 'F')

  // Wordmark blanco sobre azul (placa opaca, se funde con el header)
  const logoH = 76
  const logoW = logoData ? Math.round(logoH * (279 / 300)) : 0
  if (logoData) {
    doc.addImage(logoData, 'PNG', marginX - 4, 24, logoW, logoH)
  } else {
    doc.setTextColor(...GENIO.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('EL GENIO', marginX, 70)
  }

  const textLeft = marginX + (logoData ? logoW + 10 : 0)
  doc.setTextColor(...GENIO.white)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Agencia creativa  |  Marketing de contenidos', textLeft, 58)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...GENIO.orangeSoft)
  doc.text('COTIZACIÓN', pageW - marginX, 42, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...GENIO.white)
  doc.text(cotizacion.numero || '—', pageW - marginX, 60, { align: 'right' })

  if (iconWhite) {
    // gafas blancas sobre azul (mismo fondo que el header)
    doc.addImage(iconWhite, 'PNG', pageW - marginX - 52, 68, 52, 26)
  }

  let y = 10 + headerH + 18

  // Bloque empresa
  doc.setFillColor(...GENIO.wash)
  doc.roundedRect(marginX, y, pageW - marginX * 2, 78, 8, 8, 'F')
  doc.setDrawColor(...GENIO.orange)
  doc.setLineWidth(2.5)
  doc.line(marginX, y, marginX, y + 78)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...GENIO.blue)
  doc.text(
    empresa?.nombreComercial || empresa?.razonSocial || 'El Genio',
    marginX + 12,
    y + 18,
  )

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GENIO.muted)
  const empresaLines = [
    empresa?.razonSocial && empresa.razonSocial !== empresa.nombreComercial
      ? empresa.razonSocial
      : null,
    empresa?.nit ? `NIT ${empresa.nit}` : null,
    [empresa?.correo, empresa?.telefono].filter(Boolean).join('  ·  ') || null,
    [empresa?.direccion, empresa?.ciudad].filter(Boolean).join(', ') || null,
    empresa?.sitioWeb || null,
  ].filter(Boolean) as string[]

  let ey = y + 34
  for (const line of empresaLines.slice(0, 3)) {
    doc.text(line, marginX + 12, ey)
    ey += 12
  }

  y += 96

  // Datos cliente / fecha
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...GENIO.orange)
  doc.text('CLIENTE', marginX, y)
  doc.text('FECHA', pageW / 2 + 10, y)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GENIO.ink)
  doc.text(cotizacion.clienteNombre || '—', marginX, y)
  doc.text(formatFecha(cotizacion.creadoEn), pageW / 2 + 10, y)
  y += 14

  doc.setFontSize(9)
  doc.setTextColor(...GENIO.muted)
  const clienteMeta = [
    cotizacion.clienteDocumento ? `Doc. ${cotizacion.clienteDocumento}` : null,
    cotizacion.clienteCorreo || null,
    cotizacion.clienteTelefono || null,
  ].filter(Boolean) as string[]
  if (clienteMeta.length) {
    doc.text(clienteMeta.join('  ·  '), marginX, y)
    y += 16
  } else {
    y += 6
  }

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Valor']],
    body: cotizacion.items.map((item) => [item.concepto, formatCop(item.valor)]),
    foot: [['Subtotal', formatCop(cotizacion.subtotal)]],
    theme: 'plain',
    headStyles: {
      fillColor: GENIO.blue,
      textColor: GENIO.white,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 8,
    },
    bodyStyles: {
      textColor: GENIO.ink,
      fontSize: 10,
      cellPadding: 7,
      lineColor: GENIO.line,
      lineWidth: 0.4,
    },
    alternateRowStyles: {
      fillColor: GENIO.wash,
    },
    footStyles: {
      fillColor: GENIO.orange,
      textColor: GENIO.white,
      fontStyle: 'bold',
      fontSize: 11,
      cellPadding: 8,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 120, halign: 'right' },
    },
    margin: { left: marginX, right: marginX },
    tableLineColor: GENIO.line,
    tableLineWidth: 0.3,
  })

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40

  let cursor = finalY + 28
  if (iconBlue) {
    doc.addImage(iconBlue, 'PNG', marginX, cursor - 8, 26, 13)
  } else {
    doc.setFillColor(...GENIO.blue)
    doc.circle(marginX + 4, cursor - 3, 3.5, 'F')
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...GENIO.blue)
  doc.text('Resumen', marginX + 32, cursor)
  cursor += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...GENIO.ink)
  const resumenLines = doc.splitTextToSize(cotizacion.resumen || '—', pageW - marginX * 2)
  doc.text(resumenLines, marginX, cursor)
  cursor += resumenLines.length * 13 + 18

  // Caja cierre marca
  if (cursor < pageH - 90) {
    doc.setFillColor(...GENIO.blue)
    doc.roundedRect(marginX, cursor, pageW - marginX * 2, 42, 8, 8, 'F')
    doc.setTextColor(...GENIO.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Tú sabes lo que deseas', marginX + 14, cursor + 18)
    doc.setTextColor(...GENIO.orangeSoft)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.text('y El Genio pone la magia', marginX + 14, cursor + 32)
  }

  // Footer naranja
  doc.setFillColor(...GENIO.orange)
  doc.rect(0, pageH - 28, pageW, 28, 'F')
  doc.setTextColor(...GENIO.white)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const footerBits = [
    empresa?.sitioWeb || 'elgenio.co',
    empresa?.correo || null,
    empresa?.telefono || null,
    '@elgenio',
  ].filter(Boolean)
  doc.text(footerBits.join('   ·   '), pageW / 2, pageH - 12, { align: 'center' })

  const safeClient = (cotizacion.clienteNombre || 'cliente')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 40)
  const fileName = `${cotizacion.numero || 'COT'}_${safeClient}.pdf`
  return { doc, fileName }
}

export async function buildAvCotizacionPdf(
  cotizacion: AvCotizacion,
  empresaFallback?: AvEmpresaGenio | null,
): Promise<AvCotizacionPdfBuilt> {
  const { doc, fileName } = await buildAvCotizacionPdfDoc(cotizacion, empresaFallback)
  const dataUri = doc.output('datauristring') as string
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri
  const ab = doc.output('arraybuffer') as ArrayBuffer
  const blob = new Blob([ab], { type: 'application/pdf' })
  return { fileName, blob, base64 }
}

export async function downloadAvCotizacionPdf(
  cotizacion: AvCotizacion,
  empresaFallback?: AvEmpresaGenio | null,
): Promise<void> {
  const { doc, fileName } = await buildAvCotizacionPdfDoc(cotizacion, empresaFallback)
  doc.save(fileName)
}
