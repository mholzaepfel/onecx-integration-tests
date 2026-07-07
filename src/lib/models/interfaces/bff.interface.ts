import { Environment } from 'testcontainers/build/types'
import { CommandHealthCheckConfig, HealthCheckConfig } from './testcontainers-health-check.adapter'

export interface BffDetails {
  permissionsProductName: string
}

export interface BffContainerInterface {
  image: string
  environments?: Environment
  networkAlias: string
  /** Docker-level command health check — maps to withHealthCheck() + Wait.forHealthCheck() */
  commandHealthCheck?: CommandHealthCheckConfig
  /** One-pass wait strategies evaluated at startup — http and/or log based */
  healthChecks?: HealthCheckConfig[]
  bffDetails: BffDetails
}
