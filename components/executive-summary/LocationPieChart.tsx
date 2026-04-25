'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { MachineRow } from '@/lib/types'

const COLORS = ['#7c3aed', '#ec4899', '#8b5cf6', '#f472b6']

export function LocationPieChart({ machines }: { machines: MachineRow[] }) {
  const byLocation = machines.reduce<Record<string, number>>((acc, m) => {
    acc[m.location] = (acc[m.location] ?? 0) + m.revenue
    return acc
  }, {})

  const data = Object.entries(byLocation).map(([name, value]) => ({ name, value }))

  return (
    <div className="bg-white rounded-lg p-4 border border-[#ede9fe] shadow-sm">
      <p className="text-[#9ca3af] text-xs uppercase tracking-wider mb-2">Revenue by Location</p>
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
            contentStyle={{ background: '#ffffff', border: '1px solid #ede9fe', borderRadius: '6px' }}
            labelStyle={{ color: '#1e1b4b' }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
          />
          <Legend
            formatter={value => <span style={{ color: '#6b7280', fontSize: 11 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
