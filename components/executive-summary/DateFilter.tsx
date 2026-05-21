'use client'

export type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom'

type Props = {
  preset: DatePreset
  dateFrom: string
  dateTo: string
  onChange: (preset: DatePreset, dateFrom: string, dateTo: string) => void
}

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom' },
]

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function isoOffset(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

export function DateFilter({ preset, dateFrom, dateTo, onChange }: Props) {
  function selectPreset(p: DatePreset) {
    if (p === 'all') onChange(p, '', '')
    else if (p === 'today') { const t = isoToday(); onChange(p, t, t) }
    else if (p === '7d') onChange(p, isoOffset(6), isoToday())
    else if (p === '30d') onChange(p, isoOffset(29), isoToday())
    else onChange(p, dateFrom, dateTo)
  }

  const btn = (p: DatePreset) =>
    `px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
      preset === p
        ? 'bg-accent text-white border-accent shadow-sm'
        : 'bg-card text-muted-strong border-border hover:border-accent hover:text-accent'
    }`

  const dateInput = 'bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent'

  return (
    <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg px-4 py-3 shadow-sm">
      <span className="text-muted text-xs uppercase tracking-wider mr-1">Period</span>
      {PRESETS.map(({ key, label }) => (
        <button key={key} className={btn(key)} onClick={() => selectPreset(key)}>
          {label}
        </button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={dateFrom}
            onChange={e => onChange('custom', e.target.value, dateTo)}
            className={dateInput}
          />
          <span className="text-muted text-xs">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => onChange('custom', dateFrom, e.target.value)}
            className={dateInput}
          />
        </div>
      )}
      {preset !== 'all' && (dateFrom || dateTo) && (
        <span className="text-muted text-xs ml-1">
          {dateFrom}{dateFrom && dateTo && dateTo !== dateFrom ? ` → ${dateTo}` : ''}
        </span>
      )}
    </div>
  )
}
