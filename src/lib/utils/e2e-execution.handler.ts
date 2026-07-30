import { E2eExecutionRecord, E2eExecutionStatus, E2eContainerInterface } from '../models/interfaces/e2e.interface'

/**
 * Handles E2E container execution with error handling and recovery.
 * Wraps container execution with try-catch and creates appropriate execution records.
 */
export class E2eExecutionHandler {
  /**
   * Execute E2E container with error handling.
   * @param executor Async function that executes the E2E container and returns success record
   * @param e2eConfig E2E container configuration
   * @param sequence Current sequence number
   * @param total Total number of E2E containers
   * @param startedAt ISO timestamp when execution started
   * @param startTime Milliseconds timestamp when execution started
   * @returns E2E execution record (success or failure)
   */
  async executeWithErrorHandling(
    executor: () => Promise<E2eExecutionRecord>,
    e2eConfig: E2eContainerInterface,
    sequence: number,
    total: number,
    startedAt: string,
    startTime: number
  ): Promise<E2eExecutionRecord> {
    try {
      return await executor()
    } catch (error) {
      return this.createFailedRecord(e2eConfig, sequence, total, startedAt, Date.now() - startTime, error)
    }
  }

  /**
   * Create execution record from container exit code.
   */
  createExecutionRecord(
    e2eConfig: E2eContainerInterface,
    sequence: number,
    total: number,
    startedAt: string,
    finishedAt: string,
    duration: number,
    exitCode: number | undefined
  ): E2eExecutionRecord {
    if (exitCode === 0) {
      return {
        networkAlias: e2eConfig.networkAlias,
        sequence,
        total,
        status: 'passed',
        success: true,
        exitCode,
        startedAt,
        finishedAt,
        duration,
      }
    }

    if (typeof exitCode === 'number') {
      return {
        networkAlias: e2eConfig.networkAlias,
        sequence,
        total,
        status: 'failed_exit_code',
        success: false,
        exitCode,
        startedAt,
        finishedAt,
        duration,
      }
    }

    return {
      networkAlias: e2eConfig.networkAlias,
      sequence,
      total,
      status: 'failed_wait',
      success: false,
      errorMessage: 'E2E container finished without an inspectable exit code',
      startedAt,
      finishedAt,
      duration,
    }
  }

  /**
   * Create failed execution record from error
   */
  private createFailedRecord(
    e2eConfig: E2eContainerInterface,
    sequence: number,
    total: number,
    startedAt: string,
    duration: number,
    error: unknown
  ): E2eExecutionRecord {
    const status = this.classifyExecutionError(error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const finishedAt = new Date().toISOString()

    return {
      networkAlias: e2eConfig.networkAlias,
      sequence,
      total,
      status,
      success: false,
      errorMessage,
      startedAt,
      finishedAt,
      duration,
    }
  }

  /**
   * Classify error to determine execution status
   */
  private classifyExecutionError(error: unknown): E2eExecutionStatus {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'failed_timeout'
    }
    if (message.includes('wait')) {
      return 'failed_wait'
    }
    if (message.includes('start')) {
      return 'failed_startup'
    }

    return 'failed_unexpected'
  }
}
