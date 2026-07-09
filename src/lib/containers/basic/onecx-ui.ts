import { AbstractStartedContainer, GenericContainer, StartedTestContainer, Wait } from 'testcontainers'
import * as fs from 'fs'
import { UiDetails } from '../../models/interfaces/ui.interface'
import { HealthCheckableContainer } from '../../models/interfaces/health-checkable-container.interface'
import { HealthCheckExecutor } from '../../models/interfaces/health-check-executor.interface'
import { SkipHealthCheckExecutor } from '../../utils/health-check-executor'
import {
  CommandHealthCheckConfig,
  HealthCheckConfig,
} from '../../models/interfaces/testcontainers-health-check.adapter'
import { buildWaitStrategies, toTestcontainersHealthCheck } from '../../utils/wait-strategy.utils'

const DEFAULT_LOG_WAIT_MESSAGE = /start worker process/

export class UiContainer extends GenericContainer {
  private details: UiDetails = {
    appBaseHref: '',
    appId: '',
    productName: '',
  }

  private port = 8080

  protected loggingEnabled = false

  protected logFilePath?: string

  private commandHealthCheckConfig?: CommandHealthCheckConfig
  private healthCheckConfigs: HealthCheckConfig[] = []

  constructor(image: string) {
    super(image)
  }

  withAppBaseHref(appBaseHref: string): this {
    this.details.appBaseHref = appBaseHref
    return this
  }

  withAppId(appId: string): this {
    this.details.appId = appId
    return this
  }

  withProductName(productName: string): this {
    this.details.productName = productName
    return this
  }

  withPort(port: number): this {
    this.port = port
    return this
  }

  withCommandHealthCheck(config: CommandHealthCheckConfig): this {
    this.commandHealthCheckConfig = config
    return this
  }

  withHealthChecks(configs: HealthCheckConfig[]): this {
    this.healthCheckConfigs = configs
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

  override async start(): Promise<StartedUiContainer> {
    this.withEnvironment({
      ...this.environment,
      APP_BASE_HREF: `${this.details.appBaseHref}`,
      APP_ID: `${this.details.appId}`,
      PRODUCT_NAME: `${this.details.productName}`,
    })

    if (this.logFilePath) {
      this.withLogConsumer((stream) => {
        stream.on('data', (line) => this.writeLogToFile(line, this.logFilePath!))
        stream.on('err', (line) => this.writeLogToFile(line, this.logFilePath!))
      })
    }

    this.withExposedPorts(this.port)

    const hasCustomConfig = this.commandHealthCheckConfig !== undefined || this.healthCheckConfigs.length > 0

    if (this.commandHealthCheckConfig) {
      this.withHealthCheck(toTestcontainersHealthCheck(this.commandHealthCheckConfig))
    }

    if (hasCustomConfig) {
      const waitStrategies = buildWaitStrategies(this.commandHealthCheckConfig, this.healthCheckConfigs)
      this.withWaitStrategy(Wait.forAll(waitStrategies))
    } else {
      // Default: wait for nginx worker process log message
      this.withWaitStrategy(Wait.forLogMessage(DEFAULT_LOG_WAIT_MESSAGE)).withStartupTimeout(120_000)
    }

    return new StartedUiContainer(
      await super.start(),
      this.details,
      this.networkAliases,
      this.port,
      this.commandHealthCheckConfig,
      this.healthCheckConfigs
    )
  }
}

export class StartedUiContainer extends AbstractStartedContainer implements HealthCheckableContainer {
  constructor(
    startedTestContainer: StartedTestContainer,
    private readonly details: UiDetails,
    private readonly networkAliases: string[],
    private readonly port: number,
    private readonly commandHealthCheck: CommandHealthCheckConfig | undefined,
    private readonly healthCheckConfigs: HealthCheckConfig[]
  ) {
    super(startedTestContainer)
  }

  getHealthCheckExecutor(): HealthCheckExecutor {
    return new SkipHealthCheckExecutor('UI Container')
  }

  getAppBaseHref(): string {
    return this.details.appBaseHref
  }

  getAppId(): string {
    return this.details.appId
  }

  getProductName(): string {
    return this.details.productName
  }

  getNetworkAliases(): string[] {
    return this.networkAliases
  }

  getPort(): number {
    return this.port
  }

  getCommandHealthCheck(): CommandHealthCheckConfig | undefined {
    return this.commandHealthCheck
  }

  getHealthCheckConfigs(): HealthCheckConfig[] {
    return this.healthCheckConfigs
  }

  getStartedTestContainer(): StartedTestContainer {
    return this.startedTestContainer
  }

  getDetails(): UiDetails {
    return this.details
  }
}
