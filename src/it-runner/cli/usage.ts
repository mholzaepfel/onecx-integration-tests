import { FLAG_DEFINITIONS } from './flags'
import { EXIT_CODES } from '../types/exit-codes'

export function buildUsage(): string {
  const usageLines: string[] = []

  usageLines.push('OneCX Integration Tests Runner')
  usageLines.push('')
  usageLines.push('Usage:')
  usageLines.push('  npm run it:run -- [options]')
  usageLines.push('')
  usageLines.push('Options:')

  FLAG_DEFINITIONS.forEach((def) => {
    const names = [def.alias ? `-${def.alias}` : undefined, `--${def.name}`].filter(Boolean).join(', ')
    const exampleText = def.example ? ` (e.g., ${def.example})` : ''
    usageLines.push(`  ${names.padEnd(24)} ${def.description}${exampleText}`)
  })

  usageLines.push('')
  usageLines.push('Output:')
  usageLines.push('  integration-tests/artefacts/runs/<runId>/{logs,reports,results-e2e,summary.json}')

  usageLines.push('')
  usageLines.push('Exit Codes:')
  usageLines.push(`  ${EXIT_CODES.SUCCESS} - Success`)
  usageLines.push(`  ${EXIT_CODES.DOCKER_ERROR} - Docker/container error`)
  usageLines.push(`  ${EXIT_CODES.E2E_FAILURE} - E2E/test failure`)
  usageLines.push(`  ${EXIT_CODES.UNEXPECTED_ERROR} - Unexpected error`)

  usageLines.push('')
  usageLines.push('Environment Overrides:')
  usageLines.push('  IT_VERBOSE, IT_CAPTURE_LOGS, IT_CONTAINER_LOGS')

  usageLines.push('')
  usageLines.push('Examples:')
  usageLines.push('  npm run it:run -- --dry-run')
  usageLines.push('  npm run it:run -- --container-logs logs/containers.log --verbose')

  return usageLines.join('\n')
}
