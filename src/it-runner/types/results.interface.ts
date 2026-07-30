import { E2eExecutionStatus } from '../../lib/models/interfaces/e2e.interface'

/**
 * Normalized execution status for one E2E container run.
 * Re-exported from lib to avoid a second independent definition.
 */

export interface E2eExecutionResult {
  networkAlias: string
  sequence: number
  total: number
  status: E2eExecutionStatus
  success: boolean
  exitCode?: number
  errorMessage?: string
  startedAt: string
  finishedAt: string
  durationMs: number
}

/**
 * Aggregate counts and final status for all E2E executions from one runner invocation.
 */
export interface E2eAggregateResult {
  total: number
  succeeded: number
  failed: number
  finalStatus: 'success' | 'failure'
}

/**
 * Full E2E execution report exported as dedicated artifact.
 */
export interface E2eExecutionReport {
  records: E2eExecutionResult[]
  aggregate: E2eAggregateResult
}
