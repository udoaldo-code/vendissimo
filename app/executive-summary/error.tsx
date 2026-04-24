'use client'

import { ErrorState } from '@/components/ErrorState'

export default function ExecError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState message={error.message || 'Could not load executive summary data.'} reset={reset} />
}
