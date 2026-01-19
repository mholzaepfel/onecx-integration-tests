const successMock = jest.fn()
const infoMock = jest.fn()

jest.mock('../utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    success: successMock,
    info: infoMock,
  })),
  LogMessages: {
    CONTAINER_STARTED: 'CONTAINER_STARTED',
    CONTAINER_STOPPED: 'CONTAINER_STOPPED',
    PLATFORM_SHUTDOWN: 'PLATFORM_SHUTDOWN',
  },
}))

import { StartedBffContainer } from '../containers/basic/onecx-bff'
import { StartedUiContainer } from '../containers/basic/onecx-ui'
import { AllowedContainerTypes } from '../models/allowed-container.types'
import { ContainerRegistry } from './container-registry'

describe('ContainerRegistry', () => {
  describe('initial state', () => {
    let containerRegistry: ContainerRegistry = new ContainerRegistry()

    it('should be empty initially', () => {
      expect(containerRegistry.size()).toBe(0)
      expect(containerRegistry.hasContainer('any')).toBe(false)
    })
  })

  describe('add container', () => {
    let containerRegistry: ContainerRegistry

    beforeEach(() => {
      containerRegistry = new ContainerRegistry()
    })

    it('should add a container', () => {
      const containerKey = 'CONTAINER'
      const dummyContainer = {} as StartedBffContainer

      containerRegistry.addContainer(containerKey, dummyContainer)

      expect(containerRegistry.size()).toBe(1)
      expect(containerRegistry.hasContainer(containerKey)).toBe(true)
      expect(containerRegistry.getContainer(containerKey)).toBe(dummyContainer)
    })

    it('should overwrite container with the same key', () => {
      const containerKey = 'CONTAINER'
      const bffDummyContainer = {} as StartedBffContainer
      const uiDummyContainer = {} as StartedUiContainer

      containerRegistry.addContainer(containerKey, bffDummyContainer)
      containerRegistry.addContainer(containerKey, uiDummyContainer)

      expect(containerRegistry.size()).toBe(1)
      expect(containerRegistry.hasContainer(containerKey)).toBe(true)
      expect(containerRegistry.getContainer(containerKey)).toBe(uiDummyContainer)
    })
  })

  describe('get container', () => {
    let containerRegistry: ContainerRegistry
    const existingKey = 'EXISTING'
    const existingContainer = {} as AllowedContainerTypes

    describe('when container exists', () => {
      beforeEach(() => {
        containerRegistry = new ContainerRegistry()
        containerRegistry.addContainer(existingKey, existingContainer)
      })

      it('should return container for existing key', () => {
        const result = containerRegistry.getContainer(existingKey)
        expect(result).toBe(existingContainer)
      })
    })

    describe('when container does not exist', () => {
      beforeEach(() => {
        containerRegistry = new ContainerRegistry()
      })

      it('should return undefined for missing key', () => {
        const result = containerRegistry.getContainer('MISSING')
        expect(result).toBeUndefined()
      })
    })
  })

  describe('remove container', () => {
    let containerRegistry: ContainerRegistry
    const existingKey = 'EXISTING'
    const existingContainer = {} as AllowedContainerTypes

    beforeEach(() => {
      containerRegistry = new ContainerRegistry()
      containerRegistry.addContainer(existingKey, existingContainer)
    })

    it('should remove container for existing key', () => {
      expect(containerRegistry.size()).toBe(1)
      containerRegistry.removeContainer(existingKey)
      expect(containerRegistry.size()).toBe(0)
    })
  })

  describe('clear containers', () => {
    let containerRegistry: ContainerRegistry
    let firstKey: string
    let secondKey: string
    let existingContainer: AllowedContainerTypes

    beforeEach(() => {
      containerRegistry = new ContainerRegistry()
      firstKey = 'FIRST'
      secondKey = 'SECOND'
      existingContainer = {} as AllowedContainerTypes

      containerRegistry.addContainer(firstKey, existingContainer)
      containerRegistry.addContainer(secondKey, existingContainer)
    })

    it('should clear all containers', () => {
      containerRegistry.clear()

      expect(containerRegistry.size()).toBe(0)
      expect(containerRegistry.hasContainer(firstKey)).toBe(false)
      expect(containerRegistry.hasContainer(secondKey)).toBe(false)
    })
  })

  describe('retrieve containers and keys', () => {
    let containerRegistry: ContainerRegistry
    let firstKey: string
    let secondKey: string
    let existingContainer: AllowedContainerTypes

    beforeEach(() => {
      containerRegistry = new ContainerRegistry()
      firstKey = 'FIRST'
      secondKey = 'SECOND'
      existingContainer = {} as AllowedContainerTypes

      containerRegistry.addContainer(firstKey, existingContainer)
      containerRegistry.addContainer(secondKey, existingContainer)
    })

    it('return keys', () => {
      expect(containerRegistry.getContainerKeys()).toEqual(expect.arrayContaining([firstKey, secondKey]))
    })

    it('return containers', () => {
      const containers = containerRegistry.getAllContainers()
      expect(containers.get(firstKey)).toBe(existingContainer)
      expect(containers.get(secondKey)).toBe(existingContainer)
    })
  })

  describe('logging behavior', () => {
    let containerRegistry: ContainerRegistry
    const containerKey = 'TEST_CONTAINER'
    const dummyContainer = {} as StartedBffContainer

    beforeEach(() => {
      jest.clearAllMocks()
      containerRegistry = new ContainerRegistry()
    })

    it('should log when a container is added', () => {
      containerRegistry.addContainer(containerKey, dummyContainer)

      expect(successMock).toHaveBeenCalledTimes(1)
    })

    it('should log when a container is removed', () => {
      containerRegistry.addContainer(containerKey, dummyContainer)
      successMock.mockClear()

      containerRegistry.removeContainer(containerKey)

      expect(successMock).toHaveBeenCalledTimes(1)
    })

    it('should not log when removing a non-existent container', () => {
      containerRegistry.removeContainer('NON_EXISTENT_KEY')

      expect(successMock).not.toHaveBeenCalled()
    })

    it('should log when all containers are cleared', () => {
      containerRegistry.addContainer(containerKey, dummyContainer)
      infoMock.mockClear()

      containerRegistry.clear()

      expect(infoMock).toHaveBeenCalledTimes(1)
    })
  })
})
