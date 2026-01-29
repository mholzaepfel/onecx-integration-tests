/**
 * Volume mount configuration for E2E containers
 */
export interface E2eVolumeInterface {
  hostPath: string
  containerPath: string
}

/**
 * E2E container configuration interface
 */
export interface E2eContainerInterface {
  /** Docker image name (e.g., 'workspace-e2e:1.0.0') */
  image: string
  /** Optional network alias - if not provided, extracted from image name */
  networkAlias?: string
  /** Volume mounts for test reports */
  volumes?: E2eVolumeInterface[]
  /** Whether to wait for container exit (default: true) */
  waitForExit?: boolean
}

/**
 * Result of E2E container execution
 */
export interface E2eResult {
  exitCode: number
  success: boolean
  duration: number
}
