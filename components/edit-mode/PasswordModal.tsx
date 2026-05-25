'use client'

import { useState, type FormEvent } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PasswordModal({ open, onClose, onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/edit-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setPassword('')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={submit} className="bg-card border border-border rounded-lg p-6 w-80 shadow-xl">
        <h3 className="text-foreground font-semibold mb-3">Edit Mode Password</h3>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
          placeholder="Password"
        />
        {error && <p className="text-danger text-xs mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-strong hover:text-foreground">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="px-3 py-1.5 text-xs rounded-md bg-accent text-white disabled:opacity-60">
            {busy ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </form>
    </div>
  )
}
