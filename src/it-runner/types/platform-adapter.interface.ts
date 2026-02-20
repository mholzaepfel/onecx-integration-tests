import { PlatformConfig } from '../../lib/models/interfaces/platform-config.interface'
import { E2eExecutionResult } from './results.interface'

/**
 * Runner-facing abstraction for platform lifecycle orchestration.
 */
export interface PlatformAdapter {
  /** @returns True when a valid configuration is available. */
  hasValidatedConfig(): boolean
  /** @returns Validated platform configuration or undefined. */
  getValidatedConfig(): PlatformConfig | undefined
  /** @returns True when E2E execution is configured. */
  hasE2eConfig(): boolean
  /** @returns Resolves when platform startup is complete. */
  startContainers(): Promise<void>
  /** @returns No return value. */
  exportPlatformInfo(): void
  /** @returns Health-check output from the platform implementation. */
  checkAllHealthy(): Promise<unknown>
  /** @returns E2E result data or undefined when skipped. */
  runE2eTests(): Promise<E2eExecutionResult | undefined>
  /** @returns Resolves when all containers are stopped. */
  stopAllContainers(): Promise<void>
  /** @returns Registry of all running containers. */
  getAllContainers(): Map<string | symbol, unknown>
}
