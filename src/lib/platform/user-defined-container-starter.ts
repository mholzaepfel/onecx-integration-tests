import { StartedNetwork } from 'testcontainers'
import { PlatformConfig } from '../models/interfaces/platform-config.interface'
import { E2eContainerInterface, E2eExecutionRecord, E2eExecutionStatus } from '../models/interfaces/e2e.interface'
import { SvcContainerInterface } from '../models/interfaces/svc.interface'
import { BffContainerInterface } from '../models/interfaces/bff.interface'
import { UiContainerInterface } from '../models/interfaces/ui.interface'
import { SvcContainer, StartedSvcContainer } from '../containers/basic/onecx-svc'
import { BffContainer, StartedBffContainer } from '../containers/basic/onecx-bff'
import { UiContainer, StartedUiContainer } from '../containers/basic/onecx-ui'
import { E2eContainer } from '../containers/e2e/onecx-e2e'
import { StartedOnecxPostgresContainer } from '../containers/core/onecx-postgres'
import { StartedOnecxKeycloakContainer } from '../containers/core/onecx-keycloak'
import { loggingEnabled } from '../utils/logging-enable'
import { ImageResolver } from './image-resolver'
import { Logger, LogMessages } from '../utils/logger'
import { ContainerRegistry } from './container-registry'
import { E2E_DEFAULT_TIMEOUT_MS } from '../config/e2e-constants'
import { LogFilePathProvider } from './platform-manager'

const logger = new Logger('UserDefinedContainerStarter')

/**
 * UserDefinedContainerStarter class for creating different types of containers based on configuration
 */
export class UserDefinedContainerStarter {
  constructor(
    private network: StartedNetwork,
    private imageResolver: ImageResolver,
    private containerRegistry: ContainerRegistry,
    private postgres?: StartedOnecxPostgresContainer,
    private keycloak?: StartedOnecxKeycloakContainer,
    private readonly logFilePathProvider?: LogFilePathProvider
  ) {}

  /**
   * Create containers based on the platform configuration
   * @param config Platform configuration containing container definitions
   * @returns Map of created and started containers
   */
  async createAndStartContainers(config: PlatformConfig) {
    if (!config.container) {
      return
    }

    logger.info(LogMessages.CONTAINER_STARTED, 'Creating user-defined containers')

    // Create service containers
    if (config.container.service && config.container.service.length > 0) {
      for (const serviceConfig of config.container.service) {
        logger.info(LogMessages.CONTAINER_STARTED, `Creating service container: ${serviceConfig.networkAlias}`)
        const svcContainer = await this.createSvcContainer(
          serviceConfig,
          loggingEnabled(config, [serviceConfig.networkAlias]),
          this.logFilePathProvider?.(serviceConfig.networkAlias)
        )
        this.containerRegistry.addContainer(serviceConfig.networkAlias, svcContainer)
        logger.success(LogMessages.CONTAINER_STARTED, `Service container created: ${serviceConfig.networkAlias}`)
      }
    }

    // Create BFF containers
    if (config.container.bff && config.container.bff.length > 0) {
      for (const bffConfig of config.container.bff) {
        logger.info(LogMessages.CONTAINER_STARTED, `Creating BFF container: ${bffConfig.networkAlias}`)
        const bffContainer = await this.createBffContainer(
          bffConfig,
          loggingEnabled(config, [bffConfig.networkAlias]),
          this.logFilePathProvider?.(bffConfig.networkAlias)
        )
        this.containerRegistry.addContainer(bffConfig.networkAlias, bffContainer)
        logger.success(LogMessages.CONTAINER_STARTED, `BFF container created: ${bffConfig.networkAlias}`)
      }
    }

    // Create UI containers
    if (config.container.ui && config.container.ui.length > 0) {
      for (const uiConfig of config.container.ui) {
        logger.info(LogMessages.CONTAINER_STARTED, `Creating UI container: ${uiConfig.networkAlias}`)
        const uiContainer = await this.createUiContainer(
          uiConfig,
          loggingEnabled(config, [uiConfig.networkAlias]),
          this.logFilePathProvider?.(uiConfig.networkAlias)
        )
        this.containerRegistry.addContainer(uiConfig.networkAlias, uiContainer)
        logger.success(LogMessages.CONTAINER_STARTED, `UI container created: ${uiConfig.networkAlias}`)
      }
    }
  }

  /**
   * Run E2E tests in configured order after the platform is healthy.
   * @param config Platform configuration containing E2E container definitions
   * @returns Ordered E2E execution records, or undefined if no E2E is configured
   */
  async startE2eContainers(
    config: PlatformConfig,
    shouldContinue: () => boolean = () => true
  ): Promise<E2eExecutionRecord[] | undefined> {
    const e2eConfigs = config.container?.e2e
    if (!e2eConfigs) {
      return undefined
    }

    if (e2eConfigs.length === 0) {
      logger.warn(LogMessages.CONTAINER_STARTED, 'E2E configuration is present but empty; skipping E2E execution')
      return []
    }

    const total = e2eConfigs.length
    const results: E2eExecutionRecord[] = []

    for (let index = 0; index < total; index++) {
      if (!shouldContinue()) {
        logger.warn(LogMessages.CONTAINER_STARTED, 'E2E execution interrupted before starting next container')
        break
      }

      const e2eConfig = e2eConfigs[index]
      logger.info(
        LogMessages.CONTAINER_STARTED,
        `Starting E2E container ${index + 1}/${total}: ${e2eConfig.networkAlias}`
      )
      const e2eResult = await this.createE2eContainer(
        e2eConfig,
        loggingEnabled(config, [e2eConfig.networkAlias]),
        this.logFilePathProvider?.(e2eConfig.networkAlias),
        index + 1,
        total
      )
      results.push(e2eResult)

      const statusMessage = `E2E container finished ${index + 1}/${total}: ${e2eConfig.networkAlias} [${
        e2eResult.status
      }]`
      if (e2eResult.success) {
        logger.success(LogMessages.CONTAINER_STARTED, statusMessage)
      } else {
        logger.error(LogMessages.CONTAINER_FAILED, statusMessage)
      }
    }

    return results
  }

  /**
   * Create a service container from the configuration
   */
  private async createSvcContainer(
    svcConfig: SvcContainerInterface,
    withLoggingEnabled: boolean,
    logFilePath?: string
  ): Promise<StartedSvcContainer> {
    if (!this.postgres || !this.keycloak) {
      throw new Error('Postgres and Keycloak containers are required for service containers')
    }

    // Resolve the image through the ImageResolver
    const resolvedImage = await this.imageResolver.getImage(svcConfig.image)
    const svcContainer = new SvcContainer(resolvedImage, {
      databaseContainer: this.postgres,
      keycloakContainer: this.keycloak,
    }).withNetworkAliases(svcConfig.networkAlias)
    if (svcConfig.environments) {
      svcContainer.withEnvironment(svcConfig.environments)
    }
    if (svcConfig.svcDetails.databaseUsername && svcConfig.svcDetails.databasePassword) {
      svcContainer
        .withDatabaseUsername(svcConfig.svcDetails.databaseUsername)
        .withDatabasePassword(svcConfig.svcDetails.databasePassword)
    }
    if (svcConfig.commandHealthCheck) {
      svcContainer.withCommandHealthCheck(svcConfig.commandHealthCheck)
    }
    if (svcConfig.healthChecks?.length) {
      svcContainer.withHealthChecks(svcConfig.healthChecks)
    }

    if (logFilePath) {
      svcContainer.withLogFilePath(logFilePath)
    }

    return await svcContainer.withLoggingEnabled(withLoggingEnabled).withNetwork(this.network).start()
  }

  /**
   * Create a BFF container from the configuration
   */
  private async createBffContainer(
    bffConfig: BffContainerInterface,
    withLoggingEnabled: boolean,
    logFilePath?: string
  ): Promise<StartedBffContainer> {
    if (!this.keycloak) {
      throw new Error('Keycloak container is required for BFF containers but was not provided.')
    }

    // Resolve the image through the ImageResolver
    const resolvedImage = await this.imageResolver.getImage(bffConfig.image)

    const bffContainer = new BffContainer(resolvedImage, this.keycloak).withNetworkAliases(bffConfig.networkAlias)
    if (bffConfig.bffDetails.permissionsProductName) {
      bffContainer.withPermissionsProductName(bffConfig.bffDetails.permissionsProductName)
    }
    if (bffConfig.commandHealthCheck) {
      bffContainer.withCommandHealthCheck(bffConfig.commandHealthCheck)
    }
    if (bffConfig.healthChecks?.length) {
      bffContainer.withHealthChecks(bffConfig.healthChecks)
    }
    if (bffConfig.environments) {
      bffContainer.withEnvironment(bffConfig.environments)
    }

    if (logFilePath) {
      bffContainer.withLogFilePath(logFilePath)
    }

    return await bffContainer.withLoggingEnabled(withLoggingEnabled).withNetwork(this.network).start()
  }

  /**
   * Create a UI container from the configuration
   */
  private async createUiContainer(
    uiConfig: UiContainerInterface,
    withLoggingEnabled: boolean,
    logFilePath?: string
  ): Promise<StartedUiContainer> {
    // Resolve the image through the ImageResolver
    const resolvedImage = await this.imageResolver.getImage(uiConfig.image)

    const uiContainer = new UiContainer(resolvedImage).withNetworkAliases(uiConfig.networkAlias)

    if (uiConfig.uiDetails.appBaseHref) {
      uiContainer.withAppBaseHref(uiConfig.uiDetails.appBaseHref)
    }

    if (uiConfig.uiDetails.appId) {
      uiContainer.withAppId(uiConfig.uiDetails.appId)
    }

    if (uiConfig.uiDetails.productName) {
      uiContainer.withProductName(uiConfig.uiDetails.productName)
    }

    if (uiConfig.environments) {
      uiContainer.withEnvironment(uiConfig.environments)
    }

    if (uiConfig.commandHealthCheck) {
      uiContainer.withCommandHealthCheck(uiConfig.commandHealthCheck)
    }
    if (uiConfig.healthChecks?.length) {
      uiContainer.withHealthChecks(uiConfig.healthChecks)
    }

    if (logFilePath) {
      uiContainer.withLogFilePath(logFilePath)
    }

    return await uiContainer.withLoggingEnabled(withLoggingEnabled).withNetwork(this.network).start()
  }

  /**
   * Start E2E test container and wait for it to complete
   * @param e2eConfig E2E container configuration
   * @param withLoggingEnabled Whether to enable container logging
   * @returns E2E execution result for one configured container
   */
  async createE2eContainer(
    e2eConfig: E2eContainerInterface,
    withLoggingEnabled: boolean,
    logFilePath: string | undefined,
    sequence: number,
    total: number
  ): Promise<E2eExecutionRecord> {
    const startedAt = new Date().toISOString()
    const startTime = Date.now()
    const startupTimeoutMs = e2eConfig.timeoutMs ?? E2E_DEFAULT_TIMEOUT_MS

    try {
      // Resolve image (may need to pull from registry)
      const resolvedImage = await this.imageResolver.getImage(e2eConfig.image)

      // Create E2E container with resolved image and config
      const e2eContainer = new E2eContainer(resolvedImage)
        .withNetworkAliases(e2eConfig.networkAlias)
        .withOutputAlias(e2eConfig.networkAlias)

      if (e2eConfig.baseUrl) {
        e2eContainer.withBaseUrl(e2eConfig.baseUrl)
      }

      if (e2eConfig.environments) {
        e2eContainer.withEnvironment(e2eConfig.environments)
      }

      if (logFilePath) {
        e2eContainer.withLogFilePath(logFilePath)
      }

      const startedContainer = await e2eContainer
        .withLoggingEnabled(withLoggingEnabled)
        .withNetwork(this.network)
        .withStartupTimeout(startupTimeoutMs)
        .start()

      // With the E2E one-shot completion strategy, start() resolves after container exit.
      // We then inspect and report the real exit code when available.
      logger.info(LogMessages.CONTAINER_STARTED, 'E2E container finished, retrieving exit code...')
      const exitCode = await startedContainer.getExitCode()
      const duration = Date.now() - startTime
      const finishedAt = new Date().toISOString()

      if (exitCode === 0) {
        return {
          networkAlias: e2eConfig.networkAlias,
          sequence,
          total,
          status: 'passed',
          success: true,
          exitCode,
          startedAt,
          finishedAt,
          duration,
        }
      }

      if (typeof exitCode === 'number') {
        return {
          networkAlias: e2eConfig.networkAlias,
          sequence,
          total,
          status: 'failed_exit_code',
          success: false,
          exitCode,
          startedAt,
          finishedAt,
          duration,
        }
      }

      return {
        networkAlias: e2eConfig.networkAlias,
        sequence,
        total,
        status: 'failed_wait',
        success: false,
        errorMessage: 'E2E container finished without an inspectable exit code',
        startedAt,
        finishedAt,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const finishedAt = new Date().toISOString()
      const status = this.classifyExecutionError(error)
      const errorMessage = error instanceof Error ? error.message : String(error)

      return {
        networkAlias: e2eConfig.networkAlias,
        sequence,
        total,
        status,
        success: false,
        errorMessage,
        startedAt,
        finishedAt,
        duration,
      }
    }
  }

  private classifyExecutionError(error: unknown): E2eExecutionStatus {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'failed_timeout'
    }
    if (message.includes('wait')) {
      return 'failed_wait'
    }
    if (message.includes('start') || message.includes('startup')) {
      return 'failed_startup'
    }

    return 'failed_unexpected'
  }
}
