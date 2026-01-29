import { Logger, LogMessages } from './logger'

describe('Logger', () => {
  let logger: Logger
  let logSpy: jest.SpyInstance
  let warnSpy: jest.SpyInstance
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    logger = new Logger('TestClass')
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
      /* no-op */
    })
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
      /* no-op */
    })
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
      /* no-op */
    })
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    ;(Logger as unknown as { loggingEnabled: boolean }).loggingEnabled = true
  })

  describe('info', () => {
    it('should log info message with correct format', () => {
      logger.info(LogMessages.CONTAINER_STARTED)

      expect(logSpy).toHaveBeenCalled()

      const loggedMessage = logSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('TestClass')
      expect(loggedMessage).toContain('[INFO]')
      expect(loggedMessage).toContain(LogMessages.CONTAINER_STARTED)
    })
  })

  describe('success', () => {
    it('should log success message with correct format', () => {
      logger.success(LogMessages.CONTAINER_STARTED)

      expect(logSpy).toHaveBeenCalled()

      const loggedMessage = logSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('TestClass')
      expect(loggedMessage).toContain('[SUCCESS]')
      expect(loggedMessage).toContain('\x1b[32m')
      expect(loggedMessage).toContain(LogMessages.CONTAINER_STARTED)
    })
  })

  describe('warn', () => {
    it('should log warn message with correct format', () => {
      logger.warn(LogMessages.CONTAINER_STARTED)

      expect(warnSpy).toHaveBeenCalled()

      const loggedMessage = warnSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('TestClass')
      expect(loggedMessage).toContain('[WARN]')
      expect(loggedMessage).toContain('\x1b[33m')
      expect(loggedMessage).toContain(LogMessages.CONTAINER_STARTED)
    })
  })

  describe('status', () => {
    it('should log success message when status code is 200', () => {
      logger.status(LogMessages.CONTAINER_STARTED, 200)
      expect(logSpy).toHaveBeenCalled()
      const loggedMessage = logSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('[SUCCESS]')
      expect(loggedMessage).toContain('Status: 200')
    })

    it('should log success message when status code is 201', () => {
      logger.status(LogMessages.CONTAINER_STARTED, 201)
      expect(logSpy).toHaveBeenCalled()
      const loggedMessage = logSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('[SUCCESS]')
      expect(loggedMessage).toContain('Status: 201')
    })

    it('should log error message when status code is not 200 or 201', () => {
      logger.status(LogMessages.CONTAINER_STARTED, 400)
      expect(errorSpy).toHaveBeenCalled()
      const loggedMessage = errorSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('[ERROR]')
      expect(loggedMessage).toContain('Status: 400')
    })
  })

  describe('error', () => {
    it('should not log when logging is disabled', () => {
      ;(Logger as unknown as { loggingEnabled: boolean }).loggingEnabled = false
      logger.error(LogMessages.CONTAINER_FAILED)
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('should log error message with correct format', () => {
      logger.error(LogMessages.CONTAINER_FAILED)
      expect(errorSpy).toHaveBeenCalled()
      const loggedMessage = errorSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('TestClass')
      expect(loggedMessage).toContain('[ERROR]')
      expect(loggedMessage).toContain('\x1b[31m')
      expect(loggedMessage).toContain(LogMessages.CONTAINER_FAILED)
    })

    it('should log error message with additional error object', () => {
      const err = new Error('Something failed')
      logger.error(LogMessages.CONTAINER_FAILED, 'Container issue', err)

      expect(errorSpy).toHaveBeenCalled()

      const loggedMessage = errorSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('TestClass')
      expect(loggedMessage).toContain('[ERROR]')
      expect(loggedMessage).toContain('Container issue')

      const loggedError = errorSpy.mock.calls[0][1]
      expect(loggedError).toBe(err)
      expect(loggedError.message).toBe('Something failed')
    })
  })

  describe('log duration', () => {
    it('should log duration message with correct format', () => {
      logger.logDuration(LogMessages.CONTAINER_STARTED, 1500)
      expect(logSpy).toHaveBeenCalled()
      const loggedMessage = logSpy.mock.calls[0][0]
      expect(loggedMessage).toContain('TestClass')
      expect(loggedMessage).toContain('[SUCCESS]')
      expect(loggedMessage).toContain('1.5s')
    })
  })
})
