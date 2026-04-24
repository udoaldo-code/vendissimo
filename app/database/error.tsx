'use client'

import { ErrorState } from '@/components/ErrorState'

export default function DatabaseError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState message={error.message || 'Could not load database records.'} reset={reset} />
}
