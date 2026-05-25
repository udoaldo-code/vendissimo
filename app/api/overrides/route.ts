import { NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getOverrides, setOverrides } from '@/lib/overrides'
import { isEditMode } from '@/lib/edit-auth'

export const dynamic = 'force-dynamic'

const MachineOverrideSchema = z.object({
  name: z.string().max(80).optional(),
  locationKey: z.string().min(1).max(60).optional(),
  order: z.number().int().min(0).max(999).optional(),
})

const LocationOverrideSchema = z.object({
  label: z.string().max(60).optional(),
  order: z.number().int().min(0).max(999).optional(),
})

const OverridesSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().optional(),
  machines: z.record(z.string().max(64), MachineOverrideSchema).refine(
    (v) => Object.keys(v).length <= 50,
    { message: 'max 50 machines' },
  ),
  locations: z.record(z.string().min(1).max(60), LocationOverrideSchema).refine(
    (v) => Object.keys(v).length <= 20,
    { message: 'max 20 locations' },
  ),
})

export async function GET() {
  const overrides = await getOverrides()
  return NextResponse.json(overrides)
}

export async function POST(req: Request) {
  if (!(await isEditMode())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = OverridesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid overrides', issues: parsed.error.issues }, { status: 400 })
  }
  await setOverrides({ ...parsed.data, version: 1, updatedAt: new Date().toISOString() })
  revalidatePath('/', 'layout')
  return NextResponse.json({ ok: true })
}
