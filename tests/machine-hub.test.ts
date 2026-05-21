import { Hub } from '@/lib/machine-monitor/hub'

describe('Hub', () => {
  it('broadcasts a message to every subscriber', () => {
    const hub = new Hub()
    const a: string[] = []
    const b: string[] = []
    hub.subscribe(m => a.push(m))
    hub.subscribe(m => b.push(m))
    hub.broadcast('hello')
    expect(a).toEqual(['hello'])
    expect(b).toEqual(['hello'])
  })

  it('stops delivering to a subscriber after unsubscribe', () => {
    const hub = new Hub()
    const got: string[] = []
    const fn = (m: string) => got.push(m)
    hub.subscribe(fn)
    hub.unsubscribe(fn)
    hub.broadcast('x')
    expect(got).toEqual([])
  })

  it('drops a subscriber whose callback throws', () => {
    const hub = new Hub()
    hub.subscribe(() => { throw new Error('boom') })
    hub.broadcast('x')
    expect(hub.count()).toBe(0)
  })

  it('reports the subscriber count', () => {
    const hub = new Hub()
    expect(hub.count()).toBe(0)
    hub.subscribe(() => {})
    expect(hub.count()).toBe(1)
  })
})
