type KPICardProps = {
  label: string
  value: string
  sub?: string
  accentColor?: string
}

export function KPICard({ label, value, sub, accentColor = '#7c3aed' }: KPICardProps) {
  return (
    <div
      className="bg-white rounded-lg p-4 border border-[#ede9fe] border-l-4 shadow-sm"
      style={{ borderLeftColor: accentColor }}
    >
      <p className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: accentColor }}>
        {value}
      </p>
      {sub && <p className="text-[#9ca3af] text-xs mt-1">{sub}</p>}
    </div>
  )
}
