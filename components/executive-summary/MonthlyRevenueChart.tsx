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
    <div className="bg-white rounded-lg p-4 border border-[#ede9fe] shadow-sm">
      <p className="text-[#9ca3af] text-xs uppercase tracking-wider mb-4">Monthly Revenue</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ede9fe" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip
            contentStyle={{ background: '#ffffff', border: '1px solid #ede9fe', borderRadius: '6px' }}
            labelStyle={{ color: '#1e1b4b', fontWeight: 600 }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
            cursor={{ fill: '#f5f3ff' }}
          />
          <Bar dataKey="revenue" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
