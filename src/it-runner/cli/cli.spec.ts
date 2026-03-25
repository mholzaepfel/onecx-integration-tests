import { parseCliArgs } from './cli'

/**
 * Validates supported CLI flag parsing and error handling.
 */
describe('parseCliArgs', () => {
  it('parses boolean flags', () => {
    const options = parseCliArgs(['--capture-logs', '--dry-run'], {})

    expect(options.captureLogsToFile).toBe(true)
    expect(options.dryRun).toBe(true)
  })

  it('supports verbose alias', () => {
    const options = parseCliArgs(['-v'], {})
    expect(options.verbose).toBe(true)
  })

  it('parses help flag', () => {
    const options = parseCliArgs(['--help'], {})
    expect(options.help).toBe(true)
  })

  it('throws on unknown flag', () => {
    expect(() => parseCliArgs(['--unknown'], {})).toThrow("unknown option '--unknown'")
  })
})
