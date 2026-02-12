export interface RunSummary {
  runId: string
  startTime: string
  endTime: string
  durationMs: number
  exitCode: number
  status: 'success' | 'failure' | 'timeout' | 'error'
  mode: 'e2e' | 'platform-only'
  e2eResult?: { exitCode: number; success: boolean; durationMs: number }
}
