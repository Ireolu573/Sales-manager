import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { MONTHS } from '@/hooks/useDateRangeFilter'

interface Props {
  filterMode: 'month' | 'range'
  setFilterMode: (m: 'month' | 'range') => void
  selectedMonth: number
  setSelectedMonth: (m: number) => void
  selectedYear: number
  setSelectedYear: (y: number) => void
  dateFrom: string
  setDateFrom: (d: string) => void
  dateTo: string
  setDateTo: (d: string) => void
  years: number[]
}

export default function ReportFilterBar({
  filterMode, setFilterMode, selectedMonth, setSelectedMonth,
  selectedYear, setSelectedYear, dateFrom, setDateFrom, dateTo, setDateTo, years,
}: Props) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex bg-muted rounded-lg p-0.5 w-fit">
          <button onClick={() => setFilterMode('month')}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${filterMode === 'month' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
            By month
          </button>
          <button onClick={() => setFilterMode('range')}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${filterMode === 'range' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
            Date range
          </button>
        </div>

        {filterMode === 'month' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-auto" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-auto" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
