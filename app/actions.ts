'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateSheets(): Promise<void> {
  revalidatePath('/', 'layout')
}
