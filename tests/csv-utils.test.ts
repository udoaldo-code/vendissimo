import { parseCSVLine, parseNum, parseCSV, findSectionRow } from '@/lib/csv-utils'

describe('parseCSVLine', () => {
  it('splits simple comma-separated values', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted fields containing commas', () => {
    expect(parseCSVLine('"$8,733.00","12,736",8')).toEqual(['$8,733.00', '12,736', '8'])
  })

  it('trims whitespace from fields', () => {
    expect(parseCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c'])
  })

  it('handles empty leading field (column A always empty)', () => {
    expect(parseCSVLine(',TOTAL REVENUE,TOTAL TRANSACTIONS')).toEqual([
      '',
      'TOTAL REVENUE',
      'TOTAL TRANSACTIONS',
    ])
  })
})

describe('parseNum', () => {
  it('strips dollar sign and commas', () => {
    expect(parseNum('$8,733.00')).toBeCloseTo(8733)
  })

  it('strips percent sign', () => {
    expect(parseNum('16.7%')).toBeCloseTo(16.7)
  })

  it('parses plain number', () => {
    expect(parseNum('78.68')).toBeCloseTo(78.68)
  })

  it('returns 0 for empty string', () => {
    expect(parseNum('')).toBe(0)
  })

  it('returns 0 for DIV/0 error', () => {
    expect(parseNum('#DIV/0!')).toBe(0)
  })
})

describe('parseCSV', () => {
  it('splits text into rows of fields', () => {
    const text = 'a,b\nc,d'
    expect(parseCSV(text)).toEqual([['a', 'b'], ['c', 'd']])
  })
})

describe('findSectionRow', () => {
  it('finds row index by marker string', () => {
    const rows = [
      ['', 'other'],
      ['', 'KEY PERFORMANCE INDICATORS (YTD)'],
      ['', 'TOTAL REVENUE'],
    ]
    expect(findSectionRow(rows, 'KEY PERFORMANCE INDICATORS')).toBe(1)
  })

  it('returns -1 when not found', () => {
    const rows = [['', 'something']]
    expect(findSectionRow(rows, 'MISSING')).toBe(-1)
  })
})
