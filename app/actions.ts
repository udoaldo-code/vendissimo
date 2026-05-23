'use server'

import { revalidatePath } from 'next/cache'
import { invalidateTransactionsCache } from '@/lib/clickhouse'

export async function revalidateData(): Promise<void> {
  invalidateTransactionsCache()
  revalidatePath('/', 'layout')
}
