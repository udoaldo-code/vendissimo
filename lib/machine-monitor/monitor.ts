import { SmshjClient } from '@/lib/smshj/client'
import type { Machine, MachinesPayload } from '@/lib/smshj/types'
import { Hub } from './hub'

function envInt(key: string, def: number): number {
  const v = process.env[key]
  if (!v) return def
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? def : n
}

function envFloat(key: string, def: number): number {
  const v = process.env[key]
  if (!v) return def
  const n = parseFloat(v)
  return Number.isNaN(n) ? def : n
}

const THRESHOLD_C = envFloat('TEMP_THRESHOLD', 5)
const REFRESH_SECONDS = envInt('MACHINE_REFRESH_SECONDS', 30)
const SESSION_MAX_AGE_MS = envInt('SESSION_MAX_AGE_MIN', 30) * 60_000

/** SSE hub — subscribed by the /api/stream route. */
export const hub = new Hub()

let started = false
let client: SmshjClient | null = null
let machines: Machine[] = []
let machinesAt = 0 // ms epoch; 0 means never fetched
let machinesErr = ''

/** Format an SSE frame: `event: <event>\ndata: <data>\n\n`. */
export function sseFrame(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`
}

/** Current machine snapshot in the shape the UI expects. */
export function getMachinesPayload(): MachinesPayload {
  let breach = 0
  for (const m of machines) if (m.breached) breach++
  return {
    machines,
    fetched_at: machinesAt ? Math.floor(machinesAt / 1000) : null,
    age_seconds: machinesAt ? (Date.now() - machinesAt) / 1000 : null,
    breach_count: breach,
    threshold_c: THRESHOLD_C,
    error: machinesErr || null,
  }
}

async function refreshMachines(): Promise<void> {
  if (!client) return
  try {
    await client.reloginIfStale(SESSION_MAX_AGE_MS)
    machines = await client.listAllMachines(THRESHOLD_C)
    machinesAt = Date.now()
    machinesErr = ''
  } catch (e) {
    machinesErr = e instanceof Error ? e.message : 'machine refresh failed'
    console.error('[machine-monitor] refresh error:', machinesErr)
    return
  }
  hub.broadcast(sseFrame('machines', JSON.stringify(getMachinesPayload())))
}

/**
 * Start the background poll loop. Idempotent — safe to call from both
 * instrumentation register() and route handlers. Never throws: a login
 * failure is recorded and retried on the next interval.
 */
export function startMonitor(): void {
  if (started) return
  started = true

  const msisdn = process.env.SMSHJ_MSISDN
  const password = process.env.SMSHJ_PASSWORD
  if (!msisdn || !password) {
    machinesErr = 'SMSHJ_MSISDN / SMSHJ_PASSWORD not set'
    console.error('[machine-monitor]', machinesErr)
    return
  }
  client = new SmshjClient(msisdn, password)

  void (async () => {
    try {
      await client!.login()
    } catch (e) {
      machinesErr = e instanceof Error ? e.message : 'login failed'
      console.error('[machine-monitor] login error:', machinesErr)
    }
    await refreshMachines()
  })()

  setInterval(() => {
    void refreshMachines()
  }, REFRESH_SECONDS * 1000)
}
