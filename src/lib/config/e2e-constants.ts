import * as path from 'path'
import { DEFAULT_ARTEFACTS_ROOT, DEFAULT_RUN_ID, resolveRunArtefactsDir } from './artefacts'

/**
 * Constants for E2E test execution
 */

/**
 * Output directory name for E2E results under artefacts/runs/<runId>
 * Used by both E2E container volume mount and PlatformInfoExporter
 */
export const E2E_OUTPUT_DIR = 'results-e2e'

// Base directory for artefacts root (can be overridden via env)
const E2E_BASE_DIR = process.env.E2E_BASE_DIR || DEFAULT_ARTEFACTS_ROOT

/**
 * Container path where E2E results are written inside the container
 */
export const E2E_CONTAINER_OUTPUT_PATH = '/results-e2e'

/**
 * Get the absolute path for E2E output directory within artefacts/runs/<runId>
 */
export function getE2eOutputPath(): string {
  const runId = process.env.E2E_RUN_ID || DEFAULT_RUN_ID
  const runDir = resolveRunArtefactsDir(E2E_BASE_DIR, runId)
  return path.resolve(path.join(runDir, E2E_OUTPUT_DIR))
}
