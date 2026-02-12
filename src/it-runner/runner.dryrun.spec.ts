import { IntegrationTestsRunner } from './runner'
import { PlatformAdapter } from './types/platform-adapter.interface'
import { E2eExecutionResult } from './types/results.interface'

class StubAdapter implements PlatformAdapter {
  constructor(private readonly configValid = true) {}
  hasValidatedConfig(): boolean {
    return this.configValid
  }
  getValidatedConfig() {
    return { importData: true, enableLogging: true, timeouts: { startupMs: 1, healthCheckMs: 1, e2eMs: 2 } }
  }
  hasE2eConfig(): boolean {
    return false
  }
  async startContainers(): Promise<void> {
    throw new Error('startContainers should not be called in dry-run')
  }
  exportPlatformInfo(): void {
    /* no-op */
  }
  async checkAllHealthy(): Promise<unknown> {
    throw new Error('checkAllHealthy should not be called in dry-run')
  }
  async runE2eTests(): Promise<E2eExecutionResult | undefined> {
    throw new Error('runE2eTests should not be called in dry-run')
  }
  async stopAllContainers(): Promise<void> {
    return
  }
  getAllContainers(): Map<string | symbol, unknown> {
    return new Map()
  }
}

describe('IntegrationTestsRunner dry-run', () => {
  it('exits successfully without starting containers', async () => {
    const options = {
      config: undefined,
      timeoutMs: undefined,
      artefactsDir: './artefacts',
      verbose: false,
      dryRun: true,
      captureLogsToFile: false,
      containerLogs: undefined,
      help: false,
    }
    const runner = new IntegrationTestsRunner(options, () => new StubAdapter())
    const exitCode = await runner.run()
    expect(exitCode).toBe(0)
  })
})
