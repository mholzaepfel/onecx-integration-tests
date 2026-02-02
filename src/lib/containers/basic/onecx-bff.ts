import { AbstractStartedContainer, GenericContainer, StartedTestContainer, Wait } from 'testcontainers'
import { HealthCheck } from 'testcontainers/build/types'
import { BffDetails } from '../../models/bff.interface'
import { StartedOnecxKeycloakContainer } from '../core/onecx-keycloak'
import { HealthCheckableContainer } from '../../models/health-checkable-container.interface'
import { HealthCheckExecutor } from '../../models/health-check-executor.interface'
import { buildHealthCheckUrl } from '../../utils/health-check.utils'
import { HttpHealthCheckExecutor, SkipHealthCheckExecutor } from '../../utils/health-check-executor'
import { getCommonEnvironmentVariables } from '../../utils/common-env.utils'

export class BffContainer extends GenericContainer {
  private details: BffDetails = {
    permissionsProductName: '',
  }

  private port = 8080

  protected loggingEnabled = false

  constructor(image: string, private readonly keycloakContainer: StartedOnecxKeycloakContainer) {
    super(image)
  }

  private setDefaultHealthCheck(port: number): HealthCheck {
    return {
      test: ['CMD-SHELL', `curl --head -fsS http://localhost:${port}/q/health`],
      interval: 10_000,
      timeout: 5_000,
      retries: 3,
    }
  }

  withPermissionsProductName(permissionsProductName: string): this {
    this.details.permissionsProductName = permissionsProductName
    return this
  }

  withPort(port: number): this {
    this.port = port
    return this
  }

  getKeycloakContainer() {
    return this.keycloakContainer
  }

  getPort() {
    return this.port
  }

  enableLogging(log: boolean): this {
    this.loggingEnabled = log
    return this
  }

  override async start(): Promise<StartedBffContainer> {
    // Apply the default health check explicitly if it has not been set.
    // This ensures the healthcheck is correctly registered before container startup
    if (!this.healthCheck) {
      const defaultHealthCheck: HealthCheck = this.setDefaultHealthCheck(this.port)
      this.withHealthCheck(defaultHealthCheck)
    }

    this.withEnvironment({
      ...this.environment,
      ONECX_PERMISSIONS_PRODUCT_NAME: this.details.permissionsProductName,
    }).withEnvironment(getCommonEnvironmentVariables(this.keycloakContainer))

    if (this.loggingEnabled) {
      this.withLogConsumer((stream) => {
        stream.on('data', (line) => console.log(`${this.networkAliases[0]}: `, line))
        stream.on('err', (line) => console.error(`${this.networkAliases[0]}: `, line))
        stream.on('end', () => console.log(`${this.networkAliases[0]}: Stream closed`))
      })
    }

    this.withExposedPorts(this.port).withWaitStrategy(Wait.forAll([Wait.forHealthCheck(), Wait.forListeningPorts()]))
    return new StartedBffContainer(
      await super.start(),
      this.details,
      this.networkAliases,
      this.port,
      this.healthCheck || this.setDefaultHealthCheck(this.port)
    )
  }
}

export class StartedBffContainer extends AbstractStartedContainer implements HealthCheckableContainer {
  constructor(
    startedTestContainer: StartedTestContainer,
    private readonly details: BffDetails,
    private readonly networkAliases: string[],
    private readonly port: number,
    private readonly healthCheck: HealthCheck
  ) {
    super(startedTestContainer)
  }

  /**
   * Creates Quarkus-specific health check strategy
   * Uses URL from health check or falls back to default
   */
  getHealthCheckExecutor(): HealthCheckExecutor {
    const mappedPort = this.getMappedPort(this.port)

    // Build URL from health check configuration
    const endpoint = buildHealthCheckUrl(mappedPort, this.healthCheck)

    // If no valid URL can be extracted, skip health check
    if (!endpoint) {
      return new SkipHealthCheckExecutor('No valid health check URL could be extracted')
    }

    // Use timeout from health check if available, otherwise default
    const timeout = this.healthCheck?.timeout || 8000

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
