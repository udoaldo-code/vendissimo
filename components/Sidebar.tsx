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
      <div className="p-4 border-b border-border flex items-center justify-between">
        {compact ? (
          <div className="hidden md:flex w-8 h-8 rounded-md border border-border items-center justify-center text-accent font-semibold text-sm">
            V
          </div>
        ) : (
          <Image src="/logo.png" alt="Vendissimo" width={140} height={40} priority className="object-contain" style={{ width: 'auto', height: 'auto' }} />
        )}

        <button
          className="hidden md:inline-flex w-9 h-9 rounded-md bg-card border border-border text-muted-strong hover:text-accent hover:bg-surface-hover hover:border-border-strong shadow-sm transition-colors items-center justify-center"
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className={`flex flex-col items-center justify-center gap-1 transition-transform duration-300 ${collapsed ? 'rotate-0 scale-100' : 'rotate-180 scale-95'}`}>
            <span className={`block h-0.5 bg-current rounded-full transition-all duration-300 ${collapsed ? 'w-4' : 'w-3.5'}`} />
            <span className={`block h-0.5 bg-current rounded-full transition-all duration-300 ${collapsed ? 'w-4' : 'w-2.5'}`} />
            <span className={`block h-0.5 bg-current rounded-full transition-all duration-300 ${collapsed ? 'w-4' : 'w-3.5'}`} />
          </span>
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
