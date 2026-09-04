import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCop } from '../api/administradores'
import type { ContableMovimiento } from '../api/contable'

export type ContableReportData = {
  desde: string
  hasta: string
  ingresos: ContableMovimiento[]
  egresos: ContableMovimiento[]
}

function totalValor(items: ContableMovimiento[]): number {
  return items.reduce((sum, item) => sum + (Number(item.valor) || 0), 0)
}

function formatFechaCorta(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function fileStamp(desde: string, hasta: string): string {
  return desde === hasta ? desde : `${desde}_${hasta}`
}

function movimientoRows(items: ContableMovimiento[]) {
  return items.map((item) => [
    formatFechaCorta(item.fecha),
    item.programa || '—',
    item.clienteNombre || item.nombre || '—',
    item.concepto || '—',
    item.categoria || '—',
    item.metodoPago || '—',
    item.referencia || '—',
    item.valor != null ? Number(item.valor) : 0,
    item.estado || '—',
  ])
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function buildContableXlsx(data: ContableReportData): void {
  const book = XLSX.utils.book_new()
  const headers = [
    'Fecha',
    'Programa',
    'Cliente',
    'Concepto',
    'Categoría',
    'Método',
    'Referencia',
    'Valor',
    'Estado',
  ]

  const resumenSheet = XLSX.utils.aoa_to_sheet([
    ['Nodefex Contable — Reporte'],
    ['Desde', data.desde],
    ['Hasta', data.hasta],
    [],
    ['Tipo', 'Cantidad', 'Total COP'],
    ['Ingresos', data.ingresos.length, totalValor(data.ingresos)],
    ['Egresos', data.egresos.length, totalValor(data.egresos)],
    [
      'Balance (ingresos - egresos)',
      '',
      totalValor(data.ingresos) - totalValor(data.egresos),
    ],
  ])
  XLSX.utils.book_append_sheet(book, resumenSheet, 'Resumen')

  const ingresosSheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...movimientoRows(data.ingresos),
  ])
  XLSX.utils.book_append_sheet(book, ingresosSheet, 'Ingresos')

  const egresosSheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...movimientoRows(data.egresos),
  ])
  XLSX.utils.book_append_sheet(book, egresosSheet, 'Egresos')

  const buffer = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  downloadBlob(
    `nodefex-contable-${fileStamp(data.desde, data.hasta)}.xlsx`,
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
}

export function buildContablePdf(data: ContableReportData): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margin = 36
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Nodefex Contable — Reporte', margin, y)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Periodo: ${data.desde} → ${data.hasta}`, margin, y)
  y += 16
  doc.text(
    `Ingresos: ${data.ingresos.length} · ${formatCop(totalValor(data.ingresos))}`,
    margin,
    y,
  )
  y += 14
  doc.text(
    `Egresos: ${data.egresos.length} · ${formatCop(totalValor(data.egresos))}`,
    margin,
    y,
  )
  y += 14
  doc.text(
    `Balance: ${formatCop(totalValor(data.ingresos) - totalValor(data.egresos))}`,
    margin,
    y,
  )
  y += 18

  const headers = [
    ['Fecha', 'Programa', 'Cliente', 'Concepto', 'Categoría', 'Método', 'Referencia', 'Valor', 'Estado'],
  ]

  const tableOptions = {
    head: headers,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: {
      fillColor: [15, 45, 90] as [number, number, number],
      textColor: 255,
    },
    margin: { left: margin, right: margin },
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Ingresos', margin, y)
  y += 8

  autoTable(doc, {
    ...tableOptions,
    startY: y,
    body: movimientoRows(data.ingresos).map((row) => [
      ...row.slice(0, 7),
      formatCop(Number(row[7]) || 0),
      row[8],
    ]),
  })

  const afterIngresos =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20

  let nextY = afterIngresos + 24
  if (nextY > doc.internal.pageSize.getHeight() - 120) {
    doc.addPage()
    nextY = margin
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Egresos', margin, nextY)
  nextY += 8

  autoTable(doc, {
    ...tableOptions,
    startY: nextY,
    body: movimientoRows(data.egresos).map((row) => [
      ...row.slice(0, 7),
      formatCop(Number(row[7]) || 0),
      row[8],
    ]),
  })

  doc.save(`nodefex-contable-${fileStamp(data.desde, data.hasta)}.pdf`)
}
