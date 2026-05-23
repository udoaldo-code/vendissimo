import { rowCurrency, rowToTransaction, formatMoney, buildCanonicalNames, type CHRow } from '@/lib/transactions'

describe('rowCurrency', () => {
  it('returns USD strictly before 2026-05-19', () => {
    expect(rowCurrency('2026-05-18 23:59:59')).toBe('USD')
    expect(rowCurrency('2026-01-01 00:00:00')).toBe('USD')
  })

  it('returns KHR from 2026-05-19 onward', () => {
    expect(rowCurrency('2026-05-19 00:00:00')).toBe('KHR')
    expect(rowCurrency('2026-12-31 23:59:59')).toBe('KHR')
  })
})

describe('rowToTransaction', () => {
  const row: CHRow = {
    device_id: '9fl9g4hgn0f243c',
    device_name: 'V1- KHMER HOUSE',
    product_name: 'BACCHUS',
    product_brand: '',
    sales_amount: '1.5',
    sales_time: '2026-01-31 23:05:48',
  }

  it('maps a USD row with correct field shapes', () => {
    expect(rowToTransaction(row, { '9fl9g4hgn0f243c': 'KHMER House' })).toEqual({
      machine: 'V1- KHMER HOUSE',
      location: 'KHMER House',
      product: 'BACCHUS',
      unitPrice: 1.5,
      qty: 1,
      time: '23:05:48',
      date: '1/31/2026',
      currency: 'USD',
    })
  })

  it('falls back to "Unknown" location when device_id is not in the map', () => {
    expect(rowToTransaction(row, {}).location).toBe('Unknown')
  })

  it('tags rows on/after 2026-05-19 as KHR', () => {
    const khr: CHRow = { ...row, sales_time: '2026-05-19 00:00:00', sales_amount: '2500' }
    expect(rowToTransaction(khr, {}).currency).toBe('KHR')
    expect(rowToTransaction(khr, {}).unitPrice).toBe(2500)
  })

  it('treats a malformed amount as 0', () => {
    const bad: CHRow = { ...row, sales_amount: 'abc' }
    expect(rowToTransaction(bad, {}).unitPrice).toBe(0)
  })

  it('treats null device_name / product_name as empty strings', () => {
    const nulled: CHRow = { ...row, device_name: null, product_name: null }
    const t = rowToTransaction(nulled, {})
    expect(t.machine).toBe('')
    expect(t.product).toBe('')
  })
})

describe('buildCanonicalNames', () => {
  it('picks the latest device_name per device_id by sales_time', () => {
    const rows: CHRow[] = [
      { device_id: 'A', device_name: 'OLD NAME', product_name: 'x', product_brand: '', sales_amount: '1', sales_time: '2026-01-01 00:00:00' },
      { device_id: 'A', device_name: 'NEW NAME', product_name: 'x', product_brand: '', sales_amount: '1', sales_time: '2026-05-01 00:00:00' },
      { device_id: 'B', device_name: 'SOLO', product_name: 'x', product_brand: '', sales_amount: '1', sales_time: '2026-03-01 00:00:00' },
    ]
    expect(buildCanonicalNames(rows)).toEqual({ A: 'NEW NAME', B: 'SOLO' })
  })

  it('ignores rows with null device_id, sales_time, or device_name', () => {
    const rows: CHRow[] = [
      { device_id: null, device_name: 'X', product_name: null, product_brand: null, sales_amount: '1', sales_time: '2026-01-01 00:00:00' },
      { device_id: 'A', device_name: null, product_name: null, product_brand: null, sales_amount: '1', sales_time: '2026-01-01 00:00:00' },
    ]
    expect(buildCanonicalNames(rows)).toEqual({})
  })
})

describe('rowToTransaction with canonical names', () => {
  it('uses the canonical name when provided, falling back to row.device_name', () => {
    const row: CHRow = {
      device_id: 'A', device_name: 'OLD NAME', product_name: 'BACCHUS',
      product_brand: '', sales_amount: '1.5', sales_time: '2026-01-01 12:00:00',
    }
    expect(rowToTransaction(row, {}, { A: 'NEW NAME' }).machine).toBe('NEW NAME')
    expect(rowToTransaction(row, {}, {}).machine).toBe('OLD NAME')
  })
})

describe('formatMoney', () => {
  it('formats USD with $ prefix and two decimals', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50')
    expect(formatMoney(0, 'USD')).toBe('$0.00')
  })

  it('formats KHR with the riel sign and no decimals', () => {
    expect(formatMoney(2500, 'KHR')).toBe('៛2,500')
    expect(formatMoney(0, 'KHR')).toBe('៛0')
  })
})
