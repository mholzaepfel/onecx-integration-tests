/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataImporter } from './data-importer'
import { ImportManagerContainer } from '../containers/import/import-container'
import { ImageResolver } from './image-resolver'
import { CONTAINER } from '../models/container.enum'
import { StartedOnecxKeycloakContainer } from '../containers/core/onecx-keycloak'
import { StartedShellUiContainer } from '../containers/ui/onecx-shell-ui'
import type { AllowedContainerTypes } from '../models/allowed-container.types'
import * as fs from 'fs'

jest.mock('fs')
jest.mock('./image-resolver')
jest.mock('../containers/core/onecx-keycloak')
jest.mock('../containers/ui/onecx-shell-ui')
jest.mock('../containers/import/import-container')

describe('DataImporter', () => {
  let dataImporter: DataImporter
  let mockImageResolver: jest.Mocked<ImageResolver>

  beforeEach(() => {
    mockImageResolver = new ImageResolver() as jest.Mocked<ImageResolver>
    dataImporter = new DataImporter(mockImageResolver)

    jest.clearAllMocks()
  })

  describe('createContainerInfo', () => {
    it('should create container info file with all required data', () => {
      const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        return undefined
      })

      const mockKeycloak = new (StartedOnecxKeycloakContainer as unknown as { new (): StartedOnecxKeycloakContainer })()
      jest.spyOn(mockKeycloak, 'getRealm').mockReturnValue('onecx')
      jest.spyOn(mockKeycloak, 'getNetworkAliases').mockReturnValue(['keycloak'])
      jest.spyOn(mockKeycloak, 'getPort').mockReturnValue(8080)

      const mockShellUi = new (StartedShellUiContainer as unknown as { new (): StartedShellUiContainer })()
      jest.spyOn(mockShellUi, 'getClientUserId').mockReturnValue('onecx-shell')
      jest.spyOn(mockShellUi, 'getNetworkAliases').mockReturnValue(['shell-ui'])
      jest.spyOn(mockShellUi, 'getPort').mockReturnValue(4200)

      const mockTenantSvc = {
        getNetworkAliases: jest.fn().mockReturnValue(['tenant-svc']),
        getPort: jest.fn().mockReturnValue(8081),
      } as unknown as AllowedContainerTypes

      const startedContainers = new Map<string, AllowedContainerTypes>()
      startedContainers.set(CONTAINER.KEYCLOAK, mockKeycloak)
      startedContainers.set(CONTAINER.SHELL_UI, mockShellUi)
      startedContainers.set(CONTAINER.TENANT_SVC, mockTenantSvc)

      const containerInfoPath = dataImporter.createContainerInfo(startedContainers)

      expect(containerInfoPath).toContain('container-info.json')

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1)

      const writtenData = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string)
      expect(writtenData.tokenValues).toEqual({
        username: 'onecx',
        password: 'onecx',
        realm: 'onecx',
        alias: 'keycloak',
        port: 8080,
        clientId: 'onecx-shell',
      })
      expect(writtenData.services).toHaveProperty('onecx-tenant-svc')
      expect(writtenData.services['onecx-tenant-svc']).toEqual({
        alias: 'tenant-svc',
        port: 8081,
      })
    })

    it('shoould throw error when keycloak container is missing', () => {
      const startedContainers = new Map<string, AllowedContainerTypes>()
      const mockShellUi = new (StartedShellUiContainer as unknown as { new (): StartedShellUiContainer })()
      startedContainers.set(CONTAINER.SHELL_UI, mockShellUi)

      expect(() => dataImporter.createContainerInfo(startedContainers)).toThrow(
        'Keycloak container not found or invalid type in started containers'
      )
    })

    it('should throw error when Shell UI container is missing', () => {
      const startedContainers = new Map<string, AllowedContainerTypes>()
      const mockKeycloak = new (StartedOnecxKeycloakContainer as unknown as { new (): StartedOnecxKeycloakContainer })()

      jest.spyOn(mockKeycloak, 'getRealm').mockReturnValue('onecx')
      jest.spyOn(mockKeycloak, 'getNetworkAliases').mockReturnValue(['keycloak'])
      jest.spyOn(mockKeycloak, 'getPort').mockReturnValue(8080)

      startedContainers.set(CONTAINER.KEYCLOAK, mockKeycloak)

      expect(() => dataImporter.createContainerInfo(startedContainers)).toThrow(
        'Shell UI container not found or invalid type in started containers'
      )
    })
  })

  describe('importDefaultData', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should monitor import process and complete successfully', async () => {
      const mockNetwork = {} as any
      const mockConfig = { importData: true } as any
      const startedContainers = new Map()

      mockImageResolver.getImportManagerBaseImage.mockResolvedValue('import-image')

      jest.spyOn(dataImporter, 'createContainerInfo').mockReturnValue('fake-path.json')
      jest.spyOn(dataImporter as any, 'cleanupContainerInfo').mockImplementation(() => {
        return undefined
      })

      const mockStartedImporter = {
        exec: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
      }

      const mockImporterContainer = {
        withNetwork: jest.fn().mockReturnThis(),
        enableLogging: jest.fn().mockReturnThis(),
        start: jest.fn().mockResolvedValue(mockStartedImporter),
      }

      const MockedContainer = ImportManagerContainer as jest.MockedClass<typeof ImportManagerContainer>
      MockedContainer.mockImplementation(() => mockImporterContainer as any)

      mockStartedImporter.exec.mockResolvedValueOnce({ exitCode: 0 })
      mockStartedImporter.exec.mockResolvedValueOnce({ exitCode: 1 })

      const importPromise = dataImporter.importDefaultData(mockNetwork, startedContainers, mockConfig)
      await jest.advanceTimersByTimeAsync(2000)
      await jest.advanceTimersByTimeAsync(2000)
      await importPromise

      expect(mockImporterContainer.start).toHaveBeenCalled()
      expect(mockStartedImporter.exec).toHaveBeenCalledTimes(2)
      expect(mockStartedImporter.exec).toHaveBeenCalledWith(['pgrep', '-f', 'import-runner.ts'])
      expect(dataImporter['cleanupContainerInfo']).toHaveBeenCalledWith('fake-path.json')
    })
  })
})
