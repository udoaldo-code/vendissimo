import { NextResponse } from 'next/server'
import { z } from 'zod'
import { login } from '@/lib/edit-auth'

export const dynamic = 'force-dynamic'

const LoginSchema = z.object({ password: z.string().min(1).max(200) })

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const ok = await login(parsed.data.password)
  if (!ok) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
