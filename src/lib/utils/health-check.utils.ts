import { CommandHealthCheckConfig } from '../models/interfaces/testcontainers-health-check.adapter'

/**
 * Build complete health check URL with mapped port from command health check configuration.
 * Extracts protocol, host and path from the health check command and replaces the port
 * with the Docker-mapped port for external access.
 *
 * @example
 * ```typescript
 * const config = {
 *   test: ['CMD-SHELL', 'curl --head -fsS http://localhost:8080/q/health']
 * }
 * const url = buildHealthCheckUrl(32768, config)
 * // Returns: "http://localhost:32768/q/health"
 * ```
 *
 * @param mappedPort The Docker-mapped port to use for external access
 * @param config The command health check configuration
 * @returns Complete health check URL or null if no URL can be extracted
 */
export function buildHealthCheckUrl(mappedPort: number, config: CommandHealthCheckConfig): string | null {
  const extractedUrl = extractUrlFromHealthCheck(config)

  if (!extractedUrl) {
    return null
  }

  const baseUrl = extractBaseUrl(extractedUrl)

  if (!baseUrl) {
    return null
  }

  const baseUrlWithMappedPort = replacePortInBaseUrl(baseUrl, mappedPort)
  const extractedPath = extractHealthCheckPath(config)
  const path = extractedPath || ''

  return combineUrlWithPath(baseUrlWithMappedPort, path)
}

/**
 * Extract URL from command health check test command
 */
function extractUrlFromHealthCheck(config: CommandHealthCheckConfig | undefined): string | null {
  if (!config?.test || !Array.isArray(config.test)) {
    return null
  }

  // Join all test command parts into a single string
  const testCommand = config.test.join(' ')

  // Look for HTTP/HTTPS URLs - more flexible pattern that supports various hostnames
  const urlRegex = /https?:\/\/[^\s"']+/
  const match = testCommand.match(urlRegex)

  return match ? match[0] : null
}

/**
 * Extract health check path from command health check test command
 */
function extractHealthCheckPath(config: CommandHealthCheckConfig | undefined): string | null {
  const url = extractUrlFromHealthCheck(config)

  if (!url) {
    return null
  }

  // Extract path from URL (everything after hostname:port)
  const pathMatch = url.match(/https?:\/\/[^/]+(.*)/)

  if (!pathMatch || !pathMatch[1]) {
    return null
  }

  const path = pathMatch[1]

  // Return the path, ensure it starts with /
  return path.startsWith('/') ? path : `/${path}`
}

/**
 * Extract base URL (protocol + host) from a complete URL
 * @param url The complete URL to extract from
 * @returns Base URL (protocol://host) or null if extraction fails
 */
function extractBaseUrl(url: string): string | null {
  const baseUrlMatch = url.match(/(https?:\/\/[^/]+)/)
  return baseUrlMatch ? baseUrlMatch[1] : null
}

/**
 * Replace port in a base URL with a new mapped port
 * @param baseUrl The base URL (protocol://host:port)
 * @param mappedPort The new port to use
 * @returns Base URL with mapped port
 */
function replacePortInBaseUrl(baseUrl: string, mappedPort: number): string {
  return baseUrl.replace(/:\d+$/, `:${mappedPort}`)
}

/**
 * Combine base URL with path to create complete URL
 * @param baseUrl The base URL (protocol://host:port)
 * @param path The path to append (can be empty)
 * @returns Complete URL
 */
function combineUrlWithPath(baseUrl: string, path: string): string {
  return `${baseUrl}${path}`
}
