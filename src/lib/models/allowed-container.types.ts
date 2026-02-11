import { StartedOnecxKeycloakContainer } from '../containers/core/onecx-keycloak'
import { StartedOnecxPostgresContainer } from '../containers/core/onecx-postgres'
import { StartedUiContainer } from '../containers/basic/onecx-ui'
import { StartedSvcContainer } from '../containers/basic/onecx-svc'
import { StartedBffContainer } from '../containers/basic/onecx-bff'
import { StartedE2eContainer } from '../containers/e2e/onecx-e2e'
import { StartedShellUiContainer } from '../containers/ui/onecx-shell-ui'

export type AllowedContainerTypes =
  | StartedOnecxPostgresContainer
  | StartedOnecxKeycloakContainer
  | StartedSvcContainer
  | StartedBffContainer
  | StartedUiContainer
  | StartedShellUiContainer
  | StartedE2eContainer
