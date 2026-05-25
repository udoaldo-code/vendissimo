import {
  defaultOverrides,
  mergeMachineName,
  mergeMachineLocation,
  mergeLocationLabel,
  sortMachines,
} from '@/lib/overrides'
import type { Overrides } from '@/lib/types'

const ov: Overrides = {
  version: 1,
  updatedAt: '2026-05-25T00:00:00Z',
  machines: {
    'dev1': { name: 'V1 — Custom', locationKey: 'airport', order: 0 },
    'dev2': { name: 'V2 — Custom', locationKey: 'university', order: 1 },
  },
  locations: {
    airport: { label: 'Airport', order: 0 },
    university: { label: 'University', order: 1 },
  },
}

describe('defaultOverrides', () => {
  it('returns empty overrides with version 1', () => {
    const d = defaultOverrides()
    expect(d.version).toBe(1)
    expect(d.machines).toEqual({})
    expect(d.locations).toEqual({})
  })
})

describe('mergeMachineName', () => {
  it('returns override name when present', () => {
    expect(mergeMachineName('dev1', 'CH Name', ov)).toBe('V1 — Custom')
  })

  it('falls back to CH name when override missing', () => {
    expect(mergeMachineName('devX', 'CH Name', ov)).toBe('CH Name')
  })

  it('falls back to CH name when override has no name field', () => {
    const ov2: Overrides = { ...ov, machines: { dev1: { locationKey: 'a' } } }
    expect(mergeMachineName('dev1', 'CH Name', ov2)).toBe('CH Name')
  })
})

describe('mergeMachineLocation', () => {
  it('returns override locationKey when present', () => {
    expect(mergeMachineLocation('dev1', 'STATIC', ov)).toBe('airport')
  })

  it('falls back to static map when override missing', () => {
    expect(mergeMachineLocation('devX', 'STATIC', ov)).toBe('STATIC')
  })

  it('falls back to "unassigned" when both missing', () => {
    expect(mergeMachineLocation('devX', undefined, ov)).toBe('unassigned')
  })
})

describe('mergeLocationLabel', () => {
  it('returns override label when present', () => {
    expect(mergeLocationLabel('airport', ov)).toBe('Airport')
  })

  it('falls back to key when override missing', () => {
    expect(mergeLocationLabel('unknown', ov)).toBe('unknown')
  })
})

describe('sortMachines', () => {
  it('sorts by (location.order, machine.order, name)', () => {
    const list = [
      { id: 'dev2', name: 'V2 — Custom', locationKey: 'university', order: 1 },
      { id: 'dev1', name: 'V1 — Custom', locationKey: 'airport', order: 0 },
    ]
    const sorted = sortMachines(list, ov)
    expect(sorted.map(m => m.id)).toEqual(['dev1', 'dev2'])
  })

  it('groups by location order first', () => {
    const list = [
      { id: 'a', name: 'a', locationKey: 'university', order: 0 },
      { id: 'b', name: 'b', locationKey: 'airport', order: 5 },
    ]
    const sorted = sortMachines(list, ov)
    expect(sorted.map(m => m.id)).toEqual(['b', 'a'])
  })
})
