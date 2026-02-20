#!/usr/bin/env node
import { parseCliArgs, printHelp } from './cli/cli'
import { IntegrationTestsRunner } from './runner'

/**
 * CLI entrypoint for the integration test runner.
 *
 * Parses user flags, prints help when requested, executes the runner,
 * and exits with the resulting process exit code.
 *
 * @returns Resolves when the process exit flow has been initiated.
 */
export async function main(): Promise<void> {
  let options
  try {
    options = parseCliArgs(process.argv.slice(2), process.env)
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    printHelp()
    process.exit(1)
    return
  }

  if (options.help) {
    printHelp()
    process.exit(0)
    return
  }

  const runner = new IntegrationTestsRunner(options)
  const exitCode = await runner.run()
  process.exit(exitCode)
}

main().catch((error) => {
  console.error(`ERROR: Fatal error: ${error}`)
  process.exit(1)
})
