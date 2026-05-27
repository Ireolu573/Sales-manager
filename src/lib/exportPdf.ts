/**
 * exportPdf.ts
 * Generates a clean, printable PDF sales report using jsPDF.
 * No external fonts needed — uses built-in Helvetica.
 *
 * Designed to be more shareable than Excel for non-technical stakeholders:
 * management, accountants, investors, etc.
 */

import type { Sale, StockRecord } from '@/lib/types'

interface PdfExportParams {
  sales: Sale[]
  stockRecords: StockRecord[]
  periodLabel: string       // e.g. "May 2026" or "01/05/2026 – 31/05/2026"
  companyName: string
  appName: string
  brandColor: string        // hex like "#d97706"
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [217, 119, 6]
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}

export async function exportPdfReport(params: PdfExportParams): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { sales, stockRecords, periodLabel, companyName, appName, brandColor } = params

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const [br, bg, bb] = hexToRgb(brandColor)
  const W = 210
  const margin = 14

  // ── helpers ────────────────────────────────────────────────
  const line = (y: number) => {
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.3)
    doc.line(margin, y, W - margin, y)
  }

  const brandLine = (y: number) => {
    doc.setDrawColor(br, bg, bb)
    doc.setLineWidth(0.6)
    doc.line(margin, y, W - margin, y)
  }

  // ── cover header ──────────────────────────────────────────
  doc.setFillColor(br, bg, bb)
  doc.rect(0, 0, W, 38, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName, margin, 15)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(appName, margin, 21)

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Sales Report', margin, 32)

  // Period pill
  doc.setFillColor(255, 255, 255, 0.25)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Period: ${periodLabel}`, W - margin, 32, { align: 'right' })

  doc.setTextColor(40, 40, 40)

  // ── KPI summary block ─────────────────────────────────────
  let y = 48
  const totalRevenue = sales.reduce((s, r) => s + Number(r.total_amount), 0)
  const totalQty = sales.reduce((s, r) => s + Number(r.quantity), 0)
  const totalStockCost = stockRecords.reduce((s, r) => s + Number(r.total_cost), 0)
  const estimatedProfit = totalRevenue - totalStockCost
  const cashRev = sales.filter(s => s.payment_method === 'cash').reduce((a, s) => a + Number(s.total_amount), 0)
  const transferRev = sales.filter(s => s.payment_method === 'transfer').reduce((a, s) => a + Number(s.total_amount), 0)
  const posRev = sales.filter(s => s.payment_method === 'pos').reduce((a, s) => a + Number(s.total_amount), 0)
  const creditRev = sales.filter(s => s.payment_method === 'credit').reduce((a, s) => a + Number(s.total_amount), 0)
  const unpaidCredit = sales.filter(s => s.payment_method === 'credit' && !s.paid_at).reduce((a, s) => a + Number(s.total_amount), 0)

  const kpis = [
    { label: 'Total Revenue', value: `N${totalRevenue.toLocaleString()}`, highlight: true },
    { label: 'Est. Profit', value: `N${estimatedProfit.toLocaleString()}`, highlight: estimatedProfit > 0 },
    { label: 'Items Sold', value: totalQty.toLocaleString() },
    { label: 'Stock Cost', value: `N${totalStockCost.toLocaleString()}` },
    { label: 'Cash', value: `N${cashRev.toLocaleString()}` },
    { label: 'Transfer', value: `N${transferRev.toLocaleString()}` },
    { label: 'POS', value: `N${posRev.toLocaleString()}` },
    { label: 'Credit (total)', value: `N${creditRev.toLocaleString()}` },
    { label: 'Unpaid Credit', value: `N${unpaidCredit.toLocaleString()}` },
    { label: 'Transactions', value: sales.length.toLocaleString() },
  ]

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(br, bg, bb)
  doc.text('Summary', margin, y)
  y += 5
  brandLine(y)
  y += 4

  const colW = (W - margin * 2) / 2
  kpis.forEach((kpi, i) => {
    const x = margin + (i % 2) * colW
    if (i % 2 === 0 && i > 0) y += 7
    else if (i % 2 === 0) {}

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(kpi.label, x, y)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(kpi.highlight ? br : 40, kpi.highlight ? bg : 40, kpi.highlight ? bb : 40)
    doc.text(kpi.value, x, y + 4.5)
  })
  y += 12

  // ── Top products ──────────────────────────────────────────
  const byItem: Record<string, { qty: number; revenue: number }> = {}
  for (const s of sales) {
    if (!byItem[s.item_name]) byItem[s.item_name] = { qty: 0, revenue: 0 }
    byItem[s.item_name].qty += Number(s.quantity)
    byItem[s.item_name].revenue += Number(s.total_amount)
  }
  const topProducts = Object.entries(byItem)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 8)

  if (topProducts.length > 0) {
    line(y); y += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(br, bg, bb)
    doc.text('Top Products by Revenue', margin, y)
    y += 5
    brandLine(y); y += 4

    topProducts.forEach(([name, stats], idx) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(40, 40, 40)
      doc.text(`${idx + 1}. ${name}`, margin, y)
      doc.setFont('helvetica', 'bold')
      doc.text(`N${stats.revenue.toLocaleString()}`, W - margin, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(140, 140, 140)
      doc.text(`${stats.qty} units sold`, W - margin - 35, y)
      y += 6
    })
  }

  // ── Sales table ───────────────────────────────────────────
  if (sales.length > 0) {
    y += 4
    if (y > 240) { doc.addPage(); y = 18 }
    line(y); y += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(br, bg, bb)
    doc.text('Transaction Detail', margin, y)
    y += 5
    brandLine(y); y += 4

    // Table header
    const cols = [
      { label: 'Date', x: margin, w: 22 },
      { label: 'Item', x: margin + 22, w: 52 },
      { label: 'Qty', x: margin + 74, w: 14 },
      { label: 'Unit Price', x: margin + 88, w: 28 },
      { label: 'Total', x: margin + 116, w: 30 },
      { label: 'Payment', x: margin + 146, w: 24 },
    ]

    doc.setFillColor(245, 245, 245)
    doc.rect(margin, y - 4, W - margin * 2, 7, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80, 80, 80)
    cols.forEach(c => doc.text(c.label, c.x, y))
    y += 4

    const recentSales = sales.slice(0, 50) // cap at 50 rows per page
    recentSales.forEach((s, idx) => {
      if (y > 275) { doc.addPage(); y = 18 }
      if (idx % 2 === 0) {
        doc.setFillColor(252, 252, 252)
        doc.rect(margin, y - 3.5, W - margin * 2, 6.5, 'F')
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(40, 40, 40)
      doc.text(s.sale_date, cols[0].x, y)
      doc.text(s.item_name.length > 28 ? s.item_name.slice(0, 28) + '…' : s.item_name, cols[1].x, y)
      doc.text(String(s.quantity), cols[2].x, y)
      doc.text(`N${Number(s.unit_price).toLocaleString()}`, cols[3].x, y)
      doc.setFont('helvetica', 'bold')
      doc.text(`N${Number(s.total_amount).toLocaleString()}`, cols[4].x, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(s.payment_method.toUpperCase(), cols[5].x, y)
      y += 6.5
    })

    if (sales.length > 50) {
      doc.setFontSize(7.5)
      doc.setTextColor(140, 140, 140)
      doc.setFont('helvetica', 'italic')
      doc.text(`+ ${sales.length - 50} more transactions (export to Excel for the full list)`, margin, y + 2)
    }
  }

  // ── Footer on all pages ───────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFillColor(br, bg, bb)
    doc.rect(0, 290, W, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${companyName} · ${appName} · Generated ${new Date().toLocaleDateString('en-NG')}`,
      W / 2, 294.5, { align: 'center' }
    )
    doc.text(`Page ${p} of ${pageCount}`, W - margin, 294.5, { align: 'right' })
  }

  doc.save(`${companyName.replace(/\s+/g, '-')}-report-${periodLabel.replace(/\s+/g, '-')}.pdf`)
}
