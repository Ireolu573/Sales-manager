import { useState } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export { MONTHS }

export function useDateRangeFilter() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const inRange = (dateStr: string) => {
    if (filterMode === 'month') {
      const d = new Date(dateStr)
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    }
    const from = dateFrom || '2000-01-01'
    const to = dateTo || '2099-12-31'
    return dateStr >= from && dateStr <= to
  }

  const periodLabel = filterMode === 'month'
    ? `${MONTHS[selectedMonth]} ${selectedYear}`
    : `${dateFrom || '…'} to ${dateTo || '…'}`

  return {
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    filterMode, setFilterMode,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    inRange, periodLabel,
  }
}

export function yearsFromDates(dateLists: string[][], selectedYear: number) {
  return Array.from(new Set([
    ...dateLists.flat().map(d => new Date(d).getFullYear()),
    selectedYear,
  ])).sort().reverse()
}
