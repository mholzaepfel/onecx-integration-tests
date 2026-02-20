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
  shellBff: string
}

export interface ContainerInfo {
  name: string
  host: string
  port: number
  internalPort: number
  internalUrl: string
  externalUrl: string
  running: boolean
}
