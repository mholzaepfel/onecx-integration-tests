import { StartedNetwork } from 'testcontainers'
import { ContainerRegistry } from './container-registry'
import { CONTAINER } from '../models/container.enum'
import { AllowedContainerTypes } from '../models/allowed-container.types'
import { Logger } from '../utils/logger'
import * as fs from 'fs'

const logger = new Logger('PlatformInfoExporter')

export interface PlatformInfo {
  network: NetworkInfo
  e2e: E2eUrls
  external: ExternalUrls
  containers: Record<string, ContainerInfo>
}

export interface NetworkInfo {
  name: string
  id: string
}

export interface E2eUrls {
  baseUrl: string
  keycloakUrl: string
}

export interface ExternalUrls {
  shellUi: string
  keycloak: string
  shellBff: string
}

export interface ContainerInfo {
  name: string
  host: string
  port: number
  internalPort: number
  internalUrl: string
  externalUrl: string
  running: boolean
}

export class PlatformInfoExporter {
  constructor(private readonly containerRegistry: ContainerRegistry, private readonly network: StartedNetwork) {}

  /**
   * Get complete platform info with all URLs
   */
  getPlatformInfo(): PlatformInfo {
    const containers = this.getAllContainerInfos()

    return {
      network: {
        name: this.network.getName(),
        id: this.network.getId(),
      },
      e2e: {
        baseUrl: containers[CONTAINER.SHELL_UI]?.internalUrl ?? '',
        keycloakUrl: containers[CONTAINER.KEYCLOAK]?.internalUrl ?? '',
      },
      external: {
        shellUi: containers[CONTAINER.SHELL_UI]?.externalUrl ?? '',
        keycloak: containers[CONTAINER.KEYCLOAK]?.externalUrl ?? '',
        shellBff: containers[CONTAINER.SHELL_BFF]?.externalUrl ?? '',
      },
      containers,
    }
  }

  /**
   * Get info for a specific container
   */
  getContainerInfo(containerName: CONTAINER): ContainerInfo | undefined {
    const container = this.containerRegistry.getContainer(containerName)
    if (!container) {
      return undefined
    }
    return this.buildContainerInfo(containerName, container)
  }

  /**
   * Get all container infos - dynamically from registry
   */
  getAllContainerInfos(): Record<string, ContainerInfo> {
    const infos: Record<string, ContainerInfo> = {}

    // Get all containers from registry
    const allContainers = this.containerRegistry.getAllContainers()

    allContainers.forEach((container, name) => {
      infos[name] = this.buildContainerInfo(name, container)
    })

    return infos
  }

  /**
   * Log platform info to console
   */
  logPlatformInfo(): void {
    const info = this.getPlatformInfo()

    logger.info('═'.repeat(70))
    logger.info('Platform Ready!')
    logger.info('')
    logger.info('For E2E Container (inside Docker network):')
    logger.info(`  BASE_URL:     ${info.e2e.baseUrl}`)
    logger.info(`  KEYCLOAK_URL: ${info.e2e.keycloakUrl}`)
    logger.info(`  Network:      ${info.network.name}`)
    logger.info('')
    logger.info('For Browser/Debugging (from host):')
    logger.info(`  Shell UI:     ${info.external.shellUi}`)
    logger.info(`  Keycloak:     ${info.external.keycloak}`)
    logger.info(`  Shell BFF:    ${info.external.shellBff}`)
    logger.info('═'.repeat(70))
  }

  /**
   * Write platform info to JSON file
   */
  writePlatformInfoFile(filePath?: string): void {
    const info = this.getPlatformInfo()
    const outputPath = filePath ?? process.env.PLATFORM_INFO_FILE ?? './platform-info.json'

    fs.writeFileSync(outputPath, JSON.stringify(info, null, 2))
    logger.info(`Platform info written to: ${outputPath}`)
  }

  /**
   * Write outputs for GitHub Actions
   */
  writeGitHubActionsOutput(): void {
    const githubOutput = process.env.GITHUB_OUTPUT
    if (!githubOutput) {
      logger.info('GITHUB_OUTPUT not set, skipping GitHub Actions output')
      return
    }

    const info = this.getPlatformInfo()

    const outputs = [
      `network-name=${info.network.name}`,
      `network-id=${info.network.id}`,
      `base-url=${info.e2e.baseUrl}`,
      `keycloak-url=${info.e2e.keycloakUrl}`,
      `shell-ui-external=${info.external.shellUi}`,
      `keycloak-external=${info.external.keycloak}`,
      `platform-ready=true`,
    ]

    for (const output of outputs) {
      fs.appendFileSync(githubOutput, `${output}\n`)
    }

    logger.info('GitHub Actions outputs written')
  }

  /**
   * Export all (log + file + GitHub Actions)
   */
  exportAll(filePath?: string): PlatformInfo {
    const info = this.getPlatformInfo()

    this.logPlatformInfo()
    this.writePlatformInfoFile(filePath)
    this.writeGitHubActionsOutput()

    return info
  }

  private buildContainerInfo(containerName: string, container: AllowedContainerTypes): ContainerInfo {
    // Get internal port from container
    const internalPort = this.getInternalPort(container)

    try {
      const mappedPort = container.getMappedPort(internalPort)
      const host = container.getHost()

      // Use localhost for external URLs when host is Docker bridge IP
      // Docker bridge IPs (172.17.x.x) are often not reachable from the host
      const externalHost = this.normalizeHost(host)

      return {
        name: containerName,
        host: externalHost,
        port: mappedPort,
        internalPort,
        internalUrl: `http://${containerName}:${internalPort}`,
        externalUrl: `http://${externalHost}:${mappedPort}`,
        running: true,
      }
    } catch {
      return {
        name: containerName,
        host: '',
        port: 0,
        internalPort,
        internalUrl: `http://${containerName}:${internalPort}`,
        externalUrl: '',
        running: false,
      }
    }
  }

  /**
   * Normalize host - convert Docker bridge IPs to localhost for better accessibility
   */
  private normalizeHost(host: string): string {
    // Docker bridge network IPs (172.17.x.x) are not reachable from host on some systems
    if (host.startsWith('172.17.') || host.startsWith('172.18.')) {
      return 'localhost'
    }
    return host
  }

  /**
   * Get internal port from container - tries getPort() method first, then falls back to defaults
   */
  private getInternalPort(container: AllowedContainerTypes): number {
    // Try to get port from container if it has a getPort method
    if ('getPort' in container && typeof (container as { getPort?: () => number }).getPort === 'function') {
      return (container as { getPort: () => number }).getPort()
    }

    // Default ports based on container type (should rarely be needed)
    return 8080
  }
}
