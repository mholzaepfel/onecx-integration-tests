import { FLAG_DEFINITIONS } from './flags'
import { buildUsage } from './usage'
import { CliOptions } from '../types/cli-options.interface'
import { OptionDefinition } from '../types/flag-definition.interface'

function coerceEnvValue(def: OptionDefinition, raw: string): unknown {
  switch (def.type) {
    case 'boolean':
      return raw === 'true'
    case 'number':
      return Number(raw)
    case 'string':
      return raw
    case 'stringOrBoolean':
      if (raw === 'true') return true
      if (raw === 'false') return false
      return raw
    default:
      return raw
  }
}

function applyDefaults(definitions: OptionDefinition[]): Record<string, unknown> {
  return definitions.reduce<Record<string, unknown>>((acc, def) => {
    if (def.defaultValue !== undefined) acc[def.name] = def.defaultValue
    return acc
  }, {})
}

function applyEnv(
  definitions: OptionDefinition[],
  env: NodeJS.ProcessEnv,
  seed: Record<string, unknown>
): Record<string, unknown> {
  return definitions.reduce<Record<string, unknown>>(
    (acc, def) => {
      const raw = def.envVar ? env[def.envVar] : undefined
      if (raw === undefined) return acc
      acc[def.name] = coerceEnvValue(def, raw)
      return acc
    },
    { ...seed }
  )
}

function findDefinition(flagName: string): OptionDefinition | undefined {
  return FLAG_DEFINITIONS.find((def) => def.name === flagName || def.alias === flagName)
}

export function parseCliArgs(argv: string[], env: NodeJS.ProcessEnv): CliOptions {
  const args = [...argv]
  const withDefaults = applyDefaults(FLAG_DEFINITIONS)
  const withEnv = applyEnv(FLAG_DEFINITIONS, env, withDefaults)
  const parsed: Record<string, unknown> = { ...withEnv }

  for (let i = 0; i < args.length; i++) {
    const raw = args[i]
    if (!raw.startsWith('-')) {
      throw new Error(`Unknown positional argument: ${raw}`)
    }

    const isLong = raw.startsWith('--')
    const clean = isLong ? raw.slice(2) : raw.slice(1)
    const [flagName, inlineValue] = clean.split('=')

    const definition = findDefinition(flagName)
    if (!definition) {
      throw new Error(`Unknown flag: ${raw}`)
    }

    const readNextArg = (): string | undefined => {
      const next = args[i + 1]
      if (next && !next.startsWith('-')) {
        i += 1
        return next
      }
      return undefined
    }

    switch (definition.type) {
      case 'boolean': {
        parsed[definition.name] = inlineValue !== undefined ? inlineValue === 'true' : true
        break
      }
      case 'number': {
        const valueStr = inlineValue ?? readNextArg()
        if (valueStr === undefined) throw new Error(`Flag ${raw} requires a number value`)
        const num = Number(valueStr)
        if (Number.isNaN(num)) throw new Error(`Flag ${raw} expects a number, got '${valueStr}'`)
        parsed[definition.name] = num
        break
      }
      case 'string': {
        const valueStr = inlineValue ?? readNextArg()
        if (valueStr === undefined) throw new Error(`Flag ${raw} requires a value`)
        parsed[definition.name] = valueStr
        break
      }
      case 'stringOrBoolean': {
        if (inlineValue !== undefined) {
          parsed[definition.name] = inlineValue === '' ? true : inlineValue
        } else {
          const next = readNextArg()
          parsed[definition.name] = next === undefined ? true : next
        }
        break
      }
      default:
        throw new Error(`Unsupported flag type for ${definition.name}`)
    }
  }

  const options: CliOptions = {
    verbose: Boolean(parsed['verbose']),
    dryRun: Boolean(parsed['dry-run']),
    captureLogsToFile: Boolean(parsed['capture-logs']),
    containerLogs: parsed['container-logs'] as string | boolean | undefined,
    help: Boolean(parsed['help']),
  }

  return options
}

export function printHelp(): void {
  console.log(buildUsage())
}
