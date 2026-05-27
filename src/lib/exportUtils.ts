/**
 * exportUtils.ts
 * Isolated Excel export logic extracted from Analytics.tsx.
 * Import and call exportSalesReport() wherever needed.
 */

import type { Sale, StockRecord } from '@/lib/types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export interface ExportParams {
  sales: Sale[]
  stockRecords: StockRecord[]
  monthSales: Sale[]
  monthStock: StockRecord[]
  selectedMonth: number
  selectedYear: number
  filterMode: 'month' | 'range'
  dateFrom: string
  dateTo: string
  exportAll: boolean
}

export async function exportSalesReport(params: ExportParams): Promise<void> {
  const {
    sales, stockRecords, monthSales, monthStock,
    selectedMonth, selectedYear, filterMode, dateFrom, dateTo, exportAll,
  } = params

  const XLSX = await import('xlsx')

  const salesData = exportAll ? sales : monthSales
  const stockData = exportAll ? stockRecords : monthStock
  const period = exportAll
    ? String(selectedYear)
    : filterMode === 'month'
      ? `${MONTHS[selectedMonth]}-${selectedYear}`
      : `${dateFrom}-to-${dateTo}`

  const salesObjects = salesData.map(s => ({
    'Date': s.sale_date,
    'Time': s.created_at
      ? new Date(s.created_at as string).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '',
    'Item': s.item_name,
    'Quantity': Number(s.quantity),
    'Total (₦)': Number(s.total_amount),
    'Payment': s.payment_method,
    'Customer': s.customer_name || '',
    'Notes': s.notes || '',
  }))

  const stockObjects = stockData.map(s => ({
    'Date': s.stock_date,
    'Item': s.item_name,
    'Quantity': Number(s.quantity),
    'Total Cost (₦)': Number(s.total_cost),
    'Notes': s.notes || '',
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesObjects), 'Sales')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockObjects), 'Stock Records')
  XLSX.writeFile(wb, `report-${period}.xlsx`, { bookType: 'xlsx', compression: true })
}
