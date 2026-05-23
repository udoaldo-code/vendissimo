'use client'

import { ErrorState } from '@/components/ErrorState'

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState message={error.message || 'Could not load dashboard data.'} reset={reset} />
}
