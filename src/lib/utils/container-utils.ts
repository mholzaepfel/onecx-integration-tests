import { StartedOnecxKeycloakContainer } from '../containers/core/onecx-keycloak'
import { StartedShellUiContainer } from '../containers/ui/onecx-shell-ui'
import { StartedE2eContainer } from '../containers/e2e/onecx-e2e'
import type { AllowedContainerTypes, PortAwareContainer } from '../models/types/allowed-container.type'
import { PlatformInfoExportDecision } from '../models/platform-info-exporter.interface'

export function isPortAwareContainer(container: AllowedContainerTypes): container is PortAwareContainer {
  return 'getPort' in container && typeof container.getPort === 'function'
}

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

/** Get internal port from a port-aware container by delegating to `getPort()`. */
export function getInternalPort(container: PortAwareContainer): number {
  return container.getPort()
}

/**
 * Centralized decision whether a container should be included in platform-info export.
 */
export function getPlatformInfoExportDecision(container: AllowedContainerTypes): PlatformInfoExportDecision {
  if (isE2eContainer(container)) {
    return { include: false, reason: 'E2E runner has no service port mapping' }
  }

  if (!isPortAwareContainer(container)) {
    return { include: false, reason: 'Container does not expose getPort()' }
  }

  return { include: true }
}
