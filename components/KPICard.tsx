type KPICardProps = {
  label: string
  value: string
  sub?: string
  accentColor?: string
}

export function KPICard({ label, value, sub, accentColor = '#f97316' }: KPICardProps) {
  return (
    <div
      className="bg-[#292524] rounded-lg p-4 border-l-4"
      style={{ borderLeftColor: accentColor }}
    >
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[#e7e5e4] text-xl font-bold" style={{ color: accentColor }}>
        {value}
      </p>
      {sub && <p className="text-[#57534e] text-xs mt-1">{sub}</p>}
    </div>
  )
}
