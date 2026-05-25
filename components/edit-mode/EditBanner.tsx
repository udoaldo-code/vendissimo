'use client'

import { useEdit } from './EditContext'

export function EditBanner() {
  const { isEditMode } = useEdit()
  if (!isEditMode) return null
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-200 rounded-md px-4 py-2 text-sm">
      🔧 Edit Mode aktif — drag ⠿ untuk pindah mesin (dalam/antar lokasi), klik nama mesin untuk rename, lalu Save.
    </div>
  )
}
