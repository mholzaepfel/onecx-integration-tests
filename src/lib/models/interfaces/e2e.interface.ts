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
}

/**
 * Result of E2E container execution
 */
export interface E2eResult {
  exitCode: number
  success: boolean
  duration: number
}
