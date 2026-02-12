import { PlatformConfig, PlatformTimeouts } from '../models/platform-config.interface'

const DEFAULT_TIMEOUTS: Required<PlatformTimeouts> = {
  startupMs: 300_000,
  healthCheckMs: 120_000,
  e2eMs: 600_000,
}

/** Complete platform configuration with all services enabled */
export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  importData: true,
  enableLogging: true,
  timeouts: DEFAULT_TIMEOUTS,
}

export function resolveTimeouts(config?: PlatformConfig): Required<PlatformTimeouts> {
  const userTimeouts = config?.timeouts ?? {}

  return {
    startupMs: userTimeouts.startupMs ?? DEFAULT_TIMEOUTS.startupMs,
    healthCheckMs: userTimeouts.healthCheckMs ?? DEFAULT_TIMEOUTS.healthCheckMs,
    e2eMs: userTimeouts.e2eMs ?? DEFAULT_TIMEOUTS.e2eMs,
  }
}
