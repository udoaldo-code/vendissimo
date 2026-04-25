import type { ProductRow } from '@/lib/types'

const CATEGORY_COLORS: Record<string, string> = {
  'Water': '#0ea5e9',
  'Energy Drink': '#7c3aed',
  'Sports Drink': '#10b981',
  'Dairy': '#f59e0b',
  'Soda': '#8b5cf6',
  'Food': '#ec4899',
  'Soy Drink': '#14b8a6',
}

export function TopProductsTable({ products }: { products: ProductRow[] }) {
  const maxRevenue = products[0]?.revenue || 1

  return (
    <div className="bg-white rounded-lg p-4 border border-[#ede9fe] shadow-sm">
      <p className="text-[#9ca3af] text-xs uppercase tracking-wider mb-4">Product Performance</p>
      <div className="space-y-3">
        {products.map((p, i) => (
          <div key={p.product}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[#9ca3af] text-xs w-5 text-right shrink-0">{i + 1}</span>
                <span className="text-[#1e1b4b] text-sm truncate">{p.product}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded text-white font-medium shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[p.category] ?? '#6b7280' }}
                >
                  {p.category}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#6b7280] shrink-0">
                <span className="hidden sm:inline">{p.unitsSold.toLocaleString()} units</span>
                <span className="text-[#1e1b4b] font-medium w-20 text-right">
                  ${p.revenue.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0" />
              <div className="flex-1 bg-[#f5f3ff] rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-[#7c3aed]"
                  style={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="text-[#9ca3af] text-xs w-10 text-right">{p.revenueShare.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
