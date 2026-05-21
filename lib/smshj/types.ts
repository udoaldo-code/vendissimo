export type Machine = {
  id: string
  code: string
  name: string
  temperature_c: number | null
  online: boolean | null
  scraped_at: string
  breached: boolean
}

export type MachinesPayload = {
  machines: Machine[]
  fetched_at: number | null
  age_seconds: number | null
  breach_count: number
  threshold_c: number
  error: string | null
}
