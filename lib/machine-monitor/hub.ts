type Subscriber = (msg: string) => void

/** In-memory SSE fan-out: deliver one event string to N subscribers. */
export class Hub {
  private subs = new Set<Subscriber>()

  subscribe(fn: Subscriber): void {
    this.subs.add(fn)
  }

  unsubscribe(fn: Subscriber): void {
    this.subs.delete(fn)
  }

  /** Deliver msg to every subscriber; drop any whose callback throws. */
  broadcast(msg: string): void {
    for (const fn of this.subs) {
      try {
        fn(msg)
      } catch {
        this.subs.delete(fn)
      }
    }
  }

  count(): number {
    return this.subs.size
  }
}
