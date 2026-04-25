'use client'

type Props = { message: string; reset: () => void }

export function ErrorState({ message, reset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-[#1e1b4b] text-lg font-semibold">Failed to load data</h2>
      <p className="text-[#6b7280] text-sm max-w-md text-center">{message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md bg-[#7c3aed]/10 border border-[#7c3aed]/30 text-[#7c3aed] text-sm hover:bg-[#7c3aed]/20 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
