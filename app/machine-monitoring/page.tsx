import { ThemeToggle } from '@/components/ThemeToggle'
import { RealtimeMachineMonitoring } from '@/components/machine-monitoring/RealtimeMachineMonitoring'
import { RefreshButton } from '@/components/RefreshButton'

export default function MachineMonitoringPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Machine Monitoring</h1>
          <p className="text-muted text-xs mt-0.5">Real-time machine health and status overview</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>

      <RealtimeMachineMonitoring />
    </div>
  )
}
