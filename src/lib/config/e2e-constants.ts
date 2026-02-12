import * as path from 'path'

/**
 * Constants for E2E test execution
 */

/**
 * Output directory for E2E results (relative to cwd)
 * Used by both E2E container volume mount and PlatformInfoExporter
 */
export const E2E_OUTPUT_DIR = 'e2e-results'

// Base directory for artefacts (can be overridden via env)
const E2E_BASE_DIR = process.env.E2E_BASE_DIR || 'artefacts'

/**
 * Container path where E2E results are written inside the container
 */
export const E2E_CONTAINER_OUTPUT_PATH = '/reports'

/**
 * Get the absolute path for E2E output directory
 */
export function getE2eOutputPath(): string {
  const runId = process.env.E2E_RUN_ID
  const segments = [process.cwd(), E2E_BASE_DIR]

  if (runId) {
    segments.push(runId)
  }

  segments.push(E2E_OUTPUT_DIR)

  return path.resolve(...segments)
}
