import { PlatformManager } from './platform/platform-manager'
import { Logger } from './utils/logger'

const logger = new Logger('StartPlatform')

async function startPlatform(): Promise<void> {
  // Config path from environment variable (optional - uses default discovery if not set)
  const configPath = process.env.CONFIG_PATH

  logger.info('Starting platform...')
  if (configPath) {
    logger.info(`Config: ${configPath}`)
  }

  const manager = new PlatformManager(configPath)

  try {
    const config = manager.getValidatedConfig()

    await manager.startContainers(config)

    // Export platform info (log + file + GitHub Actions)
    const exporter = manager.getInfoExporter()
    exporter?.exportAll()

    // Run E2E tests if configured in the JSON config
    if (manager.hasE2eConfig()) {
      logger.info('E2E container configured, waiting for all services to be healthy...')
      await manager.checkAllHealthy()
      logger.info('All services healthy, starting E2E tests...')
      const e2eResult = await manager.runE2eTests()

      if (e2eResult) {
        logger.info('═'.repeat(70))
        logger.info(`E2E Tests: ${e2eResult.success ? '✅ PASSED' : '❌ FAILED'}`)
        logger.info(`Exit Code: ${e2eResult.exitCode}`)
        logger.info(`Duration:  ${Math.round(e2eResult.duration / 1000)}s`)
        logger.info('═'.repeat(70))

        // Stop platform and exit with E2E exit code
        logger.info('Shutting down platform...')
        await manager.stopAllContainers()
        process.exit(e2eResult.exitCode)
      }
    }

    // No E2E config - wait for shutdown signal (interactive mode)
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
