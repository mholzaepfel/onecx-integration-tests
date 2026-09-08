import { Environment } from 'testcontainers/build/types'

/**
 * E2E container configuration interface
 */
export interface E2eContainerInterface {
  /** Docker image name (e.g., 'workspace-e2e:1.0.0') */
  image: string
  /** Network alias for the container */
  networkAlias: string
  /** Base URL the E2E runner should target for the UI */
  baseUrl?: string
  /** Maximum wait time in milliseconds for one-shot startup/finish (default: 600_000 (10min)) */
  timeoutMs?: number
  /** Additional environment variables passed to the E2E container */
  environments?: Environment
}

/**
 * Shared context for one configured E2E container execution.
 */
export interface E2eExecutionContext {
  e2eConfig: E2eContainerInterface
  withLoggingEnabled: boolean
  logFilePath?: string
  sequence: number
  total: number
}

/**
 * Execution status for one E2E container run.
 */
export type E2eExecutionStatus =
  | 'passed'
  | 'failed_exit_code'
  | 'failed_startup'
  | 'failed_wait'
  | 'failed_timeout'
  | 'failed_unexpected'

/**
 * Result of one E2E container execution.
 */
export interface E2eExecutionRecord {
  networkAlias: string
  sequence: number
  total: number
  status: E2eExecutionStatus
  success: boolean
  exitCode?: number
  errorMessage?: string
  startedAt: string
  finishedAt: string
  duration: number
}
