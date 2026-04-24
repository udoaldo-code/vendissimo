'use client'

type Props = { message: string; reset: () => void }

export function ErrorState({ message, reset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-[#e7e5e4] text-lg font-semibold">Failed to load data</h2>
      <p className="text-[#a8a29e] text-sm max-w-md text-center">{message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md bg-[#f97316]/20 border border-[#f97316]/40 text-[#f97316] text-sm hover:bg-[#f97316]/30 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
