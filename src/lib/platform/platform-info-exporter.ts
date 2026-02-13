import { StartedNetwork } from 'testcontainers'
import Dockerode from 'dockerode'
import * as path from 'path'
import { ContainerRegistry } from './container-registry'
import { CONTAINER } from '../models/container.enum'
import { AllowedContainerTypes } from '../models/allowed-container.types'
import { getE2eOutputPath } from '../config/e2e-constants'
import { Logger } from '../utils/logger'
import * as fs from 'fs'
import { PlatformInfo, ContainerInfo } from '../models/platform-info-exporter.interface'
import { getContainerId, getInternalPort, isE2eContainer, normalizeHost } from '../utils/container-utils'

const logger = new Logger('PlatformInfoExporter')

export class PlatformInfoExporter {
  private readonly outputDir: string

  constructor(private readonly containerRegistry: ContainerRegistry, private readonly network: StartedNetwork) {
    // Always use fixed E2E output directory
    this.outputDir = getE2eOutputPath()
    // Ensure directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  /**
   * Get complete platform info with all URLs
   */
  async getPlatformInfo(): Promise<PlatformInfo> {
    const containers = await this.getAllContainerInfos()

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
      },
      containers,
    }
  }

  /**
   * Get info for a specific container
   */
  async getContainerInfo(containerName: CONTAINER): Promise<ContainerInfo | undefined> {
    const container = this.containerRegistry.getContainer(containerName)
    if (!container) {
      return undefined
    }
    return await this.buildContainerInfo(containerName, container)
  }

  /**
   * Get all container infos - dynamically from registry
   */
  async getAllContainerInfos(): Promise<Record<string, ContainerInfo>> {
    const infos: Record<string, ContainerInfo> = {}

    // Get all containers from registry
    const allContainers = this.containerRegistry.getAllContainers()

    for (const [name, container] of allContainers) {
      if (isE2eContainer(container)) {
        // E2E runner has no mapped ports; keep it out of service URL export
        logger.info('CONTAINER_SKIPPED', `${name} - E2E runner (no service URLs needed)`)
        continue
      }
      infos[name] = await this.buildContainerInfo(name, container)
    }

    return infos
  }

  /**
   * Log platform info to console
   */
  async logPlatformInfo(): Promise<void> {
    const info = await this.getPlatformInfo()

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
    logger.info('═'.repeat(70))
  }

  /**
   * Write platform info to JSON file
   * Always writes to the fixed E2E output directory
   */
  async writePlatformInfoFile(filePath?: string): Promise<void> {
    const info = await this.getPlatformInfo()
    const outputPath = filePath ?? path.join(this.outputDir, 'platform-info.json')

    // Ensure directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(outputPath, JSON.stringify(info, null, 2))
    logger.info(`Platform info written to: ${outputPath}`)
  }

  /**
   * Export all (log + file)
   */

  async exportAll(filePath?: string): Promise<PlatformInfo> {
    const info = await this.getPlatformInfo()

    await this.logPlatformInfo()
    await this.writePlatformInfoFile(filePath)

    return info
  }

  /**
   * Get all environment variables from a specific container
   * Useful for debugging environment variable configuration
   * @param containerName Name of the container (e.g., 'onecx-shell-ui')
   * @returns Map of environment variable name to value, or undefined if container not found
   */
  async getContainerEnvironment(containerName: string): Promise<Map<string, string> | undefined> {
    const container = this.containerRegistry.getContainer(containerName)
    if (!container) {
      logger.warn(`Container ${containerName} not found in registry`)
      return undefined
    }

    try {
      const containerId = getContainerId(container)
      if (!containerId) {
        logger.warn(`Could not get container ID for ${containerName}`)
        return undefined
      }

      const dockerode = new Dockerode()
      const dockerContainer = dockerode.getContainer(containerId)
      const inspectData = await dockerContainer.inspect()

      const envMap = new Map<string, string>()
      const envArray = inspectData.Config?.Env || []

      // Parse environment variables from "KEY=VALUE" format
      for (const envVar of envArray) {
        const [key, ...valueParts] = envVar.split('=')
        const value = valueParts.join('=') // Handle values with '=' in them
        if (key) {
          envMap.set(key, value)
        }
      }

      return envMap
    } catch (err) {
      logger.error(`Failed to get environment for container ${containerName}: ${err}`)
      return undefined
    }
  }

  /**
   * Log all environment variables for a specific container
   * @param containerName Name of the container (e.g., 'onecx-shell-ui')
   */
  async logContainerEnvironment(containerName: string): Promise<void> {
    logger.info('─'.repeat(70))
    logger.info(`Environment Variables for: ${containerName}`)
    logger.info('─'.repeat(70))

    const envMap = await this.getContainerEnvironment(containerName)
    if (!envMap) {
      logger.warn(`Could not retrieve environment for ${containerName}`)
      return
    }

    if (envMap.size === 0) {
      logger.info('No environment variables found')
    } else {
      // Sort alphabetically for easier reading
      const sortedKeys = Array.from(envMap.keys()).sort()
      for (const key of sortedKeys) {
        const value = envMap.get(key)
        logger.info(`  ${key}=${value}`)
      }
      logger.info('')
      logger.info(`Total: ${envMap.size} environment variables`)
    }
    logger.info('─'.repeat(70))
  }

  private async buildContainerInfo(containerName: string, container: AllowedContainerTypes): Promise<ContainerInfo> {
    // Get internal port from container
    const internalPort = getInternalPort(container)

    try {
      const mappedPort = container.getMappedPort(internalPort)
      const host = container.getHost()

      // Use localhost for external URLs when host is Docker bridge IP
      // Docker bridge IPs (172.17.x.x) are often not reachable from the host
      const externalHost = normalizeHost(host)

      // Get environment variables
      const envMap = await this.getContainerEnvironment(containerName)
      const environment = envMap ? Object.fromEntries(envMap) : undefined

      return {
        name: containerName,
        type: 'service',
        host: externalHost,
        port: mappedPort,
        internalPort,
        internalUrl: `http://${containerName}:${internalPort}`,
        externalUrl: `http://${externalHost}:${mappedPort}`,
        running: true,
        environment,
      }
    } catch {
      return {
        name: containerName,
        type: 'service',
        host: '',
        port: 0,
        internalPort,
        internalUrl: `http://${containerName}:${internalPort}`,
        externalUrl: '',
        running: false,
      }
    }
  }
}
