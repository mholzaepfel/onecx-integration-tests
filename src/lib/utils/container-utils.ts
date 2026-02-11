import { StartedOnecxKeycloakContainer } from '../containers/core/onecx-keycloak'
import { StartedShellUiContainer } from '../containers/ui/onecx-shell-ui'
import { StartedE2eContainer } from '../containers/e2e/onecx-e2e'
import type { AllowedContainerTypes } from '../models/allowed-container.types'

/** Type guard to check if container is a Keycloak container */
export function isKeycloakContainer(container: AllowedContainerTypes): container is StartedOnecxKeycloakContainer {
  return container instanceof StartedOnecxKeycloakContainer
}

/** Type guard to check if container is a Shell UI container */
export function isShellUiContainer(container: AllowedContainerTypes): container is StartedShellUiContainer {
  return container instanceof StartedShellUiContainer
}

/** Type guard to check if container is an E2E container */
export function isE2eContainer(container: AllowedContainerTypes): container is StartedE2eContainer {
  return container instanceof StartedE2eContainer
}

/** Get container id if available */
export function getContainerId(container: AllowedContainerTypes): string | undefined {
  if ('getId' in container && typeof container.getId === 'function') {
    return container.getId()
  }
  return undefined
}

/** Normalize host - convert Docker bridge IPs to localhost for better accessibility */
export function normalizeHost(host: string): string {
  if (host.startsWith('172.17.') || host.startsWith('172.18.')) {
    return 'localhost'
  }
  return host
}

/** Get internal port from container - tries getPort() method first, then falls back to defaults */
export function getInternalPort(container: AllowedContainerTypes): number {
  if ('getPort' in container && typeof (container as { getPort?: () => number }).getPort === 'function') {
    return (container as { getPort: () => number }).getPort()
  }
  return 8080
}
