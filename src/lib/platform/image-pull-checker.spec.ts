import { GenericContainer } from 'testcontainers'
import { ImagePullChecker } from './image-pull-checker'

jest.mock('testcontainers')
jest.mock('../utils/logger')

describe('ImagePullChecker', () => {
  const mockContainer = {
    withCommand: jest.fn().mockReturnThis(),
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(GenericContainer as unknown as jest.Mock).mockReturnValue(mockContainer)
  })

  describe('verifyImagePull', () => {
    it('should return true when image is pulled successfully', async () => {
      const stopMock = jest.fn().mockResolvedValue(undefined)
      const startMock = jest.fn().mockResolvedValue({ stop: stopMock })

      ;(GenericContainer as unknown as jest.Mock).mockImplementation(() => ({
        withCommand: jest.fn().mockReturnThis(),
        start: startMock,
      }))
      const result = await ImagePullChecker.verifyImagePull('docker.io/library/postgres:13.4')

      expect(result).toBe(true)
      expect(startMock).toHaveBeenCalled()
      expect(stopMock).toHaveBeenCalled()
    })

    it('should return false when image pull fails', async () => {
      const startMock = jest.fn().mockRejectedValue(new Error('Pull failed'))

      ;(GenericContainer as unknown as jest.Mock).mockImplementation(() => ({
        withCommand: jest.fn().mockReturnThis(),
        start: startMock,
      }))
      const result = await ImagePullChecker.verifyImagePull('non-existent:image')
      expect(result).toBe(false)
      expect(startMock).toHaveBeenCalled()
    })

    it('should return false when timeout', async () => {
      jest.useFakeTimers()
      const startMock = jest.fn().mockReturnValue(
        new Promise(() => {
          /* never resolves */
        })
      )

      ;(GenericContainer as unknown as jest.Mock).mockImplementation(() => ({
        withCommand: jest.fn().mockReturnThis(),
        start: startMock,
      }))
      const promise = ImagePullChecker.verifyImagePull('any:image')
      jest.advanceTimersByTime(30000)
      const result = await promise
      expect(result).toBe(false)

      jest.useRealTimers()
    })
  })

  describe('verifyMultipleImages', () => {
    it('should return results for multiple images using GenericContainer mock directly', async () => {
      ;(GenericContainer as unknown as jest.Mock).mockImplementation((imageName: string) => {
        if (imageName === 'image1:latest') {
          return {
            withCommand: jest.fn().mockReturnThis(),
            start: jest.fn().mockResolvedValue({
              stop: jest.fn().mockResolvedValue(undefined),
            }),
          }
        } else {
          return {
            withCommand: jest.fn().mockReturnThis(),
            start: jest.fn().mockRejectedValue(new Error('Pull failed')),
          }
        }
      })
      const images = ['image1:latest', 'image2:latest']
      const results = await ImagePullChecker.verifyMultipleImages(images)
      expect(results).toEqual({
        'image1:latest': true,
        'image2:latest': false,
      })

      expect(GenericContainer).toHaveBeenCalledTimes(2)
    })

    it('should return empty object when no images are provided', async () => {
      const results = await ImagePullChecker.verifyMultipleImages([])
      expect(results).toEqual({})
      expect(GenericContainer).not.toHaveBeenCalled()
    })
  })
})
