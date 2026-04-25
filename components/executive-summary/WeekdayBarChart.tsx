'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { DailyRevenue } from '@/lib/types'
import type { DatePreset } from './DateFilter'
import { parseTransactionDate } from '@/lib/filter-utils'

function fmtDateLabel(dateStr: string): string {
  const d = parseTransactionDate(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

type Props = {
  daily: DailyRevenue[]
  preset: DatePreset
}

export function WeekdayBarChart({ daily, preset }: Props) {
  // For All Time, cap to last 30 days
  const source = preset === 'all' ? daily.slice(-30) : daily
  const chartData = source.map(d => ({ label: fmtDateLabel(d.date), revenue: d.revenue }))

  const maxRev = Math.max(...chartData.map(d => d.revenue), 0)
  const manyBars = chartData.length > 14

  return (
    <div className="bg-white rounded-lg p-4 border border-[#ede9fe] shadow-sm">
      <p className="text-[#9ca3af] text-xs uppercase tracking-wider mb-2">Revenue by Date</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: manyBars ? 20 : 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: manyBars ? 9 : 11 }}
            axisLine={false}
            tickLine={false}
            angle={manyBars ? -45 : 0}
            textAnchor={manyBars ? 'end' : 'middle'}
            interval={manyBars ? 'preserveStartEnd' : 0}
          />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #ede9fe', borderRadius: '6px' }}
            labelStyle={{ color: '#1e1b4b' }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
            cursor={{ fill: '#f5f3ff' }}
          />
          <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={30}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.revenue === maxRev ? '#16a34a' : '#7c3aed'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
