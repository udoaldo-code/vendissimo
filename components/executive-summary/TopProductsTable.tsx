import type { ProductRow } from '@/lib/types'

const CATEGORY_COLORS: Record<string, string> = {
  'Water': '#38bdf8',
  'Energy Drink': '#f97316',
  'Sports Drink': '#34d399',
  'Dairy': '#fbbf24',
  'Soda': '#a78bfa',
  'Food': '#fb7185',
  'Soy Drink': '#86efac',
}

export function TopProductsTable({ products }: { products: ProductRow[] }) {
  const maxRevenue = products[0]?.revenue ?? 1

  return (
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-4">Product Performance</p>
      <div className="space-y-3">
        {products.map((p, i) => (
          <div key={p.product}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[#57534e] text-xs w-5 text-right">{i + 1}</span>
                <span className="text-[#e7e5e4] text-sm">{p.product}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded text-[#1c1917] font-medium"
                  style={{ backgroundColor: CATEGORY_COLORS[p.category] ?? '#a8a29e' }}
                >
                  {p.category}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#a8a29e]">
                <span>{p.unitsSold.toLocaleString()} units</span>
                <span className="text-[#e7e5e4] font-medium w-20 text-right">
                  ${p.revenue.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5" />
              <div className="flex-1 bg-[#44403c] rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-[#f97316]"
                  style={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="text-[#57534e] text-xs w-10 text-right">{p.revenueShare.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
