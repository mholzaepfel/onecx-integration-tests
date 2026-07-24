import { StartedNetwork } from 'testcontainers'
import { UserDefinedContainerStarter } from './user-defined-container-starter'
import { ImageResolver } from './image-resolver'
import { ContainerRegistry } from './container-registry'
import { StartedOnecxPostgresContainer } from '../containers/core/onecx-postgres'
import { StartedOnecxKeycloakContainer } from '../containers/core/onecx-keycloak'
import { PlatformConfig } from '../models/interfaces/platform-config.interface'
import { SvcContainer } from '../containers/basic/onecx-svc'
import { BffContainer } from '../containers/basic/onecx-bff'
import { UiContainer } from '../containers/basic/onecx-ui'
import { E2eContainer } from '../containers/e2e/onecx-e2e'
import { E2E_DEFAULT_TIMEOUT_MS } from '../config/e2e-constants'
import { E2eExecutionRecord } from '../models/interfaces/e2e.interface'

jest.mock('../containers/basic/onecx-svc')
jest.mock('../containers/basic/onecx-bff')
jest.mock('../containers/basic/onecx-ui')
jest.mock('../containers/e2e/onecx-e2e')

describe('UserDefinedContainerStarter', () => {
  let starter: UserDefinedContainerStarter
  let mockNetwork: jest.Mocked<StartedNetwork>
  let mockImageResolver: jest.Mocked<ImageResolver>
  let mockContainerRegistry: jest.Mocked<ContainerRegistry>
  let mockPostgres: jest.Mocked<StartedOnecxPostgresContainer>
  let mockKeycloak: jest.Mocked<StartedOnecxKeycloakContainer>

  beforeEach(() => {
    jest.clearAllMocks()

    mockNetwork = {} as unknown as jest.Mocked<StartedNetwork>
    mockImageResolver = { getImage: jest.fn() } as unknown as jest.Mocked<ImageResolver>
    mockContainerRegistry = { addContainer: jest.fn() } as unknown as jest.Mocked<ContainerRegistry>
    mockPostgres = {} as unknown as jest.Mocked<StartedOnecxPostgresContainer>
    mockKeycloak = {} as unknown as jest.Mocked<StartedOnecxKeycloakContainer>

    starter = new UserDefinedContainerStarter(
      mockNetwork,
      mockImageResolver,
      mockContainerRegistry,
      mockPostgres,
      mockKeycloak
    )

    const createMockContainer = () => {
      const mock = {
        withNetworkAliases: jest.fn().mockReturnThis(),
        withEnvironment: jest.fn().mockReturnThis(),
        withDatabaseUsername: jest.fn().mockReturnThis(),
        withDatabasePassword: jest.fn().mockReturnThis(),
        withHealthCheck: jest.fn().mockReturnThis(),
        withPermissionsProductName: jest.fn().mockReturnThis(),
        withAppBaseHref: jest.fn().mockReturnThis(),
        withAppId: jest.fn().mockReturnThis(),
        withProductName: jest.fn().mockReturnThis(),
        withBaseUrl: jest.fn().mockReturnThis(),
        withOutputAlias: jest.fn().mockReturnThis(),
        withLoggingEnabled: jest.fn().mockReturnThis(),
        withNetwork: jest.fn().mockReturnThis(),
        withStartupTimeout: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue({
          getExitCode: jest.fn().mockResolvedValue(0),
        }),
      }
      return mock
    }

    ;(SvcContainer as unknown as jest.Mock).mockImplementation(() => createMockContainer())
    ;(BffContainer as unknown as jest.Mock).mockImplementation(() => createMockContainer())
    ;(UiContainer as unknown as jest.Mock).mockImplementation(() => createMockContainer())
    ;(E2eContainer as unknown as jest.Mock).mockImplementation(() => createMockContainer())
  })

  it('should start all types of containers', async () => {
    const config: PlatformConfig = {
      container: {
        service: [
          {
            image: 'svc-image',
            networkAlias: 'svc-alias',
            svcDetails: { databaseUsername: 'user', databasePassword: 'pwd' },
          },
        ],
        bff: [
          {
            image: 'bff-image',
            networkAlias: 'bff-alias',
            bffDetails: { permissionsProductName: 'prod' },
          },
        ],
        ui: [
          {
            image: 'ui-image',
            networkAlias: 'ui-alias',
            uiDetails: { appId: 'app', productName: 'prod', appBaseHref: '/' },
          },
        ],
      },
    }

    mockImageResolver.getImage.mockImplementation(async (img) => `resolved-${img}`)

    await starter.createAndStartContainers(config)

    expect(mockImageResolver.getImage).toHaveBeenCalledWith('svc-image')
    expect(mockImageResolver.getImage).toHaveBeenCalledWith('bff-image')
    expect(mockImageResolver.getImage).toHaveBeenCalledWith('ui-image')

    expect(mockContainerRegistry.addContainer).toHaveBeenCalledTimes(3)
    expect(mockContainerRegistry.addContainer).toHaveBeenCalledWith('svc-alias', expect.anything())
    expect(mockContainerRegistry.addContainer).toHaveBeenCalledWith('bff-alias', expect.anything())
    expect(mockContainerRegistry.addContainer).toHaveBeenCalledWith('ui-alias', expect.anything())

    const svcInstance = (SvcContainer as unknown as jest.Mock).mock.results[0].value
    expect(svcInstance.withNetworkAliases).toHaveBeenCalledWith('svc-alias')
    expect(svcInstance.withDatabaseUsername).toHaveBeenCalledWith('user')
    expect(svcInstance.withDatabasePassword).toHaveBeenCalledWith('pwd')

    const bffInstance = (BffContainer as unknown as jest.Mock).mock.results[0].value
    expect(bffInstance.withNetworkAliases).toHaveBeenCalledWith('bff-alias')
    expect(bffInstance.withPermissionsProductName).toHaveBeenCalledWith('prod')

    const uiInstance = (UiContainer as unknown as jest.Mock).mock.results[0].value
    expect(uiInstance.withNetworkAliases).toHaveBeenCalledWith('ui-alias')
    expect(uiInstance.withAppId).toHaveBeenCalledWith('app')
    expect(uiInstance.withAppBaseHref).toHaveBeenCalledWith('/')
  })

  it('should throw error when creating SVC but postgres is missing', async () => {
    const starterWithoutPostgres = new UserDefinedContainerStarter(
      mockNetwork,
      mockImageResolver,
      mockContainerRegistry,
      undefined,
      mockKeycloak
    )

    const config: PlatformConfig = {
      container: {
        service: [
          {
            image: 'svc-image',
            networkAlias: 'svc-alias',
            svcDetails: { databaseUsername: 'user', databasePassword: 'pwd' },
          },
        ],
      },
    }

    await expect(starterWithoutPostgres.createAndStartContainers(config)).rejects.toThrow(
      'Postgres and Keycloak containers are required for service containers'
    )
  })

  it('should throw error when creating BFF but keycloak is missing', async () => {
    const starterWithoutKeycloak = new UserDefinedContainerStarter(
      mockNetwork,
      mockImageResolver,
      mockContainerRegistry,
      mockPostgres,
      undefined
    )

    const config: PlatformConfig = {
      container: {
        bff: [
          {
            image: 'bff-image',
            networkAlias: 'bff-alias',
            bffDetails: { permissionsProductName: 'prod' },
          },
        ],
      },
    }

    await expect(starterWithoutKeycloak.createAndStartContainers(config)).rejects.toThrow(
      'Keycloak container is required for BFF containers but was not provided.'
    )
  })

  it('should use default e2e startup timeout when timeoutMs is not configured', async () => {
    mockImageResolver.getImage.mockResolvedValue('resolved-e2e-image')

    await starter.createE2eContainer(
      {
        image: 'e2e-image',
        networkAlias: 'e2e-runner',
      },
      false,
      undefined,
      1,
      1
    )

    const e2eInstance = (E2eContainer as unknown as jest.Mock).mock.results[0].value
    expect(e2eInstance.withStartupTimeout).toHaveBeenCalledWith(E2E_DEFAULT_TIMEOUT_MS)
  })

  it('should use configured e2e startup timeout when timeoutMs is provided', async () => {
    mockImageResolver.getImage.mockResolvedValue('resolved-e2e-image')

    await starter.createE2eContainer(
      {
        image: 'e2e-image',
        networkAlias: 'e2e-runner',
        timeoutMs: 2_400_000,
      },
      false,
      undefined,
      1,
      1
    )

    const e2eInstance = (E2eContainer as unknown as jest.Mock).mock.results[0].value
    expect(e2eInstance.withStartupTimeout).toHaveBeenCalledWith(2_400_000)
  })

  it('should execute e2e containers sequentially in configured order', async () => {
    const records: E2eExecutionRecord[] = [
      {
        networkAlias: 'suite-a',
        sequence: 1,
        total: 2,
        status: 'passed',
        success: true,
        exitCode: 0,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        duration: 100,
      },
      {
        networkAlias: 'suite-b',
        sequence: 2,
        total: 2,
        status: 'passed',
        success: true,
        exitCode: 0,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        duration: 120,
      },
    ]

    const spy = jest.spyOn(starter, 'createE2eContainer')
    spy.mockResolvedValueOnce(records[0]).mockResolvedValueOnce(records[1])

    const config: PlatformConfig = {
      container: {
        e2e: [
          { image: 'img-a', networkAlias: 'suite-a' },
          { image: 'img-b', networkAlias: 'suite-b' },
        ],
      },
    }

    const result = await starter.startE2eContainers(config)

    expect(result).toEqual(records)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenNthCalledWith(1, config.container!.e2e![0], false, undefined, 1, 2)
    expect(spy).toHaveBeenNthCalledWith(2, config.container!.e2e![1], false, undefined, 2, 2)
  })

  it('should continue with next e2e container when one execution fails', async () => {
    const spy = jest.spyOn(starter, 'createE2eContainer')
    spy
      .mockResolvedValueOnce({
        networkAlias: 'suite-a',
        sequence: 1,
        total: 2,
        status: 'failed_timeout',
        success: false,
        errorMessage: 'startup timeout',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        duration: 100,
      })
      .mockResolvedValueOnce({
        networkAlias: 'suite-b',
        sequence: 2,
        total: 2,
        status: 'passed',
        success: true,
        exitCode: 0,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        duration: 90,
      })

    const config: PlatformConfig = {
      container: {
        e2e: [
          { image: 'img-a', networkAlias: 'suite-a' },
          { image: 'img-b', networkAlias: 'suite-b' },
        ],
      },
    }

    const result = await starter.startE2eContainers(config)

    expect(result).toHaveLength(2)
    expect(result?.[0].success).toBe(false)
    expect(result?.[1].success).toBe(true)
  })

  it('should return empty list when e2e array is empty', async () => {
    const config: PlatformConfig = {
      container: {
        e2e: [],
      },
    }

    const result = await starter.startE2eContainers(config)
    expect(result).toEqual([])
  })

  it('should not start next e2e container when shouldContinue returns false', async () => {
    const spy = jest.spyOn(starter, 'createE2eContainer')
    spy.mockResolvedValueOnce({
      networkAlias: 'suite-a',
      sequence: 1,
      total: 2,
      status: 'passed',
      success: true,
      exitCode: 0,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      duration: 90,
    })

    const config: PlatformConfig = {
      container: {
        e2e: [
          { image: 'img-a', networkAlias: 'suite-a' },
          { image: 'img-b', networkAlias: 'suite-b' },
        ],
      },
    }

    let invocation = 0
    const shouldContinue = () => {
      invocation += 1
      return invocation <= 1
    }

    const result = await starter.startE2eContainers(config, shouldContinue)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result?.[0].networkAlias).toBe('suite-a')
  })

  it('should mark execution as failed_exit_code when container exits non-zero', async () => {
    mockImageResolver.getImage.mockResolvedValue('resolved-e2e-image')
    ;(E2eContainer as unknown as jest.Mock).mockImplementation(() => ({
      withNetworkAliases: jest.fn().mockReturnThis(),
      withOutputAlias: jest.fn().mockReturnThis(),
      withEnvironment: jest.fn().mockReturnThis(),
      withBaseUrl: jest.fn().mockReturnThis(),
      withLoggingEnabled: jest.fn().mockReturnThis(),
      withNetwork: jest.fn().mockReturnThis(),
      withStartupTimeout: jest.fn().mockReturnThis(),
      start: jest.fn().mockResolvedValue({ getExitCode: jest.fn().mockResolvedValue(7) }),
    }))

    const result = await starter.createE2eContainer(
      {
        image: 'e2e-image',
        networkAlias: 'e2e-runner',
      },
      false,
      undefined,
      1,
      1
    )

    expect(result.status).toBe('failed_exit_code')
    expect(result.exitCode).toBe(7)
    expect(result.success).toBe(false)
  })

  it('should mark execution as failed_wait when exit code is unavailable', async () => {
    mockImageResolver.getImage.mockResolvedValue('resolved-e2e-image')
    ;(E2eContainer as unknown as jest.Mock).mockImplementation(() => ({
      withNetworkAliases: jest.fn().mockReturnThis(),
      withOutputAlias: jest.fn().mockReturnThis(),
      withEnvironment: jest.fn().mockReturnThis(),
      withBaseUrl: jest.fn().mockReturnThis(),
      withLoggingEnabled: jest.fn().mockReturnThis(),
      withNetwork: jest.fn().mockReturnThis(),
      withStartupTimeout: jest.fn().mockReturnThis(),
      start: jest.fn().mockResolvedValue({ getExitCode: jest.fn().mockResolvedValue(undefined) }),
    }))

    const result = await starter.createE2eContainer(
      {
        image: 'e2e-image',
        networkAlias: 'e2e-runner',
      },
      false,
      undefined,
      1,
      1
    )

    expect(result.status).toBe('failed_wait')
    expect(result.exitCode).toBeUndefined()
    expect(result.success).toBe(false)
  })
})
