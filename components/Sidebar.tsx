'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/executive-summary', label: 'Executive Summary', icon: '📊' },
  { href: '/database', label: 'Database', icon: '🗃️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-[#292524] border-r border-[#44403c] flex flex-col">
      <div className="p-4 border-b border-[#44403c]">
        <p className="text-[#f97316] font-bold text-sm tracking-wide">🏪 VENDISSIMO</p>
        <p className="text-[#a8a29e] text-xs mt-0.5">Vending Machine KH</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_LINKS.map(link => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/30'
                  : 'text-[#a8a29e] hover:text-[#e7e5e4] hover:bg-[#44403c]'
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[#44403c]">
        <p className="text-[#57534e] text-xs">Data: Google Sheets · Live</p>
      </div>
    </aside>
  )
}
