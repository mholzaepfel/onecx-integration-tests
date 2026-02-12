import * as path from 'path'

export const DEFAULT_ARTEFACTS_ROOT = 'integration-tests'
export const DEFAULT_RUN_ID = process.env.RUN_ID || process.env.E2E_RUN_ID || 'local'
export const RUNS_DIR = 'artefacts'
export const LOCAL_ARTEFACTS_DIR = 'local'

export function resolveArtefactsRoot(root?: string): string {
  return path.resolve(process.cwd(), root ?? DEFAULT_ARTEFACTS_ROOT)
}

export function resolveRunArtefactsDir(root?: string, runId?: string): string {
  return path.join(resolveArtefactsRoot(root), RUNS_DIR, runId ?? DEFAULT_RUN_ID)
}

export function resolveLocalArtefactsDir(root?: string): string {
  return path.join(resolveArtefactsRoot(root), LOCAL_ARTEFACTS_DIR)
}
