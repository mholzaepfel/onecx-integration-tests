import { AbstractStartedContainer, GenericContainer, StartedTestContainer, Wait } from 'testcontainers'
import * as fs from 'fs'
import { SvcDetails, SvcContainerServices } from '../../models/interfaces/svc.interface'
import { getCommonEnvironmentVariables } from '../../utils/common-env.utils'
import { HealthCheckableContainer } from '../../models/interfaces/health-checkable-container.interface'
import { HealthCheckExecutor } from '../../models/interfaces/health-check-executor.interface'
import { buildHealthCheckUrl } from '../../utils/health-check.utils'
import { HttpHealthCheckExecutor, SkipHealthCheckExecutor } from '../../utils/health-check-executor'
import {
  CommandHealthCheckConfig,
  HealthCheckConfig,
} from '../../models/interfaces/testcontainers-health-check.adapter'
import { buildWaitStrategies, toTestcontainersHealthCheck } from '../../utils/wait-strategy.utils'

const DEFAULT_COMMAND_HEALTH_CHECK: CommandHealthCheckConfig = {
  test: ['CMD-SHELL', 'curl --head -fsS http://localhost:8080/q/health'],
  interval: 10_000,
  timeout: 5_000,
  retries: 3,
}

export class SvcContainer extends GenericContainer {
  protected details: SvcDetails = {
    databaseUsername: '',
    databasePassword: '',
  }

  protected shouldCreateDatabase = true

  protected loggingEnabled = false

  protected logFilePath?: string

  private port = 8080

  private commandHealthCheckConfig?: CommandHealthCheckConfig
  private healthCheckConfigs: HealthCheckConfig[] = []

  constructor(image: string, private services: SvcContainerServices) {
    super(image)
    this.withExposedPorts(this.port)
  }

  withDatabaseUsername(databaseUsername: string): this {
    this.details.databaseUsername = databaseUsername
    return this
  }

  withDatabasePassword(databasePassword: string): this {
    this.details.databasePassword = databasePassword
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

  getKeycloakContainer() {
    return this.services.keycloakContainer
  }

  getPostgresContainer() {
    return this.services.databaseContainer
  }

  protected validateDatabaseCredentials(): void {
    if (!this.details.databaseUsername || !this.details.databasePassword) {
      throw new Error('Database credentials must be set using withDatabaseUsername and withDatabasePassword')
    }
  }

  createDatabaseAtStart(shouldStart: boolean) {
    this.shouldCreateDatabase = shouldStart
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

  override async start(): Promise<StartedSvcContainer> {
    if (this.shouldCreateDatabase) {
      this.validateDatabaseCredentials()
      await this.services.databaseContainer?.createUserAndDatabase(
        this.details.databaseUsername,
        this.details.databasePassword
      )
    }

    const hasCustomConfig = this.commandHealthCheckConfig !== undefined || this.healthCheckConfigs.length > 0

    // Use the provided commandHealthCheck, or fall back to the default when nothing is configured
    const effectiveCommandHC =
      this.commandHealthCheckConfig ?? (hasCustomConfig ? undefined : DEFAULT_COMMAND_HEALTH_CHECK)

    if (effectiveCommandHC) {
      this.withHealthCheck(toTestcontainersHealthCheck(effectiveCommandHC))
    }

    const waitStrategies = buildWaitStrategies(effectiveCommandHC, this.healthCheckConfigs)
    this.withWaitStrategy(Wait.forAll([...waitStrategies]))

    this.withEnvironment({
      ...this.environment,
      QUARKUS_DATASOURCE_USERNAME: this.details.databaseUsername,
      QUARKUS_DATASOURCE_PASSWORD: this.details.databaseUsername,
      QUARKUS_DATASOURCE_JDBC_URL: `jdbc:postgresql://${
        this.services.databaseContainer?.getNetworkAliases()[0]
      }:${this.services.databaseContainer?.getPort()}/${this.details.databaseUsername}?sslmode=disable`,
      TKIT_DATAIMPORT_ENABLED: 'true',
      ONECX_TENANT_CACHE_ENABLED: 'false',
    }).withEnvironment(getCommonEnvironmentVariables(this.services.keycloakContainer))

    if (this.logFilePath) {
      this.withLogConsumer((stream) => {
        stream.on('data', (line) => this.writeLogToFile(line, this.logFilePath!))
        stream.on('err', (line) => this.writeLogToFile(line, this.logFilePath!))
      })
    }

    return new StartedSvcContainer(
      await super.start(),
      this.details,
      this.networkAliases,
      this.port,
      effectiveCommandHC,
      this.healthCheckConfigs
    )
  }
}

export class StartedSvcContainer extends AbstractStartedContainer implements HealthCheckableContainer {
  constructor(
    startedTestContainer: StartedTestContainer,
    private readonly details: SvcDetails,
    private readonly networkAliases: string[],
    private readonly port: number,
    private readonly commandHealthCheck: CommandHealthCheckConfig | undefined,
    private readonly healthCheckConfigs: HealthCheckConfig[]
  ) {
    super(startedTestContainer)
  }

  getHealthCheckExecutor(): HealthCheckExecutor {
    if (!this.commandHealthCheck) {
      return new SkipHealthCheckExecutor('No command health check configured')
    }
    const mappedPort = this.getMappedPort(this.port)

    // Build URL from health check configuration
    const endpoint = buildHealthCheckUrl(mappedPort, this.commandHealthCheck)

    // If no valid URL can be extracted, skip health check
    if (!endpoint) {
      return new SkipHealthCheckExecutor('No valid health check URL could be extracted')
    }

    // Use timeout from health check if available, otherwise default
    const timeout = this.commandHealthCheck?.timeout || 8000

    return new HttpHealthCheckExecutor(endpoint, timeout, [200, 503])
  }

  getDatabaseUsername(): string {
    return this.details.databaseUsername
  }

  getDatabasePassword(): string {
    return this.details.databasePassword
  }

  getPort(): number {
    return this.port
  }

  getNetworkAliases(): string[] {
    return this.networkAliases
  }
}
