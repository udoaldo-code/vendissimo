'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  // The no-flash script (in layout.tsx) has already set the class before
  // hydration; read it on mount so the icon matches.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // localStorage unavailable (private mode / disabled) — the theme still
      // applies for this session, it just won't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-card border border-border text-muted-strong hover:text-accent hover:border-border-strong shadow-sm transition-colors"
    >
      <span>{isDark ? '☀︎' : '☾'}</span>
      {isDark ? 'Light' : 'Dark'}
    </button>
  )
}
