'use client'

type Props = { message: string; reset: () => void }

export function ErrorState({ message, reset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-foreground text-lg font-semibold">Failed to load data</h2>
      <p className="text-muted-strong text-sm max-w-md text-center">{message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md bg-accent/10 border border-accent/30 text-accent text-sm hover:bg-accent/20 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
