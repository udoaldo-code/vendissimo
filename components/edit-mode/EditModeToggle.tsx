'use client'

import { useState } from 'react'
import { useEdit } from './EditContext'
import { PasswordModal } from './PasswordModal'
import type { Overrides } from '@/lib/types'

type Props = { initialOverrides: Overrides }

export function EditModeToggle({ initialOverrides }: Props) {
  const { isEditMode, save, cancel, saving, error, enterEditMode } = useEdit()
  const [askPwd, setAskPwd] = useState(false)

  if (!isEditMode) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAskPwd(true)}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:border-accent hover:text-accent transition-colors"
          title="Edit machine names + locations"
        >
          ✏️ Edit
        </button>
        <PasswordModal
          open={askPwd}
          onClose={() => setAskPwd(false)}
          onSuccess={() => {
            setAskPwd(false)
            enterEditMode(initialOverrides)
          }}
        />
      </>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-danger text-xs">{error}</span>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-500 text-white disabled:opacity-60"
      >
        {saving ? 'Saving…' : '💾 Save'}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={saving}
        className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-strong"
      >
        ✕ Cancel
      </button>
    </div>
  )
}
