export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMonitor } = await import('@/lib/machine-monitor/monitor')
    startMonitor()
  }
}
