import { Environment } from 'testcontainers/build/types'
import { CommandHealthCheckConfig, HealthCheckConfig } from './testcontainers-health-check.adapter'

export interface UiDetails {
  appBaseHref: string
  appId: string
  productName: string
  /**
   * Optional path the module federation entry file is served under (e.g. `/mfe/workspace/mf-manifest.json`
   * or `/remoteEntry.js`). Used to build the absolute entry URL for product-store MFE imports when the
   * container does not serve the entry from its root.
   */
  remoteEntry?: string
}

export interface UiContainerInterface {
  image: string
  environments?: Environment
  networkAlias: string
  /** Docker-level command health check — maps to withHealthCheck() + Wait.forHealthCheck() */
  commandHealthCheck?: CommandHealthCheckConfig
  /** One-pass wait strategies evaluated at startup — http and/or log based */
  healthChecks?: HealthCheckConfig[]
  uiDetails: UiDetails
}
