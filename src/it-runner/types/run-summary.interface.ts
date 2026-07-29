import { E2eAggregateResult, E2eExecutionResult } from './results.interface'

/**
 * Persisted summary of one integration test runner execution.
 */
export interface RunSummary {
  runId: string
  startTime: string
  endTime: string
  durationMs: number
  exitCode: number
  status: 'success' | 'failure' | 'timeout' | 'error'
  mode: 'e2e' | 'platform-only'
  e2eExecutions?: E2eExecutionResult[]
  e2eAggregate?: E2eAggregateResult
  interruptedBy?: 'SIGINT' | 'SIGTERM'
}
