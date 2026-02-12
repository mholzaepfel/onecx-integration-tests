
import { CoreContainerStarter } from './core-container-starter'
import { CONTAINER } from '../models/container.enum'
import { OnecxPostgresContainer, StartedOnecxPostgresContainer } from '../containers/core/onecx-postgres'
import { OnecxKeycloakContainer, StartedOnecxKeycloakContainer } from '../containers/core/onecx-keycloak'
import { ShellBffContainer } from '../containers/bff/onecx-shell-bff'
import { ImageResolver } from './image-resolver'
import { StartedNetwork } from 'testcontainers'
import { ContainerRegistry } from './container-registry'
import { PlatformConfig } from '../models/platform-config.interface'
import { StartedBffContainer } from '../containers/basic/onecx-bff'
import { StartedUiContainer } from '../containers/basic/onecx-ui'
import { ShellUiContainer } from '../containers/ui/onecx-shell-ui'
import { IamKcContainer } from '../containers/svc/onecx-iam-kc-svc'
import { WorkspaceSvcContainer } from '../containers/svc/onecx-workspace-svc'
import { UserProfileSvcContainer } from '../containers/svc/onecx-user-profile-svc'
import { ThemeSvcContainer } from '../containers/svc/onecx-theme-svc'
import { TenantSvcContainer, StartedTenantSvcContainer } from '../containers/svc/onecx-tenant-svc'
import { StartedSvcContainer } from '../containers/basic/onecx-svc'
import { ProductStoreSvcContainer } from '../containers/svc/onecx-product-store-svc'
import { PermissionSvcContainer } from '../containers/svc/onecx-permission-svc'

jest.mock('../containers/core/onecx-postgres')
jest.mock('../containers/core/onecx-keycloak')
jest.mock('../containers/bff/onecx-shell-bff')
jest.mock('../containers/ui/onecx-shell-ui')
jest.mock('./image-resolver')
jest.mock('./container-registry')
jest.mock('../containers/svc/onecx-iam-kc-svc')
jest.mock('../containers/svc/onecx-workspace-svc')
jest.mock('../containers/svc/onecx-user-profile-svc')
jest.mock('../containers/svc/onecx-theme-svc')
jest.mock('../containers/svc/onecx-tenant-svc')
jest.mock('../containers/svc/onecx-product-store-svc')
jest.mock('../containers/svc/onecx-permission-svc')

describe('CoreContainerStarter', () => {
  const mockStartedPostgres = { name: 'postgres-container' } as unknown as StartedOnecxPostgresContainer
  const mockStartedKeycloak = { name: 'keycloak-container' } as unknown as StartedOnecxKeycloakContainer
  const mockStartedBff = { name: 'shell-bff-container' } as unknown as StartedBffContainer
  const mockStartedUi = { name: 'shell-ui-container' } as unknown as StartedUiContainer
  const mockStartedIamKc = { name: 'iam-kc-container' } as unknown as StartedSvcContainer
  const mockStartedWorkspace = { name: 'workspace-container' } as unknown as StartedSvcContainer
  const mockStartedUserProfile = { name: 'user-profile-container' } as unknown as StartedSvcContainer
  const mockStartedTheme = { name: 'theme-container' } as unknown as StartedSvcContainer
  const mockStartedTenant = { name: 'tenant-container' } as unknown as StartedTenantSvcContainer
  const mockStartedProductStore = { name: 'product-store-container' } as unknown as StartedSvcContainer
  const mockStartedPermission = { name: 'permission-container' } as unknown as StartedSvcContainer

  const imageResolver = new ImageResolver() as jest.Mocked<ImageResolver>
  const containerRegistry = new ContainerRegistry() as jest.Mocked<ContainerRegistry>

  const network = {} as StartedNetwork
  const config = {} as PlatformConfig


  let starter: CoreContainerStarter

  beforeEach(() => {
    jest.clearAllMocks()

      ; (OnecxPostgresContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedPostgres),
      }))

      ; (OnecxKeycloakContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedKeycloak),
      }))

      ; (ShellBffContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedBff),
      }))

      ; (ShellUiContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedUi),
      }))

      ; (IamKcContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedIamKc),
      }))

      ; (WorkspaceSvcContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedWorkspace),
      }))

      ; (UserProfileSvcContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedUserProfile),
      }))

      ; (ThemeSvcContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedTheme),
      }))

      ; (TenantSvcContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedTenant),
      }))

      ; (ProductStoreSvcContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedProductStore),
      }))

      ; (PermissionSvcContainer as unknown as jest.Mock).mockImplementation(() => ({
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedPermission),
      }))

    starter = new CoreContainerStarter(
      imageResolver,
      network,
      containerRegistry,
      config
    )
  })

  it('start core containers', async () => {
    imageResolver.getPostgresImage.mockResolvedValue('postgres-image')
    imageResolver.getKeycloakImage.mockResolvedValue('keycloak-image')

    await starter.startCoreContainers()

    expect(containerRegistry.addContainer).toHaveBeenCalledWith(
      CONTAINER.POSTGRES,
      mockStartedPostgres
    )

    expect(containerRegistry.addContainer).toHaveBeenCalledWith(
      CONTAINER.KEYCLOAK,
      mockStartedKeycloak
    )
  })

  it('start bff containers', async () => {
    imageResolver.getBffImage.mockResolvedValue('bff-image')

    await starter.startBffContainers(mockStartedKeycloak)

    expect(containerRegistry.addContainer).toHaveBeenCalledWith(
      CONTAINER.SHELL_BFF,
      mockStartedBff
    )
  })

  it('start ui containers', async () => {
    containerRegistry.getContainer.mockReturnValue(mockStartedBff)

    imageResolver.getUiImage.mockResolvedValue('ui-image')

    await starter.startUiContainers(mockStartedKeycloak)

    expect(containerRegistry.addContainer).toHaveBeenCalledWith(
      CONTAINER.SHELL_UI,
      mockStartedUi
    )
  })

  it('start service containers', async () => {
    imageResolver.getServiceImage.mockResolvedValue('svc-image')

    containerRegistry.getContainer.mockImplementation((name) => {
      if (name === CONTAINER.TENANT_SVC) return mockStartedTenant
      return undefined
    })

    await starter.startServiceContainers(mockStartedPostgres, mockStartedKeycloak)

    expect(containerRegistry.addContainer).toHaveBeenCalledWith(CONTAINER.WORKSPACE_SVC, mockStartedWorkspace)
    expect(containerRegistry.addContainer).toHaveBeenCalledWith(CONTAINER.USER_PROFILE_SVC, mockStartedUserProfile)
    expect(containerRegistry.addContainer).toHaveBeenCalledWith(CONTAINER.THEME_SVC, mockStartedTheme)
    expect(containerRegistry.addContainer).toHaveBeenCalledWith(CONTAINER.TENANT_SVC, mockStartedTenant)
    expect(containerRegistry.addContainer).toHaveBeenCalledWith(CONTAINER.PRODUCT_STORE_SVC, mockStartedProductStore)
    expect(containerRegistry.addContainer).toHaveBeenCalledWith(CONTAINER.PERMISSION_SVC, mockStartedPermission)
  })
})
