import { getCommonEnvironmentVariables } from '../../utils/common-env.utils'
import { StartedUiContainer, UiContainer } from '../basic/onecx-ui'
import { StartedOnecxKeycloakContainer } from '../core/onecx-keycloak'

export class WorkspaceUiContainer extends UiContainer {
  private client_user_id = 'onecx-workspace-ui-client'

  constructor(image: string, private keycloakContainer: StartedOnecxKeycloakContainer) {
    super(image)
    this.withEnvironment({
      ONECX_PERMISSIONS_ENABLED: 'true',
      ONECX_PERMISSIONS_CACHE_ENABLED: 'false',
      ONECX_PERMISSIONS_PRODUCT_NAME: 'onecx-workspace',
      KEYCLOAK_URL: `http://${keycloakContainer.getNetworkAliases()[0]}:${keycloakContainer.getPort()}`,
      ONECX_VAR_REMAP: 'KEYCLOAK_REALM=KC_REALM;KEYCLOAK_CLIENT_ID=CLIENT_USER_ID',
      CLIENT_USER_ID: `${this.client_user_id}`,
    })
      .withEnvironment(getCommonEnvironmentVariables(this.keycloakContainer))
      .withNetworkAliases('onecx-workspace-ui')
      .withAppBaseHref('/')
      .withAppId('onecx-workspace-ui')
      .withProductName('onecx-workspace')
  }

  override async start(): Promise<StartedWorkspaceUiContainer> {
    const startedUiContainer = await super.start()
    return new StartedWorkspaceUiContainer(startedUiContainer, this.client_user_id)
  }
}

export class StartedWorkspaceUiContainer extends StartedUiContainer {
  constructor(startedUiContainer: StartedUiContainer, private clientUserId: string) {
    super(
      startedUiContainer.getStartedTestContainer(),
      startedUiContainer.getDetails(),
      startedUiContainer.getNetworkAliases(),
      startedUiContainer.getPort()
    )
  }

  getClientUserId(): string {
    return this.clientUserId
  }
}
