import { PlatformConfig } from './platform-config.interface'
import { E2eResult } from './e2e.interface'

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
  startE2eContainer(): Promise<E2eResult | undefined>
  stopAllContainers(): Promise<void>
  getAllContainers(): Map<string, unknown>
}
