'use client'

import { useEffect, useMemo, useState } from 'react'

type Machine = {
  id: string
  code: string
  name: string
  temperature_c: number | null
  online: boolean | null
  scraped_at: string
  breached: boolean
}

type MachinesPayload = {
  machines: Machine[]
  fetched_at: number | null
  age_seconds: number | null
  breach_count: number
  threshold_c: number
  error: string | null
}

function fmtClock(unixOrIso: number | string | null): string {
  if (unixOrIso == null) return '-'
  const d = typeof unixOrIso === 'number' ? new Date(unixOrIso * 1000) : new Date(unixOrIso)
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function tempColor(t: number | null): string {
  if (t == null) return 'text-muted'
  if (t > 10) return 'text-danger'
  if (t > 5) return 'text-amber-400'
  return 'text-emerald-400'
}

function MachineCard({ m }: { m: Machine }) {
  return (
    <div className={`bg-card rounded-lg p-4 border shadow-sm ${m.breached ? 'border-danger/60' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-muted font-mono">#{m.id}</div>
        {m.breached ? (
          <span className="bg-danger/20 text-danger px-2 py-0.5 rounded text-xs font-semibold">
            BREACH
          </span>
        ) : (
          <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-xs font-semibold">
            OK
          </span>
        )}
      </div>

      <div className="text-sm font-semibold text-foreground mb-1 truncate" title={m.name}>
        {m.name || 'Unknown'}
      </div>
      <div className="text-xs text-muted font-mono truncate mb-3">{m.code || '-'}</div>

      <div className="flex items-end justify-between">
        <div>
          <div className={`text-4xl font-bold ${tempColor(m.temperature_c)}`}>
            {m.temperature_c != null ? m.temperature_c : '--'}
            <span className="text-lg">°C</span>
          </div>
          <div className="text-xs text-muted mt-1">
            {m.online ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="text-muted">scraped</div>
          <div className="text-muted-strong">{fmtClock(m.scraped_at)}</div>
        </div>
      </div>
    </div>
  )
}

export function RealtimeMachineMonitoring() {
  const [payload, setPayload] = useState<MachinesPayload | null>(null)
  const [connected, setConnected] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 300)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let active = true

    const loadSnapshot = async () => {
      try {
        const r = await fetch('/api/machines')
        if (!r.ok) return
        const data: MachinesPayload = await r.json()
        if (!active) return
        setPayload((prev) => prev ?? data)
        setUpdatedAt(Date.now())
      } catch {
        // ignore snapshot errors
      }
    }

    const connect = () => {
      es = new EventSource('/api/stream')
      es.onopen = () => setConnected(true)
      es.addEventListener('machines', (e) => {
        try {
          const data: MachinesPayload = JSON.parse((e as MessageEvent).data)
          setPayload(data)
          setUpdatedAt(Date.now())
        } catch {
          // ignore malformed payload
        }
      })
      es.onerror = () => {
        setConnected(false)
        es?.close()
        retry = setTimeout(connect, 3000)
      }
    }

    loadSnapshot()
    connect()

    return () => {
      active = false
      es?.close()
      if (retry) clearTimeout(retry)
    }
  }, [])

  const machines = useMemo(() => payload?.machines ?? [], [payload])
  const onlineCount = useMemo(() => machines.filter((m) => m.online).length, [machines])
  const breachCount = payload?.breach_count ?? 0
  const thresholdC = payload?.threshold_c ?? 5
  const elapsed = updatedAt ? (now - updatedAt) / 1000 : 0
  const intervalSec = 30
  const pct = Math.min(100, (elapsed / intervalSec) * 100)
  const remaining = Math.max(0, intervalSec - elapsed)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <p className="text-muted text-xs uppercase tracking-wider mb-1">Connection</p>
          <p className={`text-lg font-bold ${connected ? 'text-emerald-400' : 'text-danger'}`}>
            {connected ? 'Connected' : 'Reconnecting'}
          </p>
          <p className="text-xs text-muted mt-1">Last update: {updatedAt ? fmtClock(updatedAt) : '-'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <p className="text-muted text-xs uppercase tracking-wider mb-1">Machines Online</p>
          <p className="text-lg font-bold text-foreground">{onlineCount} / {machines.length}</p>
          <p className="text-xs text-muted mt-1">Active machine connectivity</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <p className="text-muted text-xs uppercase tracking-wider mb-1">Cold-chain Breach</p>
          <p className="text-lg font-bold text-danger">{breachCount}</p>
          <p className="text-xs text-muted mt-1">Temp &gt; {thresholdC}°C</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <p className="text-sm font-semibold text-foreground">
            Next machine refresh in ~{Math.ceil(remaining)}s
          </p>
          <p className="text-xs text-muted">Source: /api/stream + /api/machines</p>
        </div>
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {payload?.error && (
        <div className="bg-danger/10 border border-danger/40 rounded-lg p-3 text-danger text-sm">
          Upstream error: {payload.error}
        </div>
      )}

      <section className="bg-card border border-border rounded-lg p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-3">Machine Temperature - Realtime</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {machines.map((m) => (
            <MachineCard key={m.id} m={m} />
          ))}
        </div>
        {machines.length === 0 && (
          <p className="text-sm text-muted">Waiting for machine data from stream...</p>
        )}
      </section>
    </div>
  )
}
