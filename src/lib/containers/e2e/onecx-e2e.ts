import { GenericContainer, StartedTestContainer, AbstractStartedContainer, Wait } from 'testcontainers'
import Dockerode from 'dockerode'
import { E2eContainerInterface, E2eVolumeInterface } from '../../models/e2e.interface'
import { HealthCheckableContainer } from '../../models/health-checkable-container.interface'
import { HealthCheckExecutor } from '../../models/health-check-executor.interface'
import { SkipHealthCheckExecutor } from '../../utils/health-check-executor'
import { Logger } from '../../utils/logger'

const logger = new Logger('E2eContainer')

export class E2eContainer extends GenericContainer {
  protected loggingEnabled = false
  private volumes: E2eVolumeInterface[] = []
  private networkAlias = ''

  constructor(image: string, networkAlias?: string) {
    super(image)
    // Extract network alias from image name if not provided (e.g., 'workspace-e2e:1.0.0' -> 'workspace-e2e')
    this.networkAlias = networkAlias || this.extractNetworkAliasFromImage(image)
  }

  /**
   * Extract network alias from Docker image name
   * Examples:
   *   'workspace-e2e:1.0.0' -> 'workspace-e2e'
   *   'myregistry.io/workspace-e2e:latest' -> 'workspace-e2e'
   */
  private extractNetworkAliasFromImage(image: string): string {
    // Remove registry prefix if present (e.g., 'myregistry.io/image' -> 'image')
    const withoutRegistry = image.includes('/') ? image.split('/').pop()! : image
    // Remove tag if present (e.g., 'image:1.0.0' -> 'image')
    const withoutTag = withoutRegistry.split(':')[0]
    return withoutTag
  }

  withVolumes(volumes: E2eVolumeInterface[]): this {
    this.volumes = volumes
    return this
  }

  enableLogging(log: boolean): this {
    this.loggingEnabled = log
    return this
  }

  override async start(): Promise<StartedE2eContainer> {
    // Add network alias
    this.withNetworkAliases(this.networkAlias)

    // Add volume mounts
    if (this.volumes.length > 0) {
      const bindMounts = this.volumes.map((vol) => ({
        source: this.resolveEnvVariables(vol.hostPath),
        target: vol.containerPath,
        mode: 'rw' as const,
      }))
      this.withBindMounts(bindMounts)
    }

    // Use one-shot wait strategy for containers that exit on their own
    // This waits for the container to stop with exit code 0
    this.withWaitStrategy(Wait.forOneShotStartup())

    // Set a reasonable startup timeout (10 minutes for E2E tests)
    this.withStartupTimeout(10 * 60 * 1000)

    // Enable logging if configured
    if (this.loggingEnabled) {
      this.withLogConsumer((stream) => {
        stream.on('data', (line) => console.log(`${this.networkAlias}: `, line))
        stream.on('err', (line) => console.error(`${this.networkAlias}: `, line))
        stream.on('end', () => console.log(`${this.networkAlias}: Stream closed`))
      })
    }

    logger.info(`Starting E2E container with one-shot strategy (max 10min)...`)
    const startedContainer = await super.start()
    return new StartedE2eContainer(startedContainer, this.networkAlias)
  }

  /**
   * Resolve environment variables in a string (e.g., ${VAR:-default})
   * Also converts relative paths to absolute paths for Docker volumes
   */
  private resolveEnvVariables(value: string): string {
    // First resolve environment variables
    const resolved = value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const [varName, defaultValue] = envVar.split(':-')
      return process.env[varName] || defaultValue || ''
    })

    // Convert relative paths to absolute paths for Docker volume mounting
    // Docker requires absolute paths for host directories
    if (resolved && !resolved.startsWith('/')) {
      const path = require('path')
      return path.resolve(process.cwd(), resolved)
    }

    return resolved
  }
}

export class StartedE2eContainer extends AbstractStartedContainer implements HealthCheckableContainer {
  constructor(startedTestContainer: StartedTestContainer, private readonly networkAlias: string) {
    super(startedTestContainer)
  }

  /**
   * E2E containers don't have health endpoints - skip health check
   */
  getHealthCheckExecutor(): HealthCheckExecutor {
    return new SkipHealthCheckExecutor('E2E Container')
  }

  getNetworkAlias(): string {
    return this.networkAlias
  }

  /**
   * Get network aliases (for consistency with other containers)
   */
  getNetworkAliases(): string[] {
    return [this.networkAlias]
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
