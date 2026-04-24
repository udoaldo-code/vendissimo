'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { MachineRow } from '@/lib/types'

const COLORS = ['#f97316', '#fbbf24', '#ef4444', '#fb923c']

export function LocationPieChart({ machines }: { machines: MachineRow[] }) {
  const byLocation = machines.reduce<Record<string, number>>((acc, m) => {
    acc[m.location] = (acc[m.location] ?? 0) + m.revenue
    return acc
  }, {})

  const data = Object.entries(byLocation).map(([name, value]) => ({ name, value }))

  return (
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-2">Revenue by Location</p>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map(({ name }, i) => (
              <Cell key={name} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#292524', border: '1px solid #44403c', borderRadius: '6px' }}
            labelStyle={{ color: '#e7e5e4' }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
          />
          <Legend
            formatter={value => <span style={{ color: '#a8a29e', fontSize: 11 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
