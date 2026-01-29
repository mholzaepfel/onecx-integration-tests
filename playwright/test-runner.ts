#!/usr/bin/env ts-node
import { spawn } from 'child_process'

/**
 * Setup environment variables with validation
 * Uses environment variables set by Docker/CI or falls back to .env file
 */
function setupEnvironment(): void {
  console.log('🔧 Validating environment configuration...')

  // Environment variables should be set by Docker/CI
  // .env file serves as local development fallback only
  const baseUrl = process.env.BASE_URL
  const username = process.env.KEYCLOAK_USERNAME
  const password = process.env.KEYCLOAK_PASSWORD

  if (!baseUrl || !username || !password) {
    console.error('❌ Missing required environment variables:')
    if (!baseUrl) console.error('   - BASE_URL')
    if (!username) console.error('   - KEYCLOAK_USERNAME')
    if (!password) console.error('   - KEYCLOAK_PASSWORD')
    console.error('\nEnsure these are set in Docker/CI environment or .env file')
    process.exit(1)
  }

  console.log(`   BASE_URL:           ${baseUrl}`)
  console.log(`   KEYCLOAK_USERNAME:  ${username}`)
  console.log('   KEYCLOAK_PASSWORD:  ***')
  console.log('')
}

/**
 * Run Playwright tests
 */
function runTests(): void {
  console.log('🎭 Starting Playwright tests...\n')

  const playwright = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env,
  })

  playwright.on('close', (code: number) => {
    const exitCode = code ?? 1
    console.log(`\n${exitCode === 0 ? '✅' : '❌'} Playwright tests finished with exit code ${exitCode}`)
    process.exit(exitCode)
  })

  playwright.on('error', (error: Error) => {
    console.error('❌ Failed to start Playwright:', error)
    process.exit(1)
  })
}

// Main execution
if (require.main === module) {
  try {
    setupEnvironment()
    runTests()
  } catch (error) {
    console.error('❌ Failed to setup environment:', error)
    process.exit(1)
  }
}
