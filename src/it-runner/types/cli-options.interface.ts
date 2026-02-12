export interface CliOptions {
  verbose: boolean
  dryRun: boolean
  captureLogsToFile: boolean
  containerLogs?: string | boolean
  help: boolean
}
