import { Redis } from '@upstash/redis'
import type { Overrides } from './types'

const KEY = 'vendissimo:overrides'

let _client: Redis | null = null
function client(): Redis {
  if (_client) return _client
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error('KV_REST_API_URL/KV_REST_API_TOKEN missing')
  _client = new Redis({ url, token })
  return _client
}

export function defaultOverrides(): Overrides {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    machines: {},
    locations: {},
  }
}

export async function getOverrides(): Promise<Overrides> {
  try {
    const raw = await client().get<Overrides>(KEY)
    return raw ?? defaultOverrides()
  } catch (e) {
    console.warn('[overrides] redis read failed, falling back to defaults', e)
    return defaultOverrides()
  }
}

export async function setOverrides(o: Overrides): Promise<void> {
  const next: Overrides = { ...o, version: 1, updatedAt: new Date().toISOString() }
  await client().set(KEY, next)
}

// ─── merge helpers ────────────────────────────────────────────────

export function mergeMachineName(
  deviceId: string,
  chName: string,
  overrides: Overrides,
): string {
  return overrides.machines[deviceId]?.name ?? chName
}

export function mergeMachineLocation(
  deviceId: string,
  staticLocation: string | undefined,
  overrides: Overrides,
): string {
  return overrides.machines[deviceId]?.locationKey ?? staticLocation ?? 'unassigned'
}

export function mergeLocationLabel(
  locationKey: string,
  overrides: Overrides,
): string {
  return overrides.locations[locationKey]?.label ?? locationKey
}

export type RankedMachine = {
  id: string
  name: string
  locationKey: string
  order?: number
}

export function sortMachines<T extends RankedMachine>(
  machines: T[],
  overrides: Overrides,
): T[] {
  return [...machines].sort((a, b) => {
    const locA = overrides.locations[a.locationKey]?.order ?? Number.MAX_SAFE_INTEGER
    const locB = overrides.locations[b.locationKey]?.order ?? Number.MAX_SAFE_INTEGER
    if (locA !== locB) return locA - locB
    const ordA = a.order ?? Number.MAX_SAFE_INTEGER
    const ordB = b.order ?? Number.MAX_SAFE_INTEGER
    if (ordA !== ordB) return ordA - ordB
    return a.name.localeCompare(b.name)
  })
}
