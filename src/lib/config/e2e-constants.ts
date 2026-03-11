import * as path from 'path'

/**
 * Constants for E2E test execution
 */

/**
 * Output directory for E2E results (relative to cwd)
 * Used by both E2E container volume mount and PlatformInfoExporter
 */
export const E2E_OUTPUT_DIR = 'e2e-results'

/**
 * Container path where E2E results are written inside the container
 */
export const E2E_CONTAINER_OUTPUT_PATH = '/reports'

/**
 * Default timeout for E2E container startup/termination wait in milliseconds.
 * 10 minutes is intended for slower CI/CD pipelines.
 * 1000 milli * 60 sec * 10 min
 */
export const E2E_DEFAULT_TIMEOUT_MS = 1000 * 60 * 10

/**
 * Get the absolute path for E2E output directory
 */
export function getE2eOutputPath(): string {
  return path.resolve(process.cwd(), E2E_OUTPUT_DIR)
}
