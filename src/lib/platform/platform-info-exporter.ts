import { StartedNetwork } from 'testcontainers'
import * as path from 'path'
import { ContainerRegistry } from './container-registry'
import { CONTAINER } from '../models/enums/container.enum'
import { PortAwareContainer } from '../models/types/allowed-container.type'
import { getE2eOutputPath } from '../config/e2e-constants'
import { Logger } from '../utils/logger'
import * as fs from 'fs'
import { PlatformInfo, ContainerInfo } from '../models/interfaces/platform-info-exporter.interface'
import {
  getInternalPort,
  isPortAwareContainer,
  isE2eContainer,
  getPlatformInfoExportDecision,
} from '../utils/container-utils'

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

    if (isE2eContainer(container)) {
      return {
        name: containerName,
        type: 'e2e',
        running: true,
        note: 'E2E runner has no service port mapping',
      }
    }

    if (isPortAwareContainer(container)) {
      return await this.buildContainerInfo(containerName, container)
    }

    return {
      name: containerName,
      type: 'custom',
      running: true,
      note: 'Container does not expose getPort()',
    }
  }

  /**
   * Get all container infos - dynamically from registry
   */
  async getAllContainerInfos(): Promise<Record<string, ContainerInfo>> {
    const infos: Record<string, ContainerInfo> = {}

    // Get all containers from registry
    const allContainers = this.containerRegistry.getAllContainers()

    for (const [name, container] of allContainers) {
      const exportDecision = getPlatformInfoExportDecision(container)
      if (!exportDecision.include) {
        logger.info('CONTAINER_SKIPPED', `${name} - ${exportDecision.reason ?? 'Skipped by export policy'}`)
        continue
      }

      if (isPortAwareContainer(container)) {
        infos[name] = await this.buildContainerInfo(name, container)
        continue
      }
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

  async exportAll(filePath?: string): Promise<void> {
    await this.logPlatformInfo()
    await this.writePlatformInfoFile(filePath)
  }

  private async buildContainerInfo(containerName: string, container: PortAwareContainer): Promise<ContainerInfo> {
    // Get internal port from container
    const internalPort = getInternalPort(container)

    try {
      const mappedPort = container.getMappedPort(internalPort)
      const host = container.getHost()

      return {
        name: containerName,
        type: 'service',
        host: host,
        port: mappedPort,
        internalPort,
        internalUrl: `http://${containerName}:${internalPort}`,
        externalUrl: `http://${host}:${mappedPort}`,
        running: true,
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
