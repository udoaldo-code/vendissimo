'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Overrides } from '@/lib/types'

type EditCtx = {
  isEditMode: boolean
  draft: Overrides
  setDraft: (next: Overrides | ((prev: Overrides) => Overrides)) => void
  enterEditMode: (initialDraft: Overrides) => void
  save: () => Promise<void>
  cancel: () => void
  saving: boolean
  error: string | null
}

const Ctx = createContext<EditCtx | null>(null)

const emptyOverrides: Overrides = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  machines: {},
  locations: {},
}

export function EditProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isEditMode, setEditMode] = useState(false)
  const [draft, setDraftState] = useState<Overrides>(emptyOverrides)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setDraft: EditCtx['setDraft'] = useCallback((next) => {
    setDraftState((prev) => typeof next === 'function' ? (next as (p: Overrides) => Overrides)(prev) : next)
  }, [])

  const enterEditMode = useCallback((initialDraft: Overrides) => {
    setDraftState(initialDraft)
    setEditMode(true)
    setError(null)
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setEditMode(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [draft, router])

  const cancel = useCallback(() => {
    setDraftState(emptyOverrides)
    setEditMode(false)
    setError(null)
  }, [])

  const value = useMemo<EditCtx>(() => ({
    isEditMode, draft, setDraft, enterEditMode, save, cancel, saving, error,
  }), [isEditMode, draft, setDraft, enterEditMode, save, cancel, saving, error])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEdit(): EditCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEdit outside EditProvider')
  return v
}
