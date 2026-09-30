import { Environment } from 'testcontainers/build/types'
import { CommandHealthCheckConfig, HealthCheckConfig } from './testcontainers-health-check.adapter'

export interface UiDetails {
  appBaseHref: string
  appId: string
  productName: string
  /**
   * Optional path or absolute HTTP(S) URL of the module federation entry file (e.g.
   * `/mfe/workspace/mf-manifest.json`). Used to build the entry URL for product-store MFE imports.
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
