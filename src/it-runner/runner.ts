import * as fs from 'fs'
import * as path from 'path'
import { ArtifactsManager } from './artifacts/artifacts-manager'
import { CliOptions } from './types/cli-options.interface'
import { RunSummary } from './types/run-summary.interface'
import { E2eExecutionResult } from './types/results.interface'
import { ContainerWithLogs } from './types/container-logs.interface'
import { PlatformConfig } from '../lib/models/interfaces/platform-config.interface'
import { Logger, LoggerLevel } from '../lib/utils/logger'
import { PlatformManager } from '../lib/platform/platform-manager'
import { PlatformRuntime } from '../lib/models/interfaces/platform-runtime.interface'

/**
 * Orchestrates one complete integration test run lifecycle.
 */
export class IntegrationTestsRunner {
  private static readonly EXIT_SUCCESS = 0
  private static readonly EXIT_FAILURE = 1

  private readonly options: CliOptions
  private readonly artifacts: ArtifactsManager
  private readonly logger: Logger
  private readonly platformRuntime: PlatformRuntime
  private readonly startTime: number
  private readonly runId: string

  private isShuttingDown = false
  private timeoutHandle?: NodeJS.Timeout
  private containerLogPath?: string
  private containerLogWriter?: fs.WriteStream
  private containerLogStreams: NodeJS.ReadableStream[] = []
  private restoreTerminalStreams?: () => void

  constructor(options: CliOptions, platformFactory?: () => PlatformRuntime) {
    this.options = options
    this.runId = this.generateRunId()
    this.artifacts = new ArtifactsManager(undefined, this.runId)
    const logPath = options.captureLogsToFile ? this.artifacts.getRunnerLogPath() : undefined
    this.logger = new Logger('IntegrationTestsRunner', logPath)
    const factory = platformFactory ?? (() => new PlatformManager())
    this.platformRuntime = factory()
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
      this.initializeRunContext()
      const config = this.loadConfig()
      if (!config) {
        return this.finalize(IntegrationTestsRunner.EXIT_FAILURE, 'failure')
      }

      this.log('info', 'Mode: e2e')

      if (this.options.dryRun) {
        return this.finishDryRun()
      }

      await this.executePlatformFlow()
      const e2eResult = await this.runE2e()

      this.log('info', 'Collecting artifacts...')
      this.artifacts.copyE2eResults()

      await this.cleanup()
      return this.finalizeByE2eResult(e2eResult)
    } catch (error) {
      this.log('error', `Error: ${error}`)
      await this.cleanup()
      return this.finalize(IntegrationTestsRunner.EXIT_FAILURE, 'error')
    }
  }

  private initializeRunContext(): void {
    this.artifacts.ensureDirectories()
    this.containerLogPath = this.resolveContainerLogPath()

    const artifactsRoot = this.artifacts.getArtifactsRoot()
    process.env.artifacts_ROOT = artifactsRoot
    process.env.E2E_BASE_DIR = artifactsRoot
    process.env.E2E_RUN_ID = this.runId
    process.env.RUN_ID = this.runId

    this.log('info', `Run ID: ${this.runId}`)
    this.log('info', `Artifacts: ${this.artifacts.getRunDir()}`)
    if (this.options.captureLogsToFile) {
      this.log('info', `Runner log file: ${this.artifacts.getRunnerLogPath()}`)
    }
    if (this.containerLogPath) {
      this.log('info', `Container logs: ${this.containerLogPath}`)
    }

    this.startTerminalLogCapture()
  }

  private finishDryRun(): number {
    this.log('info', 'Dry run complete')
    return this.finalize(IntegrationTestsRunner.EXIT_SUCCESS, 'success')
  }

  private async executePlatformFlow(): Promise<void> {
    this.log('info', 'Starting platform...')
    await this.platformRuntime.startContainers()

    await this.platformRuntime.exportPlatformInfo()

    this.log('info', 'Waiting for health checks...')
    await this.platformRuntime.checkAllHealthy()
    this.log('success', 'Platform is ready')

    await this.startContainerLogCapture()
  }

  private async runE2e(): Promise<E2eExecutionResult | undefined> {
    this.log('info', 'Running E2E tests...')
    const result = await this.platformRuntime.startE2eContainer()
    if (!result) {
      return undefined
    }

    const e2eResult: E2eExecutionResult = {
      exitCode: result.exitCode,
      success: result.success,
      durationMs: result.duration,
    }

    this.log(
      result.success ? 'success' : 'error',
      `E2E ${result.success ? 'passed' : 'failed'} (exit ${result.exitCode})`
    )

    return e2eResult
  }

  private finalizeByE2eResult(e2eResult?: E2eExecutionResult): number {
    const successfulRun = e2eResult?.success !== false
    const exitCode = successfulRun ? IntegrationTestsRunner.EXIT_SUCCESS : IntegrationTestsRunner.EXIT_FAILURE
    return this.finalize(exitCode, successfulRun ? 'success' : 'failure', e2eResult)
  }

  private loadConfig(): PlatformConfig | undefined {
    if (!this.platformRuntime.hasValidatedConfig()) {
      this.log('error', 'Configuration validation failed')
      return undefined
    }
    return this.platformRuntime.getValidatedConfig()
  }

  private async cleanup(): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    if (this.timeoutHandle) clearTimeout(this.timeoutHandle)

    this.stopTerminalLogCapture()

    await this.stopContainerLogCapture()

    this.log('info', 'Shutting down platform...')
    try {
      await this.platformRuntime.stopAllContainers()
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
      mode: 'e2e',
      e2eResult,
    }

    this.artifacts.writeSummary(summary)

    console.log('')
    console.log('============================================================')
    console.log(`  Run ID:     ${this.runId}`)
    console.log(`  Status:     ${status.toUpperCase()}`)
    console.log(`  Duration:   ${Math.round(durationMs / 1000)}s`)
    console.log(`  Exit Code:  ${exitCode}`)
    console.log(`  Artifacts:  ${this.artifacts.getRunDir()}`)
    console.log(`  Runner log: ${this.options.captureLogsToFile ? this.artifacts.getRunnerLogPath() : 'disabled'}`)
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
    return path.join(this.artifacts.getLogsDir(), 'containers.log')
  }

  private async startContainerLogCapture(): Promise<void> {
    if (!this.containerLogPath) return

    this.ensureContainerLogWriter()

    const containers = this.platformRuntime.getAllContainers()
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
    // Keep all generated log files local to the selected artifacts path.
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

  private generateRunId(): string {
    const now = new Date()
    return `${now.toISOString().slice(0, 10).replace(/-/g, '')}-${now
      .toISOString()
      .slice(11, 19)
      .replace(/:/g, '')}-${Math.random().toString(36).slice(2, 6)}`
  }
}
