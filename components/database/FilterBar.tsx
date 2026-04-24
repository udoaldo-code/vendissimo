'use client'

import type { FilterState } from '@/lib/types'

type Props = {
  filters: FilterState
  onChange: (filters: FilterState) => void
  machines: string[]
  locations: string[]
  products: string[]
}

export function FilterBar({ filters, onChange, machines, locations, products }: Props) {
  function set(key: keyof FilterState, value: string) {
    onChange({ ...filters, [key]: value })
  }

  const selectClass =
    'bg-[#292524] border border-[#44403c] rounded-md px-2 py-1.5 text-sm text-[#e7e5e4] focus:outline-none focus:border-[#f97316] min-w-[140px]'
  const inputClass =
    'bg-[#292524] border border-[#44403c] rounded-md px-2 py-1.5 text-sm text-[#e7e5e4] placeholder-[#57534e] focus:outline-none focus:border-[#f97316]'

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        type="text"
        placeholder="Search product or machine…"
        value={filters.search}
        onChange={e => set('search', e.target.value)}
        className={`${inputClass} w-52`}
      />
      <select value={filters.machine} onChange={e => set('machine', e.target.value)} className={selectClass}>
        <option value="">All Machines</option>
        {machines.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={filters.location} onChange={e => set('location', e.target.value)} className={selectClass}>
        <option value="">All Locations</option>
        {locations.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <select value={filters.product} onChange={e => set('product', e.target.value)} className={selectClass}>
        <option value="">All Products</option>
        {products.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <input
        type="date"
        value={filters.dateFrom}
        onChange={e => set('dateFrom', e.target.value)}
        className={inputClass}
        title="From date"
      />
      <input
        type="date"
        value={filters.dateTo}
        onChange={e => set('dateTo', e.target.value)}
        className={inputClass}
        title="To date"
      />
      {Object.values(filters).some(Boolean) && (
        <button
          onClick={() => onChange({ search: '', machine: '', location: '', product: '', dateFrom: '', dateTo: '' })}
          className="text-xs text-[#a8a29e] hover:text-[#e7e5e4] px-2 py-1.5 border border-[#44403c] rounded-md hover:border-[#57534e] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
