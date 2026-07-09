import { AbstractStartedContainer, GenericContainer, StartedTestContainer, Wait } from 'testcontainers'
import * as fs from 'fs'
import { BffDetails } from '../../models/interfaces/bff.interface'
import { StartedOnecxKeycloakContainer } from '../core/onecx-keycloak'
import { HealthCheckableContainer } from '../../models/interfaces/health-checkable-container.interface'
import { HealthCheckExecutor } from '../../models/interfaces/health-check-executor.interface'
import { buildHealthCheckUrl } from '../../utils/health-check.utils'
import { HttpHealthCheckExecutor, SkipHealthCheckExecutor } from '../../utils/health-check-executor'
import { getCommonEnvironmentVariables } from '../../utils/common-env.utils'
import {
  CommandHealthCheckConfig,
  HealthCheckConfig,
} from '../../models/interfaces/testcontainers-health-check.adapter'
import { buildWaitStrategies, toTestcontainersHealthCheck } from '../../utils/wait-strategy.utils'

const DEFAULT_COMMAND_HEALTH_CHECK = (port: number): CommandHealthCheckConfig => ({
  test: ['CMD-SHELL', `curl --head -fsS http://localhost:${port}/q/health`],
  interval: 10_000,
  timeout: 5_000,
  retries: 3,
})

export class BffContainer extends GenericContainer {
  private details: BffDetails = {
    permissionsProductName: '',
  }

  private port = 8080

  protected loggingEnabled = false

  protected logFilePath?: string

  private commandHealthCheckConfig?: CommandHealthCheckConfig
  private healthCheckConfigs: HealthCheckConfig[] = []

  constructor(image: string, private readonly keycloakContainer: StartedOnecxKeycloakContainer) {
    super(image)
  }

  withPermissionsProductName(permissionsProductName: string): this {
    this.details.permissionsProductName = permissionsProductName
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

  getKeycloakContainer() {
    return this.keycloakContainer
  }

  getPort() {
    return this.port
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

  override async start(): Promise<StartedBffContainer> {
    const hasCustomConfig = this.commandHealthCheckConfig !== undefined || this.healthCheckConfigs.length > 0

    // Use the provided commandHealthCheck, or fall back to the default when nothing is configured
    const effectiveCommandHC =
      this.commandHealthCheckConfig ?? (hasCustomConfig ? undefined : DEFAULT_COMMAND_HEALTH_CHECK(this.port))

    if (effectiveCommandHC) {
      this.withHealthCheck(toTestcontainersHealthCheck(effectiveCommandHC))
    }

    const waitStrategies = buildWaitStrategies(effectiveCommandHC, this.healthCheckConfigs)

    this.withEnvironment({
      ...this.environment,
      ONECX_PERMISSIONS_PRODUCT_NAME: this.details.permissionsProductName,
    }).withEnvironment(getCommonEnvironmentVariables(this.keycloakContainer))

    if (this.logFilePath) {
      this.withLogConsumer((stream) => {
        stream.on('data', (line) => this.writeLogToFile(line, this.logFilePath!))
        stream.on('err', (line) => this.writeLogToFile(line, this.logFilePath!))
      })
    }

    this.withExposedPorts(this.port).withWaitStrategy(Wait.forAll([...waitStrategies, Wait.forListeningPorts()]))

    return new StartedBffContainer(
      await super.start(),
      this.details,
      this.networkAliases,
      this.port,
      effectiveCommandHC,
      this.healthCheckConfigs
    )
  }
}

export class StartedBffContainer extends AbstractStartedContainer implements HealthCheckableContainer {
  constructor(
    startedTestContainer: StartedTestContainer,
    private readonly details: BffDetails,
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

  getPermissionProductName() {
    return this.details.permissionsProductName
  }

  getNetworkAliases(): string[] {
    return this.networkAliases
  }

  getPort(): number {
    return this.port
  }
}
