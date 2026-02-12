export const EXIT_CODES = {
  SUCCESS: 0,
  CONFIG_INVALID: 1,
  RUNTIME_TIMEOUT: 2,
  DOCKER_ERROR: 3,
  E2E_FAILURE: 4,
  UNEXPECTED_ERROR: 5,
} as const

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES]
