import * as fs from 'fs'
import * as path from 'path'
import { ArtifactsManager } from './artifacts/artifacts-manager'
import { CliOptions } from './types/cli-options.interface'
import { RunSummary } from './types/run-summary.interface'
import { E2eAggregateResult, E2eExecutionReport, E2eExecutionResult } from './types/results.interface'
import { ContainerWithLogs } from './types/container-logs.interface'
import { PlatformConfig } from '../lib/models/interfaces/platform-config.interface'
import { Logger, LoggerLevel } from '../lib/utils/logger'
import { applyRunContextEnv, resolveRunContextPaths } from '../lib/utils/run-context'
import { PlatformManager, LogFilePathProvider } from '../lib/platform/platform-manager'
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
  private interruptedSignal?: string
  private sigintHandler?: () => void
  private sigtermHandler?: () => void

  constructor(options: CliOptions, platformFactory?: () => PlatformRuntime) {
    this.options = options
    this.runId = this.generateRunId()
    this.artifacts = new ArtifactsManager(undefined, this.runId)
    const runnerLogFilePath = options.captureLogsToFile ? this.artifacts.getRunnerLogPath() : undefined
    Logger.configureGlobalFilePath(runnerLogFilePath)
    this.logger = new Logger('IntegrationTestsRunner')

    // Create log file path provider for containers
    const logFilePathProvider: LogFilePathProvider = (containerName: string) =>
      this.artifacts.getContainerLogPath(containerName)

    const factory = platformFactory ?? (() => new PlatformManager(undefined, logFilePathProvider))
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
      const e2eReport = await this.runE2eSequence()
      if (e2eReport) {
        this.artifacts.writeE2eExecutions(e2eReport)
      }

      this.log('info', 'Collecting artifacts...')
      this.artifacts.copyE2eResults()

      await this.cleanup()
      return this.finalizeByE2eResult(e2eReport)
    } catch (error) {
      this.log('error', `Error: ${error}`)
      await this.cleanup()
      return this.finalize(
        IntegrationTestsRunner.EXIT_FAILURE,
        this.interruptedSignal ? 'failure' : 'error',
        undefined,
        this.interruptedSignal
      )
    }
  }

  private initializeRunContext(): void {
    this.artifacts.ensureDirectories()
    this.containerLogPath = this.resolveContainerLogPath()

    const runContext = resolveRunContextPaths(this.artifacts.getArtifactsRoot(), this.runId)
    applyRunContextEnv(runContext)

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
    this.throwIfInterrupted()

    this.log('info', 'Starting platform...')
    await this.platformRuntime.startContainers()

    this.throwIfInterrupted()
    await this.platformRuntime.exportPlatformInfo()

    this.log('info', 'Waiting for platform health checks...')
    await this.platformRuntime.checkAllHealthy()
    this.log('info', 'Platform startup completed; all containers healthy')

    await this.startContainerLogCapture()
  }

  private async runE2eSequence(): Promise<E2eExecutionReport | undefined> {
    this.throwIfInterrupted()

    this.log('info', 'Starting E2E tests...')
    const results = await this.platformRuntime.startE2eContainers(() => !this.interruptedSignal)
    if (!results) {
      return undefined
    }

    const e2eExecutions: E2eExecutionResult[] = results.map((record) => ({
      networkAlias: record.networkAlias,
      sequence: record.sequence,
      total: record.total,
      status: record.status,
      success: record.success,
      exitCode: record.exitCode,
      errorMessage: record.errorMessage,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      durationMs: record.duration,
    }))

    for (const record of e2eExecutions) {
      const prefix = `E2E ${record.sequence}/${record.total} (${record.networkAlias})`
      const detail = record.exitCode !== undefined ? `exit=${record.exitCode}` : record.errorMessage ?? 'no-exit-code'
      const message = `${prefix} -> ${record.status} (${detail})`
      this.log(record.success ? 'info' : 'error', message)
    }

    const succeeded = e2eExecutions.filter((entry) => entry.success).length
    const aggregate: E2eAggregateResult = {
      total: e2eExecutions.length,
      succeeded,
      failed: e2eExecutions.length - succeeded,
      finalStatus: e2eExecutions.length - succeeded > 0 ? 'failure' : 'success',
    }

    this.log(
      aggregate.failed > 0 ? 'error' : 'info',
      `E2E summary: total=${aggregate.total}, succeeded=${aggregate.succeeded}, failed=${aggregate.failed}`
    )

    return {
      records: e2eExecutions,
      aggregate,
    }
  }

  private finalizeByE2eResult(e2eReport?: E2eExecutionReport): number {
    const successfulRun = (e2eReport?.aggregate.failed ?? 0) === 0 && !this.interruptedSignal
    const exitCode = successfulRun ? IntegrationTestsRunner.EXIT_SUCCESS : IntegrationTestsRunner.EXIT_FAILURE
    return this.finalize(exitCode, successfulRun ? 'success' : 'failure', e2eReport, this.interruptedSignal)
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
    await Logger.closeGlobalWriter()
    this.removeSignalHandlers()
  }

  private finalize(
    exitCode: number,
    status: 'success' | 'failure' | 'timeout' | 'error',
    e2eReport?: E2eExecutionReport,
    interruptedBy?: string
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
      e2eExecutions: e2eReport?.records,
      e2eAggregate: e2eReport?.aggregate,
      interruptedBy: interruptedBy === 'SIGINT' || interruptedBy === 'SIGTERM' ? interruptedBy : undefined,
    }

    this.artifacts.writeSummary(summary)

    console.log('')
    console.log('═'.repeat(65))
    console.log(`  Test Run Summary`)
    console.log('─'.repeat(65))
    console.log(`  Run ID:         ${this.runId}`)
    console.log(`  Status:         ${status.toUpperCase()}`)
    console.log(`  Duration:       ${Math.round(durationMs / 1000)}s`)
    console.log(`  Exit Code:      ${exitCode}`)
    if (e2eReport?.aggregate) {
      console.log(`  E2E Total:      ${e2eReport.aggregate.total}`)
      console.log(`  E2E Succeeded:  ${e2eReport.aggregate.succeeded}`)
      console.log(`  E2E Failed:     ${e2eReport.aggregate.failed}`)
    }
    if (interruptedBy) {
      console.log(`  Interrupted By: ${interruptedBy}`)
    }
    console.log('─'.repeat(65))
    console.log(`  Artifacts Dir:  ${this.artifacts.getRunDir()}`)
    if (this.options.captureLogsToFile) {
      console.log(`  Runner Log:     ${this.artifacts.getRunnerLogPath()}`)
      console.log(`  Container Logs: ${path.join(this.artifacts.getLogsDir(), 'containers/')}`)
    }
    console.log('═'.repeat(65))

    this.removeSignalHandlers()

    return exitCode
  }

  private setupSignalHandlers(): void {
    const handler = (signal: 'SIGINT' | 'SIGTERM') => {
      this.interruptedSignal = signal
      this.log('warn', `Received ${signal}; runner will stop after current step and finalize safely`)
    }

    this.sigintHandler = () => handler('SIGINT')
    this.sigtermHandler = () => handler('SIGTERM')

    process.on('SIGINT', this.sigintHandler)
    process.on('SIGTERM', this.sigtermHandler)
  }

  private throwIfInterrupted(): void {
    if (this.interruptedSignal) {
      throw new Error(`Interrupted by ${this.interruptedSignal}`)
    }
  }

  private removeSignalHandlers(): void {
    if (this.sigintHandler) {
      process.off('SIGINT', this.sigintHandler)
      this.sigintHandler = undefined
    }

    if (this.sigtermHandler) {
      process.off('SIGTERM', this.sigtermHandler)
      this.sigtermHandler = undefined
    }
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
