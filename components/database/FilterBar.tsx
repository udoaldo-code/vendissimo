'use client'

import type { FilterState } from '@/lib/types'

const EMPTY_FILTERS: FilterState = { search: '', machine: '', location: '', product: '', dateFrom: '', dateTo: '' }

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
    'bg-white border border-[#ede9fe] rounded-md px-2 py-1.5 text-sm text-[#1e1b4b] focus:outline-none focus:border-[#7c3aed] min-w-[130px]'
  const inputClass =
    'bg-white border border-[#ede9fe] rounded-md px-2 py-1.5 text-sm text-[#1e1b4b] placeholder-[#9ca3af] focus:outline-none focus:border-[#7c3aed]'

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        type="text"
        placeholder="Search product or machine…"
        value={filters.search}
        onChange={e => set('search', e.target.value)}
        className={`${inputClass} w-full sm:w-52`}
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
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs text-[#6b7280] hover:text-[#7c3aed] px-2 py-1.5 border border-[#ede9fe] rounded-md hover:border-[#ddd6fe] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
