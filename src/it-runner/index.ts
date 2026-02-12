#!/usr/bin/env node
import { parseCliArgs, printHelp } from './cli/cli'
import { IntegrationTestsRunner } from './runner'
import { EXIT_CODES } from './types/exit-codes'

export async function main(): Promise<void> {
  let options
  try {
    options = parseCliArgs(process.argv.slice(2), process.env)
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    printHelp()
    process.exit(EXIT_CODES.CONFIG_INVALID)
    return
  }

  if (options.help) {
    printHelp()
    process.exit(EXIT_CODES.SUCCESS)
    return
  }

  const runner = new IntegrationTestsRunner(options)
  const exitCode = await runner.run()
  process.exit(exitCode)
}

main().catch((error) => {
  console.error(`ERROR: Fatal error: ${error}`)
  process.exit(EXIT_CODES.UNEXPECTED_ERROR)
})
