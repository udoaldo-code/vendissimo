import { filterTransactions, exportToCSVString, parseTransactionDate } from '@/lib/filter-utils'
import type { Transaction, FilterState } from '@/lib/types'

const SAMPLE: Transaction[] = [
  { machine: 'V1 - KHMER House', location: 'Airport', product: 'OLATTE', unitPrice: 1.5, qty: 1, time: '2026-01-01 10:00:00', date: '1/1/2026' },
  { machine: 'V1 - KHMER House', location: 'Airport', product: 'BACCHUS', unitPrice: 1.5, qty: 2, time: '2026-01-02 11:00:00', date: '1/2/2026' },
  { machine: 'V4 - NPH', location: 'Hospital', product: 'Hi-Tech-Water', unitPrice: 0.5, qty: 3, time: '2026-02-01 09:00:00', date: '2/1/2026' },
]

const EMPTY_FILTER: FilterState = {
  search: '', machine: '', location: '', product: '', dateFrom: '', dateTo: '',
}

describe('filterTransactions', () => {
  it('returns all rows when no filters set', () => {
    expect(filterTransactions(SAMPLE, EMPTY_FILTER)).toHaveLength(3)
  })

  it('filters by machine name (exact match)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, machine: 'V1 - KHMER House' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.machine === 'V1 - KHMER House')).toBe(true)
  })

  it('filters by location', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, location: 'Hospital' })
    expect(result).toHaveLength(1)
    expect(result[0].product).toBe('Hi-Tech-Water')
  })

  it('filters by product', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, product: 'OLATTE' })
    expect(result).toHaveLength(1)
  })

  it('filters by search (product name partial)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, search: 'bach' })
    expect(result).toHaveLength(1)
    expect(result[0].product).toBe('BACCHUS')
  })

  it('filters by search (machine name partial)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, search: 'NPH' })
    expect(result).toHaveLength(1)
  })

  it('filters by dateFrom (inclusive)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, dateFrom: '2026-01-02' })
    expect(result).toHaveLength(2)
  })

  it('filters by dateTo (inclusive)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, dateTo: '2026-01-02' })
    expect(result).toHaveLength(2)
  })

  it('combines filters (location + dateFrom)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, location: 'Airport', dateFrom: '2026-01-02' })
    expect(result).toHaveLength(1)
    expect(result[0].product).toBe('BACCHUS')
  })
})

describe('parseTransactionDate', () => {
  it('parses M/D/YYYY format', () => {
    const d = parseTransactionDate('1/15/2026')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0) // January (0-indexed)
    expect(d.getDate()).toBe(15)
  })
})

describe('exportToCSVString', () => {
  it('produces CSV with header and data rows', () => {
    const csv = exportToCSVString(SAMPLE.slice(0, 1))
    expect(csv).toContain('"Date","Time","Machine","Location","Product"')
    expect(csv).toContain('OLATTE')
    expect(csv).toContain('1.50')
  })
})
