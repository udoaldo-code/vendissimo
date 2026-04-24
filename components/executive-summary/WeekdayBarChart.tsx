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
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-2">Revenue by Day</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#a8a29e', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ background: '#292524', border: '1px solid #44403c', borderRadius: '6px' }}
            labelStyle={{ color: '#e7e5e4' }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
            cursor={{ fill: '#44403c' }}
          />
          <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={30}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.revenue === maxRev ? '#fbbf24' : '#f97316'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
