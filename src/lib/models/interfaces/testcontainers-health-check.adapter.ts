/**
 * Adapter interfaces bridging our platform config contract with testcontainers wait strategies.
 *
 * Mapping:
 *   CommandHealthCheckConfig → withHealthCheck() + Wait.forHealthCheck()
 *   HttpHealthCheckConfig    → Wait.forHttp(path, port)
 *   LogHealthCheckConfig     → Wait.forLogMessage(message, times)
 */

/**
 * Docker-level command health check — maps to testcontainers withHealthCheck() + Wait.forHealthCheck().
 * Only one command health check can be registered per container (testcontainers constraint).
 */
export interface CommandHealthCheckConfig {
  /** Health check command array, e.g. ["CMD-SHELL", "curl -f http://localhost:8080/q/health"] */
  test: string[]
  /** Interval between checks in milliseconds */
  interval?: number
  /** Timeout per check in milliseconds */
  timeout?: number
  /** Number of retries before marking unhealthy */
  retries?: number
}

/**
 * Base for one-pass wait strategies — maps to testcontainers AbstractWaitStrategy.
 * These are evaluated once at container startup.
 */
export interface OnePassHealthCheckConfig {
  /** Maximum time in milliseconds to wait for this strategy to pass during startup */
  startupTimeout?: number
}

/**
 * HTTP-based wait strategy — maps to testcontainers Wait.forHttp(path, port).
 */
export interface HttpHealthCheckConfig extends OnePassHealthCheckConfig {
  /** Discriminator for HTTP health check strategy */
  type: 'http'
  /** Path to probe, e.g. "/q/health" */
  path: string
  /** Container-internal port to probe */
  port: number
  /** Abort wait if container exits before the check passes */
  abortOnContainerExit?: boolean
  /** Expected HTTP status code */
  statusCode?: number 
  /** Expected response body substring */
  body?: string
  /** Use TLS (HTTPS) */
  tls?: boolean
  /** HTTP method, defaults to GET */
  method?: string
  /** Additional request headers */
  headers?: Record<string, string>
  /** Basic auth username */
  username?: string
  /** Basic auth password */
  password?: string
}

/**
 * Log-based wait strategy — maps to testcontainers Wait.forLogMessage(message, times).
 */
export interface LogHealthCheckConfig extends OnePassHealthCheckConfig {
  /** Discriminator for log health check strategy */
  type: 'log'
  /** Log message string or regex pattern (as string) to wait for */
  messageOrRegex: string
  /** Number of times the message must appear before the strategy passes, defaults to 1 */
  numberOfEntries?: number
}

/** Union of all one-pass health check strategies */
export type HealthCheckConfig = HttpHealthCheckConfig | LogHealthCheckConfig

/** Type guard: narrows HealthCheckConfig to HttpHealthCheckConfig */
export function isHttpHealthCheck(c: HealthCheckConfig): c is HttpHealthCheckConfig {
  return c.type === 'http'
}

/** Type guard: narrows HealthCheckConfig to LogHealthCheckConfig */
export function isLogHealthCheck(c: HealthCheckConfig): c is LogHealthCheckConfig {
  return c.type === 'log'
}
