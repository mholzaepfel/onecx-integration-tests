import { PlatformManager } from './platform/platform-manager'
import { Logger } from './utils/logger'

const logger = new Logger('E2E')

/**
 * Entry point for E2E test execution
 *
 * The config file is the single source of truth.
 * If e2e is configured, it will be executed as the last container.
 *
 * Usage:
 *   npm run e2e
 *   npm run e2e -- --config=./path/to/config.json
 *   CONFIG_PATH=./config.json npm run e2e
 */
async function main(): Promise<void> {
  const configPath = getConfigPath()

  if (configPath) {
    logger.info(`Using config: ${configPath}`)
  }

  const manager = new PlatformManager(configPath)

  // Validate E2E is configured
  if (!manager.hasE2eConfig()) {
    logger.error('No E2E container configured in the platform configuration')
    process.exit(1)
  }

  try {
    // Start platform
    logger.info('Starting platform...')
    await manager.startContainers()

    // Export platform info
    manager.getInfoExporter()?.exportAll()

    // Wait for health
    logger.info('Waiting for all services to be healthy...')
    await manager.checkAllHealthy()
    logger.success('All services are healthy')

    // Run E2E (last container)
    logger.info('Starting E2E tests...')
    const result = await manager.runE2eTests()

    if (result) {
      logger.info('═'.repeat(70))
      logger.info(`E2E Tests: ${result.success ? '✅ PASSED' : '❌ FAILED'}`)
      logger.info(`Exit Code: ${result.exitCode}`)
      logger.info(`Duration:  ${Math.round(result.duration / 1000)}s`)
      logger.info('═'.repeat(70))
    }

    // Shutdown and exit with E2E result
    await manager.stopAllContainers()
    process.exit(result?.exitCode ?? 1)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('E2E execution failed', errorMessage)
    await manager.stopAllContainers().catch((stopError) => {
      const stopMessage = stopError instanceof Error ? stopError.message : String(stopError)
      logger.warn('Failed to stop containers after E2E failure', stopMessage)
    })
    process.exit(1)
  }
}

/**
 * Parse config path from CLI arguments or environment
 */
function getConfigPath(): string | undefined {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--config=')) {
      return arg.split('=')[1]
    }
    if (arg === '--config' && args[i + 1]) {
      return args[i + 1]
    }
  }
  return process.env.CONFIG_PATH
}

main().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error)
  logger.error('Unexpected error', errorMessage)
  process.exit(1)
})
