import { IntegrationTestsRunner } from './runner'
import { PlatformRuntime } from '../lib/models/interfaces/platform-runtime.interface'
import { E2eExecutionRecord } from '../lib/models/interfaces/e2e.interface'

/**
 * Test double used to validate dry-run behavior without starting real containers.
 */
class StubPlatformRuntime implements PlatformRuntime {
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
  async exportPlatformInfo(): Promise<void> {
    /* no-op */
  }
  async checkAllHealthy(): Promise<unknown> {
    throw new Error('checkAllHealthy should not be called in dry-run')
  }
  async startE2eContainers(): Promise<E2eExecutionRecord[] | undefined> {
    throw new Error('startE2eContainers should not be called in dry-run')
  }
  async stopAllContainers(): Promise<void> {
    return
  }
  getAllContainers(): Map<string, unknown> {
    return new Map()
  }
}

/**
 * Verifies that dry-run mode exits successfully without touching container lifecycle operations.
 */
describe('IntegrationTestsRunner dry-run', () => {
  it('exits successfully without starting containers', async () => {
    const options = {
      config: undefined,
      timeoutMs: undefined,
      artifactsDir: './artifacts',
      verbose: false,
      dryRun: true,
      captureLogsToFile: false,
      help: false,
    }
    const runner = new IntegrationTestsRunner(options, () => new StubPlatformRuntime())
    const exitCode = await runner.run()
    expect(exitCode).toBe(0)
  })

  it('removes signal listeners after finalize', async () => {
    const beforeSigint = process.listenerCount('SIGINT')
    const beforeSigterm = process.listenerCount('SIGTERM')

    const runner = new IntegrationTestsRunner(
      {
        verbose: false,
        dryRun: true,
        captureLogsToFile: false,
        help: false,
      },
      () => new StubPlatformRuntime()
    )

    const exitCode = await runner.run()
    expect(exitCode).toBe(0)
    expect(process.listenerCount('SIGINT')).toBe(beforeSigint)
    expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm)
  })
})
