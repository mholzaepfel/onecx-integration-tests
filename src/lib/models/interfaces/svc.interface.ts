import { StartedOnecxPostgresContainer } from '../../containers/core/onecx-postgres'
import { Environment } from 'testcontainers/build/types'
import { StartedOnecxKeycloakContainer } from '../../containers/core/onecx-keycloak'
import { CommandHealthCheckConfig, HealthCheckConfig } from './testcontainers-health-check.adapter'

export interface SvcDetails {
  databaseUsername: string
  databasePassword: string
}

export interface SvcContainerServices {
  databaseContainer?: StartedOnecxPostgresContainer
  keycloakContainer: StartedOnecxKeycloakContainer
}

export interface SvcContainerInterface {
  image: string
  environments?: Environment
  networkAlias: string
  /** Docker-level command health check — maps to withHealthCheck() + Wait.forHealthCheck() */
  commandHealthCheck?: CommandHealthCheckConfig
  /** One-pass wait strategies evaluated at startup — http and/or log based */
  healthChecks?: HealthCheckConfig[]
  svcDetails: SvcDetails
}
