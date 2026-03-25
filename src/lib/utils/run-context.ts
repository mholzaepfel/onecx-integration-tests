import * as path from 'path'
import { DEFAULT_RUN_ID, resolveArtifactsRoot, resolveRunArtifactsDir } from '../config/artifacts'

export interface RunContextPaths {
  artifactsRoot: string
  runId: string
  runDir: string
  e2eDir: string
  e2eResultsDir: string
}

export function resolveRunContextPaths(root?: string, runId?: string): RunContextPaths {
  const effectiveRunId = runId ?? process.env.RUN_ID ?? process.env.E2E_RUN_ID ?? DEFAULT_RUN_ID
  const artifactsRoot = resolveArtifactsRoot(root)
  const runDir = resolveRunArtifactsDir(root, effectiveRunId)

  return {
    artifactsRoot,
    runId: effectiveRunId,
    runDir,
    e2eDir: path.join(runDir, 'e2e'),
    e2eResultsDir: path.join(runDir, 'e2e-results'),
  }
}

export function applyRunContextEnv(paths: RunContextPaths): void {
  process.env.ARTIFACTS_ROOT = paths.artifactsRoot
  process.env.E2E_BASE_DIR = paths.runDir
  process.env.RUN_ID = paths.runId
  process.env.E2E_RUN_ID = paths.runId

  // backward compatibility
  process.env.artifacts_ROOT = paths.artifactsRoot
}
