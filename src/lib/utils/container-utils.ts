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
