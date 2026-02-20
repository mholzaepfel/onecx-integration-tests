import * as fs from 'fs'
import * as path from 'path'
import { ArtefactsManager } from './artefacts/artefacts-manager'
import { CliOptions } from './types/cli-options.interface'
import { PlatformManagerAdapter } from './platform/platform-adapter'
import { PlatformAdapter } from './types/platform-adapter.interface'
import { RunSummary } from './types/run-summary.interface'
import { E2eExecutionResult } from './types/results.interface'
import { ContainerWithLogs } from './types/container-logs.interface'
import { PlatformConfig } from '../lib/models/interfaces/platform-config.interface'
import { Logger, LoggerLevel } from '../lib/utils/logger'

/**
 * Orchestrates one complete integration test run lifecycle.
 */
export class IntegrationTestsRunner {
  private static readonly EXIT_SUCCESS = 0
  private static readonly EXIT_FAILURE = 1

  private options: CliOptions
  private artefacts: ArtefactsManager
  private logger: Logger
  private platformAdapter: PlatformAdapter
  private startTime: number
  private runId: string
  private isShuttingDown = false
  private timeoutHandle?: NodeJS.Timeout
  private containerLogPath?: string
  private containerLogWriter?: fs.WriteStream
  private containerLogStreams: NodeJS.ReadableStream[] = []
  private restoreTerminalStreams?: () => void

  constructor(options: CliOptions, adapterFactory?: () => PlatformAdapter) {
    this.options = options
    this.runId = this.generateRunId()
    this.artefacts = new ArtefactsManager(undefined, this.runId)
    const logPath = options.captureLogsToFile ? this.artefacts.getRunnerLogPath() : undefined
    this.logger = new Logger('IntegrationTestsRunner', logPath)
    const factory = adapterFactory ?? (() => new PlatformManagerAdapter())
    this.platformAdapter = factory()
    this.startTime = Date.now()
  }

  /**
   * Execute the integration run: bootstrap, validate, run checks/tests, and cleanup.
   *
   * @returns Numeric process-style exit code describing the final run status.
   */
  async run(): Promise<number> {
    this.setupSignalHandlers()

    try {
      this.artefacts.ensureDirectories()
      this.containerLogPath = this.resolveContainerLogPath()

      const artefactsRoot = this.artefacts.getArtefactsRoot()
      process.env.artefacts_ROOT = artefactsRoot
      process.env.E2E_BASE_DIR = artefactsRoot
      process.env.E2E_RUN_ID = this.runId
      process.env.RUN_ID = this.runId
      this.log('info', `Run ID: ${this.runId}`)
      this.log('info', `Artefacts: ${this.artefacts.getRunDir()}`)
      if (this.options.captureLogsToFile) {
        this.log('info', `Runner log file: ${this.artefacts.getRunnerLogPath()}`)
      }
      if (this.containerLogPath) {
        this.log('info', `Container logs: ${this.containerLogPath}`)
      }

      this.startTerminalLogCapture()

      const config = this.loadConfig()
      if (!config) {
        return this.finalize(IntegrationTestsRunner.EXIT_FAILURE, 'failure')
      }

      const mode = this.platformAdapter.hasE2eConfig() ? 'e2e' : 'platform-only'

      this.log('info', `Mode: ${mode}`)

      if (this.options.dryRun) {
        this.log('info', 'Dry run complete')
        return this.finalize(IntegrationTestsRunner.EXIT_SUCCESS, 'success')
      }

      this.log('info', 'Starting platform...')
      await this.platformAdapter.startContainers()

      this.platformAdapter.exportPlatformInfo()

      this.log('info', 'Waiting for health checks...')
      await this.platformAdapter.checkAllHealthy()
      this.log('success', 'Platform is ready')

      await this.startContainerLogCapture()

      let e2eResult: E2eExecutionResult | undefined

      if (mode === 'e2e') {
        this.log('info', 'Running E2E tests...')
        const result = await this.platformAdapter.runE2eTests()
        if (result) {
          e2eResult = { exitCode: result.exitCode, success: result.success, durationMs: result.durationMs }
          this.log(
            result.success ? 'success' : 'error',
            `E2E ${result.success ? 'passed' : 'failed'} (exit ${result.exitCode})`
          )
        }
      }

      this.log('info', 'Collecting artefacts...')
      this.artefacts.copyE2eResults()

      await this.cleanup()

      const successfulRun = e2eResult?.success !== false
      const exitCode = successfulRun ? IntegrationTestsRunner.EXIT_SUCCESS : IntegrationTestsRunner.EXIT_FAILURE
      return this.finalize(exitCode, successfulRun ? 'success' : 'failure', e2eResult)
    } catch (error) {
      this.log('error', `Error: ${error}`)
      await this.cleanup()
      return this.finalize(IntegrationTestsRunner.EXIT_FAILURE, 'error')
    }
  }

  private loadConfig(): PlatformConfig | undefined {
    if (!this.platformAdapter.hasValidatedConfig()) {
      this.log('error', 'Configuration validation failed')
      return undefined
    }
    return this.platformAdapter.getValidatedConfig()
  }

  private waitWithTimeout(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.timeoutHandle = setTimeout(resolve, timeoutMs)

      const shutdown = () => {
        if (this.timeoutHandle) clearTimeout(this.timeoutHandle)
        resolve()
      }

      process.once('SIGINT', shutdown)
      process.once('SIGTERM', shutdown)
    })
  }

  private async cleanup(): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    if (this.timeoutHandle) clearTimeout(this.timeoutHandle)

    this.stopTerminalLogCapture()

    await this.stopContainerLogCapture()

    this.log('info', 'Shutting down platform...')
    try {
      await this.platformAdapter.stopAllContainers()
      this.log('success', 'Platform shutdown complete')
    } catch (error) {
      this.log('error', `Cleanup error: ${error}`)
    }

    await this.logger.close()
  }

  private finalize(
    exitCode: number,
    status: 'success' | 'failure' | 'timeout' | 'error',
    e2eResult?: E2eExecutionResult
  ): number {
    const durationMs = Date.now() - this.startTime

    const summary: RunSummary = {
      runId: this.runId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      durationMs,
      exitCode,
      status,
      mode: this.platformAdapter.hasE2eConfig() ? 'e2e' : 'platform-only',
      e2eResult,
    }

    this.artefacts.writeSummary(summary)

    console.log('')
    console.log('============================================================')
    console.log(`  Run ID:     ${this.runId}`)
    console.log(`  Status:     ${status.toUpperCase()}`)
    console.log(`  Duration:   ${Math.round(durationMs / 1000)}s`)
    console.log(`  Exit Code:  ${exitCode}`)
    console.log(`  Artefacts:  ${this.artefacts.getRunDir()}`)
    console.log(`  Runner log: ${this.options.captureLogsToFile ? this.artefacts.getRunnerLogPath() : 'disabled'}`)
    console.log(`  Container logs: ${this.containerLogPath ?? 'disabled'}`)
    console.log('============================================================')

    return exitCode
  }

  private setupSignalHandlers(): void {
    const handler = async (signal: string) => {
      this.log('info', `Received ${signal}, shutting down...`)
      await this.cleanup()
      process.exit(IntegrationTestsRunner.EXIT_SUCCESS)
    }

    process.on('SIGINT', () => handler('SIGINT'))
    process.on('SIGTERM', () => handler('SIGTERM'))
  }

  private log(level: LoggerLevel, message: string): void {
    this.logger.log(level, message)
  }

  private resolveContainerLogPath(): string | undefined {
    if (!this.options.captureLogsToFile) return undefined
    return path.join(this.artefacts.getLogsDir(), 'containers.log')
  }

  private async startContainerLogCapture(): Promise<void> {
    if (!this.containerLogPath) return

    this.ensureContainerLogWriter()

    const containers = this.platformAdapter.getAllContainers()
    for (const [key, container] of containers.entries()) {
      const name = typeof key === 'string' ? key : String(key)
      const candidate = container as ContainerWithLogs
      if (typeof candidate.logs !== 'function') {
        this.log('warn', `Container ${name} does not expose logs()`)
        continue
      }

      try {
        const stream = await candidate.logs()
        stream.on('data', (chunk: Buffer) => this.writeContainerLog(name, chunk))
        stream.on('error', (err) => this.writeContainerLog(name, Buffer.from(String(err))))
        stream.on('end', () => this.writeContainerLog(name, Buffer.from('')))
        this.containerLogStreams.push(stream)
      } catch (error) {
        this.log('warn', `Failed to attach logs for ${name}: ${error}`)
      }
    }
  }

  private async stopContainerLogCapture(): Promise<void> {
    this.containerLogStreams.forEach((stream) => {
      stream.removeAllListeners()
      if (typeof (stream as unknown as { destroy?: () => void }).destroy === 'function') {
        ;(stream as unknown as { destroy: () => void }).destroy()
      }
    })
    this.containerLogStreams = []

    if (this.containerLogWriter) {
      await new Promise<void>((resolve) => this.containerLogWriter?.end(resolve))
      this.containerLogWriter = undefined
    }
  }

  private ensureContainerLogWriter(): void {
    if (!this.containerLogPath || this.containerLogWriter) return
    // Keep all generated log files local to the selected artefacts path.
    fs.mkdirSync(path.dirname(this.containerLogPath), { recursive: true })
    this.containerLogWriter = fs.createWriteStream(this.containerLogPath, { flags: 'a' })
  }

  private startTerminalLogCapture(): void {
    if (!this.containerLogPath || this.restoreTerminalStreams) return

    this.ensureContainerLogWriter()

    // Tee process stdout/stderr into the container log file while preserving normal terminal output.
    const originalStdoutWrite = process.stdout.write.bind(process.stdout)
    const originalStderrWrite = process.stderr.write.bind(process.stderr)

    process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
      this.writeContainerLog('stdout', chunk)
      return (originalStdoutWrite as (...innerArgs: unknown[]) => boolean)(chunk, ...args)
    }) as typeof process.stdout.write

    process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
      this.writeContainerLog('stderr', chunk)
      return (originalStderrWrite as (...innerArgs: unknown[]) => boolean)(chunk, ...args)
    }) as typeof process.stderr.write

    this.restoreTerminalStreams = () => {
      // Always restore native stream writers to avoid leaking monkey patches across runs/tests.
      process.stdout.write = originalStdoutWrite as typeof process.stdout.write
      process.stderr.write = originalStderrWrite as typeof process.stderr.write
      this.restoreTerminalStreams = undefined
    }
  }

  private stopTerminalLogCapture(): void {
    this.restoreTerminalStreams?.()
  }

  private writeContainerLog(containerName: string, chunk: Buffer | string | Uint8Array): void {
    if (!this.containerLogWriter) return
    // Prefix each line with timestamp and source to make mixed logs traceable.
    const line = `[${new Date().toISOString()}] [${containerName}] ${chunk.toString()}`
    this.containerLogWriter.write(`${line}\n`)
  }

  private printExecutionPlan(
    mode: 'e2e' | 'platform-only',
    timeouts: Required<{ startupMs: number; healthCheckMs: number; e2eMs: number }>
  ): void {
    const steps = [
      'Load configuration',
      'Initialize PlatformManager',
      'Start core and user-defined containers',
      'Export platform info',
      'Run health checks',
    ]

    if (mode === 'e2e') {
      steps.push('Run E2E tests via e2e container')
    } else {
      steps.push(`Keep platform running for ${timeouts.e2eMs}ms or until interrupted`)
    }

    steps.push('Collect artefacts (logs, reports, e2e-results, summary)', 'Shutdown containers')

    this.log('info', 'Execution plan:')
    steps.forEach((step, idx) => this.log('info', `  ${idx + 1}. ${step}`))
  }

  private generateRunId(): string {
    const now = new Date()
    return `${now.toISOString().slice(0, 10).replace(/-/g, '')}-${now
      .toISOString()
      .slice(11, 19)
      .replace(/:/g, '')}-${Math.random().toString(36).slice(2, 6)}`
  }
}
