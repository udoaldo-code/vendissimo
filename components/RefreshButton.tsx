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
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-[#ede9fe] text-[#6b7280] hover:text-[#7c3aed] hover:border-[#ddd6fe] shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className={isPending ? 'animate-spin' : ''}>↻</span>
      {isPending ? 'Refreshing…' : 'Refresh Data'}
    </button>
  )
}
