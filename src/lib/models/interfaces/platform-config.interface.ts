import { BffContainerInterface } from './bff.interface'
import { SvcContainerInterface } from './svc.interface'
import { UiContainerInterface } from './ui.interface'
import { HeartbeatConfig } from './health-checker.interface'
import { E2eContainerInterface } from './e2e.interface'

export interface PlatformConfig {
  /** Whether to run data import after starting services */
  importData?: boolean
  /** Whether to enable logging or not */
  withLoggingEnabled?: boolean | string[]
  /** Define the heartbeat config */
  heartbeat?: HeartbeatConfig

  config?: {
    /** Define the custom import path */
    importsPath?: string
    /** Define the custom realm */
    realm?: string
    /** Define the custom realm path */
    realmPath?: string
  }

  /** Image overrides - allows testing against different images */
  platformOverrides?: {
    /** Core service images */
    core?: {
      postgres?: { image?: string }
      keycloak?: { image?: string }
      importmanager?: { image?: string }
    }
    /** Backend service images */
    services?: {
      iamKc?: { image?: string }
      parameter?: { image?: string }
      workspace?: { image?: string }
      userProfile?: { image?: string }
      theme?: { image?: string }
      tenant?: { image?: string }
      productStore?: { image?: string }
      permission?: { image?: string }
    }
    /** BFF service images */
    bff?: {
      parameter?: { image?: string }
      shell?: { image?: string }
      workspace?: { image?: string }
    }
    /** UI service images */
    ui?: {
      shell?: { image?: string }
      workspace?: { image?: string }
    }
  }
  container?: {
    service?: SvcContainerInterface[]
    bff?: BffContainerInterface[]
    ui?: UiContainerInterface[]
    e2e?: E2eContainerInterface[]
  }
}
