type KPICardProps = {
  label: string
  value: string
  sub?: string
  accentColor?: string
}

export function KPICard({ label, value, sub, accentColor = 'var(--color-accent)' }: KPICardProps) {
  return (
    <div
      className="h-full bg-card rounded-lg p-4 border border-border border-l-4 shadow-sm flex flex-col min-h-[110px]"
      style={{ borderLeftColor: accentColor }}
    >
      <p className="text-muted text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: accentColor }}>
        {value}
      </p>
      {sub ? (
        <p className="text-muted text-xs mt-1">{sub}</p>
      ) : (
        <p className="text-muted text-xs mt-1 opacity-0 select-none" aria-hidden="true">
          -
        </p>
      )}
    </div>
  )
}
