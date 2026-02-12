import { OptionDefinition } from '../types/flag-definition.interface'

export const FLAG_DEFINITIONS: OptionDefinition[] = [
  {
    name: 'verbose',
    alias: 'v',
    description: 'Enable verbose output',
    type: 'boolean',
    envVar: 'IT_VERBOSE',
    defaultValue: false,
  },
  {
    name: 'capture-logs',
    description: 'Capture runner console output to file',
    type: 'boolean',
    envVar: 'IT_CAPTURE_LOGS',
    defaultValue: false,
    example: '--capture-logs',
  },
  {
    name: 'container-logs',
    description: 'Capture container logs to file inside the run artefacts dir (optional path or default)',
    type: 'stringOrBoolean',
    envVar: 'IT_CONTAINER_LOGS',
    example: '--container-logs logs/containers.log',
  },
  {
    name: 'dry-run',
    description: 'Print execution plan without running',
    type: 'boolean',
    defaultValue: false,
    example: '--dry-run',
  },
  {
    name: 'help',
    alias: 'h',
    description: 'Show help',
    type: 'boolean',
    defaultValue: false,
  },
]
