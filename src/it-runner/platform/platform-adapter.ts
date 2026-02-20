import { PlatformManager } from '../../lib/platform/platform-manager'
import { PlatformAdapter } from '../types/platform-adapter.interface'
import { E2eExecutionResult } from '../types/results.interface'

/**
 * Default adapter bridging the runner contract to PlatformManager.
 */
export class PlatformManagerAdapter implements PlatformAdapter {
  private manager: PlatformManager

  /**
   * Create a new adapter instance with an internal PlatformManager.
   */
  constructor() {
    this.manager = new PlatformManager()
  }

  /**
   * @returns True when a valid platform configuration is available.
   */
  hasValidatedConfig(): boolean {
    return this.manager.hasValidatedConfig()
  }

  /**
   * @returns Validated platform configuration or undefined.
   */
  getValidatedConfig() {
    return this.manager.getValidatedConfig()
  }

  /**
   * @returns True when E2E container configuration exists.
   */
  hasE2eConfig(): boolean {
    return this.manager.hasE2eConfig()
  }

  /**
   * Start all platform containers.
   *
   * @returns Resolves when startup has completed.
   */
  async startContainers(): Promise<void> {
    await this.manager.startContainers()
  }

  /**
   * Export runtime platform metadata to artefacts.
   *
   * @returns No return value.
   */
  exportPlatformInfo(): void {
    this.manager.getInfoExporter()?.exportAll()
  }

  /**
   * @returns Health-check status data from the platform manager.
   */
  async checkAllHealthy(): Promise<unknown> {
    return this.manager.checkAllHealthy()
  }

  /**
   * @returns Normalized E2E result or undefined when E2E is not configured.
   */
  async runE2eTests(): Promise<E2eExecutionResult | undefined> {
    const result = await this.manager.runE2eTests()
    if (!result) return undefined
    return {
      exitCode: result.exitCode,
      success: result.success,
      durationMs: result.duration,
    }
  }

  /**
   * Stop all running platform containers.
   *
   * @returns Resolves when shutdown has completed.
   */
  async stopAllContainers(): Promise<void> {
    await this.manager.stopAllContainers()
  }

  /**
   * @returns Map of all currently registered containers.
   */
  getAllContainers(): Map<string | symbol, unknown> {
    return this.manager.getAllContainers()
  }
}
