import { Network, StartedNetwork } from 'testcontainers'
import { StartedOnecxKeycloakContainer } from '../containers/core/onecx-keycloak'
import { CONTAINER } from '../models/container.enum'
import { PlatformConfig } from '../models/platform-config.interface'
import { E2eResult } from '../models/e2e.interface'
import { DEFAULT_PLATFORM_CONFIG } from '../config/default-platform-config'
import { ImageResolver } from './image-resolver'
import { HealthChecker } from './health-checker'
import { CoreContainerStarter } from './core-container-starter'
import { UserDefinedContainerStarter } from './user-defined-container-starter'
import { DataImporter } from './data-importer'
import type { AllowedContainerTypes } from '../models/allowed-container.types'
import { ContainerHealthStatus } from '../models/health-checker.interface'
import { Logger, LogMessages } from '../utils/logger'
import { PlatformConfigJsonValidator } from './json-validator'
import { StartedOnecxPostgresContainer } from '../containers/core/onecx-postgres'
import { ContainerRegistry } from './container-registry'
import { PlatformInfoExporter } from './platform-info-exporter'
import { PlatformInfo } from '../models/platform-info-exporter.interface'

const logger = new Logger('PlatformManager')

export class PlatformManager {
  /**
   * Container registry for managing all containers
   */
  private containerRegistry: ContainerRegistry = new ContainerRegistry()

  /**
   * Needed classes for startContainers
   */
  private network?: StartedNetwork
  private imageResolver?: ImageResolver
  private CoreContainerStarter?: CoreContainerStarter
  private UserDefinedContainerStarter?: UserDefinedContainerStarter
  private dataImporter?: DataImporter
  private healthChecker?: HealthChecker
  private jsonValidator: PlatformConfigJsonValidator
  private validatedConfig?: PlatformConfig
  private platformInfoExporter?: PlatformInfoExporter

  constructor(configFilePath?: string) {
    this.jsonValidator = new PlatformConfigJsonValidator()
    this.initializeConfiguration(configFilePath)
  }

  /**
   * Orchestrates the startup of the default services and the creation of user-defined containers.
   * @param config Optional config override. If not provided, uses validated config from constructor or default config
   */
  async startContainers(config?: PlatformConfig): Promise<void> {
    // Use validated config from constructor if available, otherwise use provided config or default
    const finalConfig = config || this.validatedConfig || DEFAULT_PLATFORM_CONFIG

    // Configure logger based on platform config
    logger.setPlatformConfig(finalConfig)

    logger.info(LogMessages.PLATFORM_MANAGER_INIT)
    this.healthChecker = new HealthChecker()

    // Configure heartbeat from platform config
    this.healthChecker.configureHeartbeat(finalConfig.heartbeat)

    this.imageResolver = new ImageResolver()
    this.dataImporter = new DataImporter(this.imageResolver)

    logger.info(LogMessages.NETWORK_CREATE)
    this.network = await new Network().start()
    logger.success(LogMessages.NETWORK_CREATED)

    this.CoreContainerStarter = new CoreContainerStarter(
      this.imageResolver,
      this.network,
      this.containerRegistry,
      finalConfig
    )

    logger.info(LogMessages.PLATFORM_START)
    // Always start core services first
    await this.CoreContainerStarter.startCoreContainers()
    const postgres = this.containerRegistry.getContainer(CONTAINER.POSTGRES) as StartedOnecxPostgresContainer
    const keycloak = this.containerRegistry.getContainer(CONTAINER.KEYCLOAK) as StartedOnecxKeycloakContainer

    await this.CoreContainerStarter.startServiceContainers(postgres, keycloak)

    // Start BFF containers based on configuration
    await this.CoreContainerStarter.startBffContainers(keycloak)

    // Start UI containers based on configuration
    await this.CoreContainerStarter.startUiContainers(keycloak)
    // Create user-defined containers if defined in configuration
    if (finalConfig.container) {
      // Initialize container factory with core services
      this.UserDefinedContainerStarter = new UserDefinedContainerStarter(
        this.network,
        this.imageResolver,
        this.containerRegistry,
        postgres,
        keycloak
      )
      await this.createContainers(finalConfig)
    }

    // Import data if configured
    if (finalConfig.importData && this.network && this.dataImporter) {
      this.dataImporter.createContainerInfo(this.containerRegistry.getAllContainers())
      await this.dataImporter.importDefaultData(this.network, this.containerRegistry.getAllContainers(), finalConfig)
    }

    logger.success(LogMessages.PLATFORM_READY)

    // Start heartbeat monitoring if configured
    this.healthChecker.startHeartbeat(this.containerRegistry.getAllContainers())

    // Initialize exporter after all containers are started
    if (this.network) {
      this.platformInfoExporter = new PlatformInfoExporter(this.containerRegistry, this.network)
    }
  }

  /**
   * Get the validated configuration
   */
  getValidatedConfig(): PlatformConfig | undefined {
    return this.validatedConfig
  }

  /**
   * Check if a valid configuration file was found and loaded
   */
  hasValidatedConfig(): boolean {
    return this.validatedConfig !== undefined
  }

  /**
   * Get the JSON validator instance
   */
  getJsonValidator(): PlatformConfigJsonValidator {
    return this.jsonValidator
  }

  /**
   * Check the health of all running containers
   */
  async checkAllHealthy(): Promise<ContainerHealthStatus[]> {
    if (!this.healthChecker) {
      throw new Error('HealthChecker not initialized. Call startContainers first.')
    }
    return await this.healthChecker.checkAllHealthy(this.containerRegistry.getAllContainers())
  }

  /**
   * Check the health of one runnting contianer
   * @param containerName
   * @returns
   */
  async checkHealthy(containerName: string): Promise<ContainerHealthStatus> {
    if (!this.healthChecker) {
      throw new Error('HealthChecker not initialized. Call startContainers first.')
    }
    return await this.healthChecker.checkHealthy(this.containerRegistry.getAllContainers(), containerName)
  }

  /**
   * Check if heartbeat monitoring is currently running
   */
  isHeartbeatRunning(): boolean {
    return this.healthChecker?.isHeartbeatRunning() || false
  }

  /**
   * Get the current heartbeat configuration
   */
  getHeartbeatConfig() {
    return this.healthChecker?.getHeartbeatConfig()
  }

  /**
   * Start heartbeat monitoring manually
   */
  startHeartbeat(): void {
    if (!this.healthChecker) {
      throw new Error('HealthChecker not initialized. Call startContainers first.')
    }
    this.healthChecker.startHeartbeat(this.containerRegistry.getAllContainers())
  }

  /**
   * Stop heartbeat monitoring manually
   */
  stopHeartbeat(): void {
    if (this.healthChecker) {
      this.healthChecker.stopHeartbeat()
    }
  }

  /**
   * Get all containers (standard and custom)
   */
  getAllContainers(): Map<string, AllowedContainerTypes> {
    return this.containerRegistry.getAllContainers()
  }

  /**
   * Get a container by key (works for both standard and custom)
   */
  getContainer<T extends AllowedContainerTypes>(key: string | CONTAINER): T | undefined {
    return this.containerRegistry.getContainer<T>(key)
  }

  /**
   * Check if a container exists
   */
  hasContainer(key: string | CONTAINER): boolean {
    return this.containerRegistry.hasContainer(key)
  }

  /**
   * Remove a container
   */
  removeContainer(key: string | CONTAINER): boolean {
    this.stopContainer(key)
    return this.containerRegistry.removeContainer(key)
  }

  /**
   * Stop all running services and cleanup resources
   */
  async stopAllContainers() {
    logger.info(LogMessages.PLATFORM_STOP)

    // Stop heartbeat monitoring first
    if (this.healthChecker) {
      this.healthChecker.stopHeartbeat()
    }

    // Stop standard containers
    // Since all services depend on Postgres and Keycloak, it's best to stop these last.
    // The same applies to the Shell, as the UI depends on the BFF.
    // Since the startup order is important, the containers can be stopped in the reverse order.
    const standardContainers = this.getAllContainers()
    const containers = Array.from(standardContainers.values()).reverse()

    for (const container of containers) {
      try {
        await container.stop()
      } catch (error) {
        logger.error(LogMessages.CONTAINER_FAILED, container.constructor.name, error)
        // Don't throw here, continue stopping other containers
      }
    }

    // Cleanup network
    if (this.network) {
      try {
        logger.info(LogMessages.NETWORK_DESTROY)
        await this.network.stop()
        logger.success(LogMessages.NETWORK_DESTROYED)
        this.network = undefined
      } catch (error) {
        logger.error(LogMessages.NETWORK_DESTROY, 'Network cleanup failed', error)
        // Don't throw here, network might already be destroyed
        this.network = undefined
      }
    }

    logger.success(LogMessages.PLATFORM_SHUTDOWN)

    this.containerRegistry.clear()
  }

  /**
   * Get platform info exporter for URL access
   */
  getInfoExporter(): PlatformInfoExporter | undefined {
    return this.platformInfoExporter
  }

  /**
   * Get platform info (convenience method)
   */
  async getPlatformInfo(): Promise<PlatformInfo | undefined> {
    return await this.platformInfoExporter?.getPlatformInfo()
  }

  /**
   * Check if E2E tests are configured
   */
  hasE2eConfig(): boolean {
    const config = this.validatedConfig || DEFAULT_PLATFORM_CONFIG
    return !!config.container?.e2e
  }

  /**
   * Run E2E tests if configured
   * This should be called after all containers are healthy
   * The E2E container will be started as the last container
   * @returns E2E result with exit code, or undefined if no E2E configured
   */
  async runE2eTests(): Promise<E2eResult | undefined> {
    const config = this.validatedConfig || DEFAULT_PLATFORM_CONFIG

    if (!config.container?.e2e) {
      return undefined
    }

    if (!this.UserDefinedContainerStarter) {
      // Initialize UserDefinedContainerStarter if not already done
      if (!this.network || !this.imageResolver) {
        throw new Error('Network and ImageResolver must be initialized before running E2E tests')
      }
      const postgres = this.containerRegistry.getContainer(CONTAINER.POSTGRES) as StartedOnecxPostgresContainer
      const keycloak = this.containerRegistry.getContainer(CONTAINER.KEYCLOAK) as StartedOnecxKeycloakContainer
      this.UserDefinedContainerStarter = new UserDefinedContainerStarter(
        this.network,
        this.imageResolver,
        this.containerRegistry,
        postgres,
        keycloak
      )
    }

    return await this.UserDefinedContainerStarter.runE2eTests(config)
  }
  /**
   * Create user-defined containers using the UserDefinedContainerStarter
   */
  private async createContainers(config: PlatformConfig): Promise<void> {
    if (!this.UserDefinedContainerStarter) {
      throw new Error('UserDefinedContainerStarter not initialized. Core services must be started first.')
    }

    try {
      await this.UserDefinedContainerStarter.createAndStartContainers(config)
      logger.info(LogMessages.CONTAINER_STARTED, 'User-defined containers created successfully')
    } catch (error) {
      logger.error(LogMessages.CONTAINER_FAILED, undefined, error)
      throw error
    }
  }

  /**
   * Initialize and validate the platform configuration
   */
  private initializeConfiguration(configFilePath?: string): void {
    // Validate configuration file if it exists
    const validationResult = this.jsonValidator.validateConfigFile(configFilePath)

    if (validationResult.isValid && validationResult.config) {
      this.validatedConfig = validationResult.config
      logger.success(LogMessages.CONFIG_FOUND, 'Configuration loaded and validated successfully')
    } else if (validationResult.errors && validationResult.errors.length > 0) {
      logger.warn(
        LogMessages.CONFIG_VALIDATION_WARN,
        `Configuration validation failed: ${validationResult.errors.join(', ')}`
      )
      logger.info(LogMessages.CONFIG_NOT_FOUND, 'Using default configuration')
    } else {
      logger.info(LogMessages.CONFIG_NOT_FOUND, 'No configuration file found, using default configuration')
    }
  }

  /**
   * Stop a container
   * @param key
   */
  private async stopContainer(key: string | CONTAINER) {
    const container = this.getContainer(key)
    const containerKey = typeof key === 'string' ? key : String(key)
    try {
      await container?.stop()
      logger.success(LogMessages.CONTAINER_STOPPED, containerKey)
    } catch (error) {
      logger.error(LogMessages.CONTAINER_FAILED, containerKey, error)
      throw error
    }
  }
}
