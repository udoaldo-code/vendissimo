'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { revalidateData } from '@/app/actions'

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      await revalidateData()
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-card border border-border text-muted-strong hover:text-accent hover:border-border-strong shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className={isPending ? 'animate-spin' : ''}>↻</span>
      {isPending ? 'Refreshing…' : 'Refresh Data'}
    </button>
  )
}
