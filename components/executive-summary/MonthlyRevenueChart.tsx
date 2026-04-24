'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { MonthlyRow } from '@/lib/types'

export function MonthlyRevenueChart({ data }: { data: MonthlyRow[] }) {
  const chartData = data.map(d => ({
    month: d.month.slice(0, 3),
    revenue: d.revenue,
  }))

  return (
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-4">Monthly Revenue</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#44403c" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip
            contentStyle={{ background: '#292524', border: '1px solid #44403c', borderRadius: '6px' }}
            labelStyle={{ color: '#e7e5e4', fontWeight: 600 }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
            cursor={{ fill: '#44403c' }}
          />
          <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
