'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '/executive-summary', label: 'Executive Summary', icon: '📊' },
  { href: '/database', label: 'Database', icon: '🗃️' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const nav = (
    <aside className="w-56 h-full bg-white border-r border-[#ede9fe] flex flex-col">
      <div className="p-4 border-b border-[#ede9fe] flex items-center justify-between">
        <Image src="/logo.png" alt="Vendissimo" width={140} height={40} priority className="object-contain" />
        <button
          className="md:hidden text-[#9ca3af] hover:text-[#7c3aed] text-xl leading-none"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_LINKS.map(link => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-[#f5f3ff] text-[#7c3aed] border-l-4 border-[#7c3aed] pl-2'
                  : 'text-[#6b7280] hover:text-[#1e1b4b] hover:bg-[#faf5ff]'
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[#ede9fe]">
        <p className="text-[#9ca3af] text-xs">Data: Google Sheets · Live</p>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex fixed inset-y-0 left-0 z-30 w-56">
        {nav}
      </div>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-[#ede9fe] shadow-sm flex items-center px-4 gap-3">
        <button
          className="p-2 rounded-md text-[#7c3aed]"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <span className="block w-5 h-0.5 bg-current mb-1"></span>
          <span className="block w-5 h-0.5 bg-current mb-1"></span>
          <span className="block w-5 h-0.5 bg-current"></span>
        </button>
        <Image src="/logo.png" alt="Vendissimo" width={120} height={34} priority className="object-contain" />
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-50 w-56 h-full shadow-xl">
            {nav}
          </div>
        </div>
      )}
    </>
  )
}
