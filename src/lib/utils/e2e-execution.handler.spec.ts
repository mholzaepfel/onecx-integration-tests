import { E2eExecutionHandler, E2eExecutionError } from './e2e-execution.handler'

describe('E2eExecutionHandler', () => {
  it('uses the typed execution error status without matching error text', async () => {
    const handler = new E2eExecutionHandler()
    const context = {
      e2eConfig: { image: 'image', networkAlias: 'suite' },
      withLoggingEnabled: false,
      sequence: 1,
      total: 1,
    }

    const result = await handler.executeWithErrorHandling(
      async () => {
        throw new E2eExecutionError('failed_timeout', new Error('container failed to restart'))
      },
      (error) => handler.createFailedRecord(context, '2026-01-01T00:00:00.000Z', 10, error)
    )

    expect(result.status).toBe('failed_timeout')
    expect(result.errorMessage).toBe('container failed to restart')
  })

  it('does not infer a failure status from arbitrary error text', async () => {
    const handler = new E2eExecutionHandler()
    const context = {
      e2eConfig: { image: 'image', networkAlias: 'suite' },
      withLoggingEnabled: false,
      sequence: 1,
      total: 1,
    }

    const result = await handler.executeWithErrorHandling(
      async () => {
        throw new Error('container failed to restart')
      },
      (error) => handler.createFailedRecord(context, '2026-01-01T00:00:00.000Z', 10, error)
    )

    expect(result.status).toBe('failed_unexpected')
  })
})
