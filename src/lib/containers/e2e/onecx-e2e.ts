import { GenericContainer, StartedTestContainer, AbstractStartedContainer, Wait } from 'testcontainers'
import Dockerode from 'dockerode'
import { E2eContainerInterface } from '../../models/e2e.interface'
import { HealthCheckableContainer } from '../../models/health-checkable-container.interface'
import { HealthCheckExecutor } from '../../models/health-check-executor.interface'
import { SkipHealthCheckExecutor } from '../../utils/health-check-executor'
import { getE2eOutputPath, E2E_CONTAINER_OUTPUT_PATH } from '../../config/e2e-constants'
import { Logger } from '../../utils/logger'

const logger = new Logger('E2eContainer')

/**
 * E2E test container that runs playwright/cypress tests against the platform.
 * The container is expected to exit with code 0 (success) or 1 (failure).
 * Results are written under integration-tests/artefacts/<runId>/report-e2e
 */
export class E2eContainer extends GenericContainer {
  protected loggingEnabled = false
  private baseUrl = ''

  /**
   * Create an E2E container
   * @param image Resolved Docker image name
   * @param config E2E container configuration (networkAlias, baseUrl)
   */
  constructor(image: string) {
    super(image)
  }

  enableLogging(log: boolean): this {
    this.loggingEnabled = log
    return this
  }

  withBaseUrl(baseUrl: string): this {
    this.baseUrl = baseUrl
    return this
  }

  override async start(): Promise<StartedE2eContainer> {
    // Add network alias
    this.withNetworkAliases(this.networkAliases[0])

    // Pass BASE_URL environment variable if configured
    if (this.baseUrl) {
      this.withEnvironment({ BASE_URL: this.baseUrl })
      logger.info(`E2E BASE_URL: ${this.baseUrl}`)
    }

    // Mount fixed output directory for E2E results
    const outputPath = getE2eOutputPath()
    this.withBindMounts([
      {
        source: outputPath,
        target: E2E_CONTAINER_OUTPUT_PATH,
        mode: 'rw' as const,
      },
    ])
    logger.info(`E2E output directory: ${outputPath} -> ${E2E_CONTAINER_OUTPUT_PATH}`)

    // Use one-shot wait strategy for containers that exit on their own
    // This waits for the container to stop with exit code 0
    this.withWaitStrategy(Wait.forOneShotStartup())

    // Set a reasonable startup timeout (10 minutes for E2E tests)
    this.withStartupTimeout(10 * 60 * 1000)

    // Enable logging if configured
    if (this.loggingEnabled) {
      this.withLogConsumer((stream) => {
        stream.on('data', (line) => console.log(`${this.networkAliases[0]}: `, line))
        stream.on('err', (line) => console.error(`${this.networkAliases[0]}: `, line))
        stream.on('end', () => console.log(`${this.networkAliases[0]}: Stream closed`))
      })
    }

    const startedContainer = await super.start()
    return new StartedE2eContainer(startedContainer, this.networkAliases)
  }
}

export class StartedE2eContainer extends AbstractStartedContainer implements HealthCheckableContainer {
  constructor(startedTestContainer: StartedTestContainer, private readonly networkAlias: string[]) {
    super(startedTestContainer)
  }

  /**
   * E2E containers don't have health endpoints - skip health check
   */
  getHealthCheckExecutor(): HealthCheckExecutor {
    return new SkipHealthCheckExecutor('E2E Container')
  }

  /**
   * Get network aliases (for consistency with other containers)
   */
  getNetworkAliases(): string[] {
    return this.networkAlias
  }

  /**
   * Get the exit code from the stopped container
   * Since we use Wait.forOneShotStartup(), the container has already exited when start() completes
   */
  async getExitCode(): Promise<number> {
    try {
      const dockerode = new Dockerode()
      const dockerContainer = dockerode.getContainer(this.getId())
      const inspectData = await dockerContainer.inspect()
      return inspectData.State.ExitCode
    } catch (error) {
      logger.error(`Failed to get exit code: ${error}`)
      return 1 // Return error code if inspection fails
    }
  }
}
