/** Daily-units-sold target per machine, configurable via env. Default 21 per PPT. */
const DEFAULT_TARGET = 21

export function getKpiTarget(): number {
  const v = process.env.KPI_TARGET_UNITS_PER_DAY
  if (!v) return DEFAULT_TARGET
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TARGET
}
