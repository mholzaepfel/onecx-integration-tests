import { PlatformManager } from '../../lib/platform/platform-manager'
import { PlatformAdapter } from '../types/platform-adapter.interface'
import { E2eExecutionResult } from '../types/results.interface'

export class PlatformManagerAdapter implements PlatformAdapter {
  private manager: PlatformManager

  constructor() {
    this.manager = new PlatformManager()
  }

  hasValidatedConfig(): boolean {
    return this.manager.hasValidatedConfig()
  }

  getValidatedConfig() {
    return this.manager.getValidatedConfig()
  }

  hasE2eConfig(): boolean {
    return this.manager.hasE2eConfig()
  }

  async startContainers(): Promise<void> {
    await this.manager.startContainers()
  }

  exportPlatformInfo(): void {
    this.manager.getInfoExporter()?.exportAll()
  }

  async checkAllHealthy(): Promise<unknown> {
    return this.manager.checkAllHealthy()
  }

  async runE2eTests(): Promise<E2eExecutionResult | undefined> {
    const result = await this.manager.runE2eTests()
    if (!result) return undefined
    return {
      exitCode: result.exitCode,
      success: result.success,
      durationMs: result.duration,
    }
  }

  async stopAllContainers(): Promise<void> {
    await this.manager.stopAllContainers()
  }

  getAllContainers(): Map<string | symbol, unknown> {
    return this.manager.getAllContainers()
  }
}
