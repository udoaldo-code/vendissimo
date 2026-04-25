'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { WeekdayRevenue } from '@/lib/types'

export function WeekdayBarChart({ data }: { data: WeekdayRevenue }) {
  const chartData = [
    { day: 'Sun', revenue: data.sun },
    { day: 'Mon', revenue: data.mon },
    { day: 'Tue', revenue: data.tue },
    { day: 'Wed', revenue: data.wed },
    { day: 'Thu', revenue: data.thu },
    { day: 'Fri', revenue: data.fri },
    { day: 'Sat', revenue: data.sat },
  ]
  const maxRev = Math.max(...chartData.map(d => d.revenue))

  return (
    <div className="bg-white rounded-lg p-4 border border-[#ede9fe] shadow-sm">
      <p className="text-[#9ca3af] text-xs uppercase tracking-wider mb-2">Revenue by Day</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #ede9fe', borderRadius: '6px' }}
            labelStyle={{ color: '#1e1b4b' }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
            cursor={{ fill: '#f5f3ff' }}
          />
          <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={30}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.revenue === maxRev ? '#ec4899' : '#7c3aed'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
