import { PlatformConfig } from './platform-config.interface'
import { E2eExecutionRecord } from './e2e.interface'

/**
 * Contract for platform runtime operations used by integration test execution.
 */
export interface PlatformRuntime {
  hasValidatedConfig(): boolean
  getValidatedConfig(): PlatformConfig | undefined
  hasE2eConfig(): boolean
  startContainers(): Promise<void>
  exportPlatformInfo(): Promise<void>
  checkAllHealthy(): Promise<unknown>
  startE2eContainers(shouldContinue?: () => boolean): Promise<E2eExecutionRecord[] | undefined>
  stopAllContainers(): Promise<void>
  getAllContainers(): Map<string, unknown>
}
