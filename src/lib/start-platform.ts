import { PlatformManager } from './platform/platform-manager'
import { Logger } from './utils/logger'

const logger = new Logger('StartPlatform')

/**
 * Start the platform in interactive mode (for development/debugging)
 *
 * This script starts all configured containers and waits for a shutdown signal.
 * For E2E test execution, use `npm run e2e` instead.
 *
 * Usage:
 *   npm run platform
 *   CONFIG_PATH=./my-config.json npm run platform
 */
async function startPlatform(): Promise<void> {
  const configPath = process.env.CONFIG_PATH

  logger.info('Starting platform in interactive mode...')
  if (configPath) {
    logger.info(`Config: ${configPath}`)
  }

  const manager = new PlatformManager(configPath)

  try {
    await manager.startContainers()

    // Export platform info (log + file)
    const exporter = manager.getInfoExporter()
    exporter?.exportAll()

    // Wait for shutdown signal (Ctrl+C or SIGTERM)
    await waitForShutdown()

    logger.info('Shutting down platform...')
    await manager.stopAllContainers()
    process.exit(0)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Platform startup failed', errorMessage)
    await manager.stopAllContainers().catch(() => {})
    process.exit(1)
  }
}

function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const shutdown = (): void => {
      logger.info('Shutdown signal received')
      resolve()
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    logger.info('Platform running. Press Ctrl+C or send SIGTERM to stop.')
  })
}

startPlatform().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error)
  logger.error('Unexpected error', errorMessage)
  process.exit(1)
})
