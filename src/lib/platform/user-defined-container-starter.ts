import { StartedNetwork } from 'testcontainers'
import { PlatformConfig } from '../models/interfaces/platform-config.interface'
import { E2eContainerInterface, E2eExecutionContext, E2eExecutionRecord } from '../models/interfaces/e2e.interface'
import { E2eExecutionError, E2eExecutionHandler } from '../utils/e2e-execution.handler'
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
import { validateNetworkAlias } from '../utils/network-alias.utils'

const logger = new Logger('UserDefinedContainerStarter')

/**
 * UserDefinedContainerStarter class for creating different types of containers based on configuration
 */
export class UserDefinedContainerStarter {
  private e2eExecutionHandler = new E2eExecutionHandler()

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
        validateNetworkAlias(serviceConfig.networkAlias, 'Service container')
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
        validateNetworkAlias(bffConfig.networkAlias, 'BFF container')
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
        validateNetworkAlias(uiConfig.networkAlias, 'UI container')
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
   * Failures in E2E containers are logged and execution continues with the next container.
   * @param config Platform configuration containing E2E container definitions
   * @returns Ordered E2E execution records, or undefined if no E2E is configured
   */
  async startE2eContainers(
    config: PlatformConfig,
    shouldStop?: () => boolean
  ): Promise<E2eExecutionRecord[] | undefined> {
    const validationResult = this.validateE2eConfig(config)
    if (validationResult === null) {
      return undefined
    }
    if (validationResult === 'empty') {
      return []
    }

    return await this.executeE2eSequence(config, validationResult, shouldStop)
  }

  /**
   * Validate E2E configuration
   * @returns null if no e2e config, 'empty' if empty array, or the e2e configs array if valid
   */
  private validateE2eConfig(config: PlatformConfig): E2eContainerInterface[] | 'empty' | null {
    const e2eConfigs = config.container?.e2e
    if (!e2eConfigs) {
      return null
    }

    if (e2eConfigs.length === 0) {
      logger.warn(LogMessages.CONTAINER_STARTED, 'E2E configuration is present but empty; skipping E2E execution')
      return 'empty'
    }

    return e2eConfigs
  }

  /**
   * Execute E2E containers in sequence. Each failure is logged and execution continues.
   */
  private async executeE2eSequence(
    config: PlatformConfig,
    e2eConfigs: E2eContainerInterface[],
    shouldStop?: () => boolean
  ): Promise<E2eExecutionRecord[]> {
    const total = e2eConfigs.length
    const results: E2eExecutionRecord[] = []

    for (let index = 0; index < total; index++) {
      if (shouldStop?.()) {
        logger.warn(LogMessages.CONTAINER_STARTED, 'Stopping E2E sequence after interruption')
        break
      }
      const e2eConfig = e2eConfigs[index]
      validateNetworkAlias(e2eConfig.networkAlias, 'E2E container')
      logger.info(
        LogMessages.CONTAINER_STARTED,
        `Starting E2E container ${index + 1}/${total}: ${e2eConfig.networkAlias}`
      )
      const e2eResult = await this.createE2eContainer({
        e2eConfig,
        withLoggingEnabled: loggingEnabled(config, [e2eConfig.networkAlias]),
        logFilePath: this.logFilePathProvider?.(e2eConfig.networkAlias),
        sequence: index + 1,
        total,
      })
      results.push(e2eResult)

      this.logE2eResult(e2eResult, index, total)
    }

    return results
  }

  /**
   * Log E2E container execution result
   */
  private logE2eResult(result: E2eExecutionRecord, index: number, total: number): void {
    const statusMessage = `E2E container finished ${result.sequence}/${total}: ${result.networkAlias} [${result.status}]`
    if (result.success) {
      logger.success(LogMessages.CONTAINER_STARTED, statusMessage)
    } else {
      logger.error(LogMessages.CONTAINER_FAILED, statusMessage)
    }
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
   * Start E2E test container and wait for it to complete.
   * Captures both successful and failed executions for reporting.
   * @param e2eConfig E2E container configuration
   * @param withLoggingEnabled Whether to enable container logging
   * @returns E2E execution result for one configured container
   */
  async createE2eContainer(context: E2eExecutionContext): Promise<E2eExecutionRecord> {
    const startedAt = new Date().toISOString()
    const startTime = Date.now()

    return await this.e2eExecutionHandler.executeWithErrorHandling(
      async () => {
        try {
          return await this.runE2eContainerWithResult(context, startedAt, startTime)
        } catch (error) {
          if (error instanceof E2eExecutionError) {
            throw error
          }
          throw new E2eExecutionError('failed_startup', error)
        }
      },
      (error) => this.e2eExecutionHandler.createFailedRecord(context, startedAt, Date.now() - startTime, error)
    )
  }

  /**
   * Run E2E container and determine result from exit code
   */
  private async runE2eContainerWithResult(
    context: E2eExecutionContext,
    startedAt: string,
    startTime: number
  ): Promise<E2eExecutionRecord> {
    const { e2eConfig } = context
    const startupTimeoutMs = e2eConfig.timeoutMs ?? E2E_DEFAULT_TIMEOUT_MS
    const resolvedImage = await this.imageResolver.getImage(e2eConfig.image)
    const e2eContainer = this.configureE2eContainer(new E2eContainer(resolvedImage), context, startupTimeoutMs)

    const startedContainer = await e2eContainer.start()
    logger.info(LogMessages.CONTAINER_STARTED, 'E2E container finished, retrieving exit code...')
    const exitCode = await startedContainer.getExitCode()
    const duration = Date.now() - startTime
    const finishedAt = new Date().toISOString()

    return this.e2eExecutionHandler.createExecutionRecord(
      e2eConfig,
      context.sequence,
      context.total,
      startedAt,
      finishedAt,
      duration,
      exitCode
    )
  }

  /**
   * Configure E2E container with all settings from config
   */
  private configureE2eContainer(
    e2eContainer: E2eContainer,
    context: E2eExecutionContext,
    startupTimeoutMs: number
  ): E2eContainer {
    const { e2eConfig, withLoggingEnabled, logFilePath } = context
    e2eContainer.withNetworkAliases(e2eConfig.networkAlias)

    if (e2eConfig.baseUrl) {
      e2eContainer.withBaseUrl(e2eConfig.baseUrl)
    }

    if (e2eConfig.environments) {
      e2eContainer.withEnvironment(e2eConfig.environments)
    }

    if (logFilePath) {
      e2eContainer.withLogFilePath(logFilePath)
    }

    return e2eContainer
      .withLoggingEnabled(withLoggingEnabled)
      .withNetwork(this.network)
      .withStartupTimeout(startupTimeoutMs)
  }
}
