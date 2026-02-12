import { PlatformConfig } from '../../lib/models/platform-config.interface'
import { E2eExecutionResult } from './results.interface'

export interface PlatformAdapter {
  hasValidatedConfig(): boolean
  getValidatedConfig(): PlatformConfig | undefined
  hasE2eConfig(): boolean
  startContainers(): Promise<void>
  exportPlatformInfo(): void
  checkAllHealthy(): Promise<unknown>
  runE2eTests(): Promise<E2eExecutionResult | undefined>
  stopAllContainers(): Promise<void>
  getAllContainers(): Map<string | symbol, unknown>
}
