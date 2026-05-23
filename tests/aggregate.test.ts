import { aggregateTransactions, filterByDateRange } from '@/lib/aggregate'
import type { Transaction } from '@/lib/types'

function tx(o: Partial<Transaction>): Transaction {
  return {
    machine: 'V1',
    location: 'KHMER House',
    product: 'BACCHUS',
    unitPrice: 1.5,
    qty: 1,
    time: '12:00:00',
    date: '1/10/2026',
    currency: 'USD',
    ...o,
  }
}

describe('aggregateTransactions', () => {
  const cats = { BACCHUS: 'Energy Drink', OLATTE: 'Dairy' }

  it('returns an empty result when no rows of the selected currency exist', () => {
    const out = aggregateTransactions([tx({ currency: 'KHR' })], cats, 'USD')
    expect(out.kpis.totalRevenue).toBe(0)
    expect(out.kpis.totalTransactions).toBe(0)
    expect(out.products).toEqual([])
  })

  it('sums only the rows whose currency matches', () => {
    const rows = [
      tx({ currency: 'USD', unitPrice: 1.5 }),
      tx({ currency: 'USD', unitPrice: 2.0 }),
      tx({ currency: 'KHR', unitPrice: 5000 }),
    ]
    expect(aggregateTransactions(rows, cats, 'USD').kpis.totalRevenue).toBeCloseTo(3.5)
    expect(aggregateTransactions(rows, cats, 'KHR').kpis.totalRevenue).toBe(5000)
  })

  it('counts only matching transactions', () => {
    const rows = [
      tx({ currency: 'USD' }),
      tx({ currency: 'USD' }),
      tx({ currency: 'KHR' }),
    ]
    expect(aggregateTransactions(rows, cats, 'USD').kpis.totalTransactions).toBe(2)
    expect(aggregateTransactions(rows, cats, 'KHR').kpis.totalTransactions).toBe(1)
  })
})

describe('filterByDateRange', () => {
  it('is currency-agnostic — filters only by date', () => {
    const rows = [
      tx({ date: '1/10/2026', currency: 'USD' }),
      tx({ date: '5/20/2026', currency: 'KHR' }),
    ]
    expect(filterByDateRange(rows, '2026-05-01', '2026-05-31')).toHaveLength(1)
  })
})
