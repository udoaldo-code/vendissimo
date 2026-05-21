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
    <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
      <p className="text-muted text-xs uppercase tracking-wider mb-4">Monthly Revenue</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--color-muted-strong)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--color-muted-strong)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '6px' }}
            labelStyle={{ color: 'var(--color-foreground)', fontWeight: 600 }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
            cursor={{ fill: 'var(--color-surface-hover)' }}
          />
          <Bar dataKey="revenue" fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
