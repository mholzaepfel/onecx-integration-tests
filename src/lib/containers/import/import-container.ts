import { AbstractStartedContainer, GenericContainer, StartedTestContainer } from 'testcontainers'
import * as fs from 'fs'
import * as path from 'path'
import { HealthCheckableContainer } from '../../models/interfaces/health-checkable-container.interface'
import { HealthCheckExecutor } from '../../models/interfaces/health-check-executor.interface'
import { SkipHealthCheckExecutor } from '../../utils/health-check-executor'
import { PlatformConfig } from 'src/lib/models'

export class ImportManagerContainer extends GenericContainer {
  private containerName = 'importManager'
  private importScript = 'import-runner.ts' // Default import script
  protected loggingEnabled = false

  protected logFilePath?: string

  constructor(
    image: string,
    private readonly containerInfoPath: string,
    private readonly platformConfig: PlatformConfig
  ) {
    super(image)
    this.withNetworkAliases(this.containerName)
  }

  withContainerName(containerName: string): this {
    this.containerName = containerName
    return this
  }

  withImportScript(scriptName: string): this {
    this.importScript = scriptName
    return this
  }

  withLoggingEnabled(log: boolean): this {
    this.loggingEnabled = log
    return this
  }

  withLogFilePath(filePath: string): this {
    this.logFilePath = filePath
    return this
  }

  protected getFormattedLogLine(line: string | Buffer): string {
    const timestamp = new Date().toISOString()
    const text = typeof line === 'string' ? line : line.toString()
    return `[${timestamp}] ${text}`
  }

  protected writeLogToFile(line: string | Buffer, logFilePath: string): void {
    const formatted = this.getFormattedLogLine(line)
    fs.appendFileSync(logFilePath, `${formatted}\n`)
  }

  override async start(): Promise<StartedImportManagerContainer> {
    const { importsPath } = this.platformConfig.config ?? {}
    const resolvedImportsPath = importsPath ? path.resolve(importsPath) : path.resolve(__dirname, '../../../imports')
    const scriptsPath = path.resolve(__dirname, '../../../imports-scripts')

    this.withCopyFilesToContainer([
      {
        source: this.containerInfoPath,
        target: '/app/container-info.json',
      },
    ])
      .withCopyDirectoriesToContainer([
        {
          source: scriptsPath,
          target: '/app',
        },
        {
          source: resolvedImportsPath,
          target: '/app',
        },
      ])
      .withCommand([
        'sh',
        '-c',
        [
          'cd /app',
          'ls -a',
          'cd ./workspace',
          'ls -a',
          'cd ..',
          `npm install --no-audit --no-fund --prefer-offline ts-node@10.9.2 typescript@5.7.3 @types/node@20 axios`,
          `npx ts-node ${this.importScript}`,
        ].join(' && '),
      ])
    if (this.logFilePath) {
      this.withLogConsumer((stream) => {
        stream.on('data', (line) => this.writeLogToFile(line, this.logFilePath!))
        stream.on('err', (line) => this.writeLogToFile(line, this.logFilePath!))
      })
    }

    return new StartedImportManagerContainer(await super.start())
  }
}

export class StartedImportManagerContainer extends AbstractStartedContainer implements HealthCheckableContainer {
  constructor(startedTestContainer: StartedTestContainer) {
    super(startedTestContainer)
  }

  /**
   * Import manager container doesn't need health checks - it runs to completion
   */
  getHealthCheckExecutor(): HealthCheckExecutor {
    return new SkipHealthCheckExecutor('Import Manager')
  }
}
