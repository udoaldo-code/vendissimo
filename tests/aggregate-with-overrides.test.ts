import { aggregateTransactions } from '@/lib/aggregate'
import type { Transaction } from '@/lib/types'

const txn = (over: Partial<Transaction>): Transaction => ({
  deviceId: 'dev1',
  machine: 'V1 — Overridden',
  location: 'Airport',
  product: 'Water',
  unitPrice: 1.5,
  qty: 1,
  time: '10:00:00',
  date: '5/20/2026',
  currency: 'USD',
  ...over,
})

describe('aggregateTransactions with overridden names', () => {
  it('groups by deviceId so renamed machines do not collide', () => {
    const data = aggregateTransactions([
      txn({ deviceId: 'dev1', machine: 'V1 — Overridden' }),
      txn({ deviceId: 'dev1', machine: 'V1 — Overridden' }),
    ], {}, 'USD')
    const row = data.dailySales.machines.find(m => m.deviceId === 'dev1')
    expect(row).toBeTruthy()
    expect(row?.machine).toBe('V1 — Overridden')
    expect(row?.totalQty).toBe(2)
  })

  it('uses overridden location label in location totals', () => {
    const data = aggregateTransactions([
      txn({ deviceId: 'dev1', location: 'Airport' }),
      txn({ deviceId: 'dev2', machine: 'V2', location: 'Airport' }),
    ], {}, 'USD')
    expect(data.dailySales.locationTotals['Airport']).toBeTruthy()
    expect(data.dailySales.locationTotals['Airport'].totalQty).toBe(2)
  })

  it('emits deviceId on every DailySalesMachineRow', () => {
    const data = aggregateTransactions([
      txn({ deviceId: 'dev1' }),
      txn({ deviceId: 'dev2', machine: 'V2', location: 'Hospital' }),
    ], {}, 'USD')
    for (const m of data.dailySales.machines) {
      expect(m.deviceId).toBeTruthy()
    }
  })
})
