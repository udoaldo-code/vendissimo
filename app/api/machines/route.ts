import { getMachinesPayload, startMonitor } from '@/lib/machine-monitor/monitor'

export const dynamic = 'force-dynamic'

export function GET() {
  startMonitor() // idempotent safety net in case instrumentation has not run
  return Response.json(getMachinesPayload(), {
    headers: { 'cache-control': 'no-store' },
  })
}
