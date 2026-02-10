import { PlatformManager } from './platform-manager'
import { PlatformConfig } from '../models/platform-config.interface'

const mockValidator = {
  validateConfigFile: jest.fn(),
}

const mockCoreStarter = {
  startCoreContainers: jest.fn(),
  startServiceContainers: jest.fn(),
  startBffContainers: jest.fn(),
  startUiContainers: jest.fn(),
}

const mockDataImporter = {
  importDefaultData: jest.fn(),
  createContainerInfo: jest.fn(),
}

const mockHealthChecker = {
  checkAllHealthy: jest.fn(),
  configureHeartbeat: jest.fn(),
  startHeartbeat: jest.fn(),
  stopHeartbeat: jest.fn(),
  isHeartbeatRunning: jest.fn(),
  getHeartbeatConfig: jest.fn(),
}

const mockUserStarter = {
  createAndStartContainers: jest.fn(),
}

jest.mock('./json-validator', () => ({
  PlatformConfigJsonValidator: jest.fn().mockImplementation(() => mockValidator),
}))

jest.mock('./core-container-starter', () => ({
  CoreContainerStarter: jest.fn().mockImplementation(() => mockCoreStarter),
}))

jest.mock('./data-importer', () => ({
  DataImporter: jest.fn().mockImplementation(() => mockDataImporter),
}))

jest.mock('./health-checker', () => ({
  HealthChecker: jest.fn().mockImplementation(() => mockHealthChecker),
}))

jest.mock('./user-defined-container-starter', () => ({
  UserDefinedContainerStarter: jest.fn().mockImplementation(() => mockUserStarter),
}))

jest.mock('./image-resolver')
jest.mock('../utils/logger')

jest.mock('testcontainers', () => {
  const actual = jest.requireActual('testcontainers')
  return {
    ...actual,
    Network: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue({
        stop: jest.fn(),
      }),
    })),
  }
})

describe('PlatformManager', () => {
  let platformManager: PlatformManager

  beforeEach(() => {
    jest.clearAllMocks()

    mockCoreStarter.startCoreContainers.mockResolvedValue(undefined)
    mockCoreStarter.startServiceContainers.mockResolvedValue(undefined)
    mockCoreStarter.startBffContainers.mockResolvedValue(undefined)
    mockCoreStarter.startUiContainers.mockResolvedValue(undefined)
  })

  describe('constructor', () => {
    it('should call validator with the provided configuration file path', () => {
      mockValidator.validateConfigFile.mockReturnValue({ isValid: false, errors: [] })
      platformManager = new PlatformManager('fake-file.json')
      expect(mockValidator.validateConfigFile).toHaveBeenCalledWith('fake-file.json')
    })

    it('should store configuration when validation is successful', () => {
      const mockConfig = { importData: true } as unknown as PlatformConfig
      mockValidator.validateConfigFile.mockReturnValue({ isValid: true, config: mockConfig })
      platformManager = new PlatformManager()
      expect(platformManager.hasValidatedConfig()).toBe(true)
      expect(platformManager.getValidatedConfig()).toBe(mockConfig)
    })

    it('should not store configuration when validation fails', () => {
      mockValidator.validateConfigFile.mockReturnValue({
        isValid: false,
        errors: ['Unknown validation error'],
      })
      platformManager = new PlatformManager()
      expect(platformManager.hasValidatedConfig()).toBe(false)
      expect(platformManager.getValidatedConfig()).toBeUndefined()
    })
  })

  describe('startContainers', () => {
    it('should start containers in correct order', async () => {
      mockValidator.validateConfigFile.mockReturnValue({ isValid: true, config: {} as PlatformConfig })
      platformManager = new PlatformManager()
      await platformManager.startContainers()

      const orderCore = mockCoreStarter.startCoreContainers.mock.invocationCallOrder[0]
      const orderSvc = mockCoreStarter.startServiceContainers.mock.invocationCallOrder[0]
      const orderBff = mockCoreStarter.startBffContainers.mock.invocationCallOrder[0]
      const orderUi = mockCoreStarter.startUiContainers.mock.invocationCallOrder[0]

      expect(orderCore).toBeLessThan(orderSvc)
      expect(orderSvc).toBeLessThan(orderBff)
      expect(orderBff).toBeLessThan(orderUi)
    })

    it('should import data when importData flag is enabled', async () => {
      mockValidator.validateConfigFile.mockReturnValue({
        isValid: true,
        config: { importData: true } as PlatformConfig,
      })
      platformManager = new PlatformManager()
      await platformManager.startContainers()
      expect(mockDataImporter.importDefaultData).toHaveBeenCalled()
    })
  })

  describe('stopAllContainers', () => {
    it('should call stop on all registered containers', async () => {
      const mockContainer1 = { stop: jest.fn().mockResolvedValue(undefined) }
      const mockContainer2 = { stop: jest.fn().mockResolvedValue(undefined) }

      const containersMap = new Map()
      containersMap.set('Container1', mockContainer1)
      containersMap.set('Container2', mockContainer2)

      jest.spyOn(platformManager, 'getAllContainers').mockReturnValue(containersMap)

      await platformManager.stopAllContainers()

      expect(mockContainer1.stop).toHaveBeenCalled()
      expect(mockContainer2.stop).toHaveBeenCalled()
    })

    it('should continue stopping other containers even if one fails', async () => {
      const failingContainer = { stop: jest.fn().mockRejectedValue(new Error('Docker timeout')) }
      const succeedingContainer = { stop: jest.fn().mockResolvedValue(undefined) }
      const containersMap = new Map()
      containersMap.set('Success', succeedingContainer)
      containersMap.set('Fail', failingContainer)

      jest.spyOn(platformManager, 'getAllContainers').mockReturnValue(containersMap)

      await platformManager.stopAllContainers()

      expect(failingContainer.stop).toHaveBeenCalled()
      expect(succeedingContainer.stop).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should throw an error when checkAllHealthy is called before starting containers', async () => {
      platformManager = new PlatformManager()

      await expect(platformManager.checkAllHealthy()).rejects.toThrow(
        'HealthChecker not initialized. Call startContainers first.'
      )
    })
  })
})
