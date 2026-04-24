export function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export function parseNum(s: string): number {
  const cleaned = s.replace(/[$,%]/g, '').replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}

export function parseCSV(text: string): string[][] {
  return text.split('\n').map(parseCSVLine)
}

export function findSectionRow(rows: string[][], marker: string): number {
  return rows.findIndex(row => row.some(cell => cell.includes(marker)))
}
