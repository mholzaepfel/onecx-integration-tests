import { BffContainer, StartedBffContainer } from '../basic/onecx-bff'
import { StartedOnecxKeycloakContainer } from '../core/onecx-keycloak'

export class WorkspaceBffContainer extends BffContainer {
  constructor(image: string, keycloakContainer: StartedOnecxKeycloakContainer) {
    super(image, keycloakContainer)
    this.withPermissionsProductName('onecx-workspace').withNetworkAliases('onecx-workspace-bff')
  }
}

export class StartedWorkspaceBffContainer extends StartedBffContainer {}
