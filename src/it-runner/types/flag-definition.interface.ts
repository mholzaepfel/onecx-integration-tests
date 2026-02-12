export type FlagType = 'boolean' | 'string' | 'number' | 'stringOrBoolean'

export interface OptionDefinition<T = unknown> {
  name: string
  alias?: string
  description: string
  type: FlagType
  envVar?: string
  defaultValue?: T
  example?: string
}
