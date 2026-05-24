'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/machine-monitoring', label: 'Machine Monitoring', icon: '📡' },
  { href: '/sales-report', label: 'Sales Report', icon: '📄' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const compact = collapsed && !open

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? '4.5rem' : '14rem')
  }, [collapsed])

  const nav = (
    <aside className={`${compact ? 'w-[4.5rem]' : 'w-56'} h-full bg-card border-r border-border flex flex-col transition-[width] duration-200`}>
      <div className="p-3 border-b border-border flex items-center justify-between gap-2">
        {compact ? (
          <div className="hidden md:flex w-8 h-8 rounded-md border border-border items-center justify-center text-accent font-semibold text-sm">
            V
          </div>
        ) : (
          <Image src="/logo.png" alt="Vendissimo" width={96} height={28} priority className="object-contain shrink min-w-0" style={{ width: 'auto', height: 'auto', maxHeight: 28 }} />
        )}

        <button
          type="button"
          className="hidden md:inline-flex w-10 h-10 rounded-lg bg-surface-hover border border-border-strong text-foreground hover:text-accent hover:bg-card hover:border-accent shadow-sm transition-all items-center justify-center"
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-300 ${collapsed ? 'rotate-0' : 'rotate-180'}`}
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="15" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <button
          className="md:hidden text-muted hover:text-accent text-xl leading-none"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          x
        </button>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1">
        {NAV_LINKS.map(link => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              title={compact ? link.label : undefined}
              className={`flex items-center ${compact ? 'justify-center px-2' : 'gap-2.5 px-3'} py-2 rounded-md text-sm transition-colors ${
                active
                  ? `bg-surface-hover text-accent border-l-4 border-accent ${compact ? '' : 'pl-2'}`
                  : 'text-muted-strong hover:text-foreground hover:bg-background'
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {!compact && link.label}
            </Link>
          )
        })}

      </nav>

      <div className="p-3 border-t border-border">
        <p className={`text-muted text-xs ${compact ? 'text-center' : ''}`}>
          {compact ? 'Live' : 'Data: ClickHouse'}
        </p>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex fixed inset-y-0 left-0 z-30" style={{ width: collapsed ? '4.5rem' : '14rem' }}>
        {nav}
      </div>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-card border-b border-border shadow-sm flex items-center px-4 gap-3">
        <button
          className="p-2 rounded-md text-accent"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <span className="block w-5 h-0.5 bg-current mb-1"></span>
          <span className="block w-5 h-0.5 bg-current mb-1"></span>
          <span className="block w-5 h-0.5 bg-current"></span>
        </button>
        <Image src="/logo.png" alt="Vendissimo" width={120} height={34} priority className="object-contain" style={{ height: 'auto' }} />
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
