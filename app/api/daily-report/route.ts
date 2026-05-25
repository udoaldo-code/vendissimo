import { NextResponse } from 'next/server'
import { getDailyReportData } from '@/lib/daily-report'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const token = req.headers.get('X-Hermes-Token')
  if (!token || token !== process.env.HERMES_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const data = await getDailyReportData()
  return NextResponse.json(data)
}
