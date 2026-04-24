'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { revalidateSheets } from '@/app/actions'

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      await revalidateSheets()
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-[#292524] border border-[#44403c] text-[#a8a29e] hover:text-[#e7e5e4] hover:border-[#57534e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className={isPending ? 'animate-spin' : ''}>↻</span>
      {isPending ? 'Refreshing…' : 'Refresh Data'}
    </button>
  )
}
