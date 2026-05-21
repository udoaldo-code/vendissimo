import { hub, getMachinesPayload, sseFrame, startMonitor } from '@/lib/machine-monitor/monitor'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  startMonitor()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      const send = (msg: string) => controller.enqueue(enc.encode(msg))

      // initial snapshot so the client renders immediately
      send(sseFrame('machines', JSON.stringify(getMachinesPayload())))

      const sub = (msg: string) => send(msg)
      hub.subscribe(sub)

      const keepAlive = setInterval(() => {
        try {
          send(': ping\n\n')
        } catch {
          // stream already closed
        }
      }, 20_000)

      const close = () => {
        clearInterval(keepAlive)
        hub.unsubscribe(sub)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      request.signal.addEventListener('abort', close)
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
