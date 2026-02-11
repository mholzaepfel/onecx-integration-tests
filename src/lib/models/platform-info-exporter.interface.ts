export interface PlatformInfo {
  network: NetworkInfo
  e2e: E2eUrls
  external: ExternalUrls
  containers: Record<string, ContainerInfo>
}

export interface NetworkInfo {
  name: string
  id: string
}

export interface E2eUrls {
  baseUrl: string
  keycloakUrl: string
}

export interface ExternalUrls {
  shellUi: string
  keycloak: string
}

export interface ContainerInfo {
  name: string
  /** Optional categorization to distinguish service/e2e/custom containers */
  type?: 'core' | 'service' | 'bff' | 'ui' | 'custom' | 'e2e'
  host?: string
  port?: number
  internalPort?: number
  internalUrl?: string
  externalUrl?: string
  running: boolean
  /** IP address in Docker network (for extra_hosts) */
  networkIp?: string
  /** Environment variables set in the container */
  environment?: Record<string, string>
  /** Additional note when container is skipped or has no exposed ports */
  note?: string
}
