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

export function parseNum(s: string | undefined | null): number {
  if (!s) return 0
  const cleaned = s.replace(/[$,%]/g, '').replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch // newlines inside quotes are part of the field, not row separators
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(field.trim())
        field = ''
      } else if (ch === '\n') {
        if (field.endsWith('\r')) field = field.slice(0, -1)
        row.push(field.trim())
        rows.push(row)
        row = []
        field = ''
      } else if (ch === '\r') {
        // skip bare \r
      } else {
        field += ch
      }
    }
  }
  if (field || row.length > 0) {
    row.push(field.trim())
    rows.push(row)
  }
  return rows
}

export function findSectionRow(rows: string[][], marker: string): number {
  return rows.findIndex(row => row.some(cell => cell.includes(marker)))
}
