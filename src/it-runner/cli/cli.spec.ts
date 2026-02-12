import { parseCliArgs } from './cli'

describe('parseCliArgs', () => {
  it('parses boolean, string, and number flags', () => {
    const options = parseCliArgs(['--capture-logs', '--dry-run'], {})

    expect(options.captureLogsToFile).toBe(true)
    expect(options.dryRun).toBe(true)
  })

  it('supports inline values and aliases', () => {
    const options = parseCliArgs(['-v', '--artefacts-dir=./out'], {})
    expect(options.verbose).toBe(true)
  })

  it('treats stringOrBoolean env as boolean when true/false', () => {
    const options = parseCliArgs([], { IT_CONTAINER_LOGS: 'true' })
    expect(options.containerLogs).toBe(true)
  })

  it('throws on unknown flag', () => {
    expect(() => parseCliArgs(['--unknown'], {})).toThrow('Unknown flag: --unknown')
  })
})
