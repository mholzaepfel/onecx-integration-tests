import { AllowedContainerTypes } from '../models/allowed-container.types'
import { HealthChecker } from './health-checker'

describe('HealthChecker', () => {
  let healthChecker: HealthChecker
  beforeEach(() => {
    healthChecker = new HealthChecker()
  })

  describe('config', () => {
    it('should heartbeat be disabled by default', () => {
      expect(healthChecker.getHeartbeatConfig().enabled).toBe(false)
    })

    it('should return false for isHeartbeatRunning initially', () => {
      expect(healthChecker.isHeartbeatRunning()).toBe(false)
    })

    it('should update configuration', () => {
      healthChecker.configureHeartbeat({
        enabled: true,
        interval: 1000,
        failureThreshold: 3,
      })
      expect(healthChecker.getHeartbeatConfig().enabled).toBe(true)
      expect(healthChecker.getHeartbeatConfig().interval).toBe(1000)
      expect(healthChecker.getHeartbeatConfig().failureThreshold).toBe(3)
    })

    it('should use default config when undefined', () => {
      healthChecker.configureHeartbeat(undefined)
      expect(healthChecker.getHeartbeatConfig().enabled).toBe(false)
      expect(healthChecker.getHeartbeatConfig().interval).toBe(10000)
      expect(healthChecker.getHeartbeatConfig().failureThreshold).toBe(3)
    })

    it('should use property from default when missing in config', () => {
      healthChecker.configureHeartbeat({
        enabled: true,
        interval: 1000,
      })
      expect(healthChecker.getHeartbeatConfig().enabled).toBe(true)
      expect(healthChecker.getHeartbeatConfig().interval).toBe(1000)
      expect(healthChecker.getHeartbeatConfig().failureThreshold).toBe(3)
    })
  })

  describe('error', () => {
    it('should throw error when container not found', async () => {
      const createdContainers = new Map<string, AllowedContainerTypes>()

      await expect(healthChecker.checkHealthy(createdContainers, 'non-existing-container')).rejects.toThrow(
        'No started container found with name "non-existing-container"'
      )
    })
  })

  describe('health-checks,', () => {
    it('should return healthy status when container check is successful', async () => {
      const mockExecutor = {
        executeHealthCheck: jest.fn().mockResolvedValue({ success: true }),
        getExecutionMetadata: jest.fn().mockReturnValue({ description: 'Mock container' }),
      }

      const mockContainer = {
        getHealthCheckExecutor: jest.fn().mockReturnValue(mockExecutor),
      } as unknown as AllowedContainerTypes

      const createdContainers = new Map<string, AllowedContainerTypes>()
      createdContainers.set('mock-container', mockContainer)

      const result = await healthChecker.checkHealthy(createdContainers, 'mock-container')
      expect(result.healthy).toBe(true)
      expect(result.name).toBe('mock-container')
      expect(mockExecutor.executeHealthCheck).toHaveBeenCalledTimes(1)
    })

    it('should return unhealthy status when container check fails', async () => {
      const mockExecutor = {
        executeHealthCheck: jest.fn().mockResolvedValue({ success: false }),
        getExecutionMetadata: jest.fn().mockReturnValue({ description: 'Mock container' }),
      }

      const mockContainer = {
        getHealthCheckExecutor: jest.fn().mockReturnValue(mockExecutor),
      } as unknown as AllowedContainerTypes

      const createdContainers = new Map<string, AllowedContainerTypes>()
      createdContainers.set('mock-container', mockContainer)

      const result = await healthChecker.checkHealthy(createdContainers, 'mock-container')
      expect(result.healthy).toBe(false)
      expect(result.name).toBe('mock-container')
      expect(mockExecutor.executeHealthCheck).toHaveBeenCalledTimes(1)
    })

    it('should return correct status for getAllHealthy', async () => {
      const healthyMockExecutor = {
        executeHealthCheck: jest.fn().mockResolvedValue({ success: true }),
        getExecutionMetadata: jest.fn().mockReturnValue({ description: 'Mock container' }),
      }

      const unhealthyMockExecutor = {
        executeHealthCheck: jest.fn().mockRejectedValue({ success: false }),
        getExecutionMetadata: jest.fn().mockReturnValue({ description: 'Mock container' }),
      }

      const healthyMockContainer = {
        getHealthCheckExecutor: jest.fn().mockReturnValue(healthyMockExecutor),
      } as unknown as AllowedContainerTypes

      const unhealthyMockContainer = {
        getHealthCheckExecutor: jest.fn().mockReturnValue(unhealthyMockExecutor),
      } as unknown as AllowedContainerTypes

      const createdContainers = new Map<string, AllowedContainerTypes>()
      createdContainers.set('healthy-container', healthyMockContainer)
      createdContainers.set('unhealthy-container', unhealthyMockContainer)

      const result = await healthChecker.checkAllHealthy(createdContainers)
      expect(result).toEqual([
        {
          healthy: true,
          name: 'healthy-container',
        },
        {
          healthy: false,
          name: 'unhealthy-container',
        },
      ])
    })
  })

  describe('heartbeat', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should execute health checks periodically when started', async () => {
      const mockExecutor = {
        executeHealthCheck: jest.fn().mockResolvedValue({ success: true }),
        getExecutionMetadata: jest.fn().mockReturnValue({ description: 'Mock' }),
      }

      const mockContainer = {
        getHealthCheckExecutor: jest.fn().mockReturnValue(mockExecutor),
      } as unknown as AllowedContainerTypes

      const containers = new Map<string, AllowedContainerTypes>()
      containers.set('mock-container', mockContainer)

      healthChecker.configureHeartbeat({ enabled: true, interval: 1000 })
      healthChecker.startHeartbeat(containers)

      expect(healthChecker.isHeartbeatRunning()).toBe(true)

      jest.advanceTimersByTime(5000)

      await Promise.resolve()
      expect(mockExecutor.executeHealthCheck).toHaveBeenCalledTimes(5)
    })

    it('should stop executing health checks periodically when stopped', async () => {
      const mockExecutor = {
        executeHealthCheck: jest.fn().mockResolvedValue({ success: true }),
        getExecutionMetadata: jest.fn().mockReturnValue({ description: 'Mock' }),
      }

      const mockContainer = {
        getHealthCheckExecutor: jest.fn().mockReturnValue(mockExecutor),
      } as unknown as AllowedContainerTypes

      const containers = new Map<string, AllowedContainerTypes>()
      containers.set('mock-container', mockContainer)

      healthChecker.configureHeartbeat({ enabled: true, interval: 1000 })
      healthChecker.startHeartbeat(containers)

      expect(healthChecker.isHeartbeatRunning()).toBe(true)

      jest.advanceTimersByTime(5000)

      await Promise.resolve()
      expect(mockExecutor.executeHealthCheck).toHaveBeenCalledTimes(5)

      healthChecker.stopHeartbeat()

      expect(healthChecker.isHeartbeatRunning()).toBe(false)

      jest.advanceTimersByTime(10000)

      await Promise.resolve()
      // check if the number of calls is still 5
      expect(mockExecutor.executeHealthCheck).toHaveBeenCalledTimes(5)
    })
  })
})
