import { StartedNetwork } from 'testcontainers'
import { PlatformConfig } from '../models/platform-config.interface'
import { SvcContainerInterface } from '../models/svc.interface'
import { BffContainerInterface } from '../models/bff.interface'
import { UiContainerInterface } from '../models/ui.interface'
import { SvcContainer, StartedSvcContainer } from '../containers/basic/onecx-svc'
import { BffContainer, StartedBffContainer } from '../containers/basic/onecx-bff'
import { UiContainer, StartedUiContainer } from '../containers/basic/onecx-ui'
import { StartedOnecxPostgresContainer } from '../containers/core/onecx-postgres'
import { StartedOnecxKeycloakContainer } from '../containers/core/onecx-keycloak'
import { loggingEnabled } from '../utils/logging-enable'
import { ImageResolver } from './image-resolver'
import { Logger, LogMessages } from '../utils/logger'
import { ContainerRegistry } from './container-registry'
import { E2eContainerInterface, E2eResult } from '../models/e2e.interface'
import { E2eContainer } from '../containers/e2e/onecx-e2e'

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
    private keycloak?: StartedOnecxKeycloakContainer
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
          loggingEnabled(config, [serviceConfig.networkAlias])
        )
        this.containerRegistry.addContainer(serviceConfig.networkAlias, svcContainer)
        logger.success(LogMessages.CONTAINER_STARTED, `Service container created: ${serviceConfig.networkAlias}`)
      }
    }

    // Create BFF containers
    if (config.container.bff && config.container.bff.length > 0) {
      for (const bffConfig of config.container.bff) {
        logger.info(LogMessages.CONTAINER_STARTED, `Creating BFF container: ${bffConfig.networkAlias}`)
        const bffContainer = await this.createBffContainer(bffConfig, loggingEnabled(config, [bffConfig.networkAlias]))
        this.containerRegistry.addContainer(bffConfig.networkAlias, bffContainer)
        logger.success(LogMessages.CONTAINER_STARTED, `BFF container created: ${bffConfig.networkAlias}`)
      }
    }

    // Create UI containers
    if (config.container.ui && config.container.ui.length > 0) {
      for (const uiConfig of config.container.ui) {
        logger.info(LogMessages.CONTAINER_STARTED, `Creating UI container: ${uiConfig.networkAlias}`)
        const uiContainer = await this.createUiContainer(uiConfig, loggingEnabled(config, [uiConfig.networkAlias]))
        this.containerRegistry.addContainer(uiConfig.networkAlias, uiContainer)
        logger.success(LogMessages.CONTAINER_STARTED, `UI container created: ${uiConfig.networkAlias}`)
      }
    }
  }

  /**
   * Run E2E tests - called separately after all containers are healthy
   * @param config Platform configuration containing E2E container definition
   * @returns E2E execution result with exit code, or undefined if no E2E configured
   */
  async runE2eTests(config: PlatformConfig): Promise<E2eResult | undefined> {
    if (!config.container?.e2e) {
      return undefined
    }

    const e2eConfig = config.container.e2e
    logger.info(LogMessages.CONTAINER_STARTED, `Starting E2E container: ${e2eConfig.networkAlias}`)
    const e2eResult = await this.createE2eContainer(e2eConfig, loggingEnabled(config, [e2eConfig.networkAlias]))
    logger.success(LogMessages.CONTAINER_STARTED, `E2E container finished: ${e2eConfig.networkAlias}`)
    return e2eResult
  }
  /**
   * Create a service container from the configuration
   */
  private async createSvcContainer(
    svcConfig: SvcContainerInterface,
    enableLogging: boolean
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
    if (svcConfig.healthCheck) {
      svcContainer.withHealthCheck(svcConfig.healthCheck)
    }

    return await svcContainer.enableLogging(enableLogging).withNetwork(this.network).start()
  }

  /**
   * Create a BFF container from the configuration
   */
  private async createBffContainer(
    bffConfig: BffContainerInterface,
    enableLogging: boolean
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
    if (bffConfig.healthCheck) {
      bffContainer.withHealthCheck(bffConfig.healthCheck)
    }
    if (bffConfig.environments) {
      bffContainer.withEnvironment(bffConfig.environments)
    }

    return await bffContainer.enableLogging(enableLogging).withNetwork(this.network).start()
  }

  /**
   * Create a UI container from the configuration
   */
  private async createUiContainer(uiConfig: UiContainerInterface, enableLogging: boolean): Promise<StartedUiContainer> {
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

    return await uiContainer.enableLogging(enableLogging).withNetwork(this.network).start()
  }
  /**
   * Start E2E test container and wait for it to complete
   * @param e2eConfig E2E container configuration
   * @param enableLogging Whether to enable container logging
   * @returns E2E execution result with exit code
   */
  async createE2eContainer(e2eConfig: E2eContainerInterface, enableLogging: boolean): Promise<E2eResult> {
    const startTime = Date.now()

    // Resolve image (may need to pull from registry)
    const resolvedImage = await this.imageResolver.getImage(e2eConfig.image)

    // Create E2E container with resolved image and config
    const e2eContainer = new E2eContainer(resolvedImage).withNetworkAliases(e2eConfig.networkAlias)

    const startedContainer = await e2eContainer.enableLogging(enableLogging).withNetwork(this.network).start()

    // With Wait.forOneShotStartup(), the container has already exited when start() completes
    // We just need to get the exit code
    logger.info(LogMessages.CONTAINER_STARTED, 'E2E container finished, retrieving exit code...')
    const exitCode = await startedContainer.getExitCode()
    const duration = Date.now() - startTime
    const success = exitCode === 0

    if (success) {
      logger.success(
        LogMessages.CONTAINER_STARTED,
        `E2E tests completed successfully in ${Math.round(duration / 1000)}s`
      )
    } else {
      logger.error(LogMessages.CONTAINER_FAILED, `E2E tests failed with exit code ${exitCode}`)
    }

    return { exitCode, success, duration }
  }
}
