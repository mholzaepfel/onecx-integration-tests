/**
 * Normalized CLI option set consumed by the integration test runner.
 */
export interface CliOptions {
  verbose: boolean
  dryRun: boolean
  captureLogsToFile: boolean
  help: boolean
}
