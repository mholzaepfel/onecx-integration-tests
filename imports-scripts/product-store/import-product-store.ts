import { readdir, readFile } from 'fs/promises'
import path from 'path'
import axios from 'axios'
import { Logger } from '../utils/imports-logger'

const logger = new Logger('ImportProductStore')

/**
 * Module federation host entries keyed by appId, as produced by the runner into
 * `container-info.json`. `alias`/`port` point at the UI container serving the entry; `entry` is the
 * declared `uiDetails.remoteEntry` — the path the entry file is served under (which may sit under a
 * prefix and/or be `mf-manifest.json` instead of `remoteEntry.js`).
 */
export type UiEntryMap = Record<string, { alias: string; port: number; entry?: string }>

export async function importProducts(baseDir: string, endpointBase: string) {
  logger.info('IMPORT_PRODUCTS_START')
  const dir = path.join(baseDir, 'products')
  const files = await readdir(dir)
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const fileName = file.replace('.json', '')

    logger.info('PROCESSING_FILE', `${file} - Product: ${fileName}`)
    const data = await readFile(path.join(dir, file), 'utf-8')
    const endpoint = `${endpointBase}/operator/product/v1/update/${fileName}`

    try {
      const response = await axios.put(endpoint, JSON.parse(data), {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      })
      logger.status('UPLOAD_SUCCESS', response.status, `Product ${fileName}`)
    } catch (err) {
      logger.error('UPLOAD_ERROR', `Product ${fileName}`, err)
    }
  }
}

export async function importSlots(baseDir: string, endpointBase: string) {
  logger.info('IMPORT_SLOTS_START')
  const dir = path.join(baseDir, 'slots')
  const files = await readdir(dir)
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const fileName = file.replace('.json', '')
    const data = await readFile(path.join(dir, file), 'utf-8')
    const parsedData = JSON.parse(data)

    // v2 format: filename is product name, payload is [{ appId, slots: [{...}, ...] }]
    // Send each slot individually: PUT /operator/slot/v1/{product}/{appId} with single slot object
    if (
      Array.isArray(parsedData) &&
      parsedData.every(
        (entry) => entry && typeof entry === 'object' && typeof entry.appId === 'string' && Array.isArray(entry.slots)
      )
    ) {
      const product = fileName
      for (const entry of parsedData) {
        const endpoint = `${endpointBase}/operator/slot/v1/${product}/${entry.appId}`
        for (const slot of entry.slots) {
          logger.info('PROCESSING_FILE', `${file} - Product: ${product}, App: ${entry.appId}, Slot: ${slot.name}`)
          try {
            const response = await axios.put(endpoint, slot, {
              headers: { 'Content-Type': 'application/json' },
              validateStatus: () => true,
            })
            logger.status(
              'UPLOAD_SUCCESS',
              response.status,
              `Slot ${slot.name} for app ${entry.appId} in product ${product}`
            )
          } catch (err) {
            logger.error('UPLOAD_ERROR', `Slot ${slot.name} for app ${entry.appId} in product ${product}`, err)
          }
        }
      }
      continue
    }

    // Legacy format: filename is {product}_{appId}_{slotName}.json, payload is single slot object
    const [product, appid, slot] = fileName.split('_')
    logger.info('PROCESSING_FILE', `${file} - Product: ${product}, App: ${appid}, Slot: ${slot}`)
    const endpoint = `${endpointBase}/operator/slot/v1/${product}/${appid}`
    try {
      const response = await axios.put(endpoint, parsedData, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      })
      logger.status('UPLOAD_SUCCESS', response.status, `Slot ${slot} for app ${appid} and product ${product}`)
    } catch (err) {
      logger.error('UPLOAD_ERROR', `Slot ${slot} for app ${appid} and product ${product}`, err)
    }
  }
}

export async function importMicroservices(baseDir: string, endpointBase: string) {
  logger.info('IMPORT_MICROSERVICES_START')
  const dir = path.join(baseDir, 'microservices')
  const files = await readdir(dir)
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const fileName = file.replace('.json', '')
    const [product, appid] = fileName.split('_')

    logger.info('PROCESSING_FILE', `${file} - Product: ${product}, App: ${appid}`)
    const data = await readFile(path.join(dir, file), 'utf-8')
    const endpoint = `${endpointBase}/operator/ms/v1/${product}/${appid}`

    try {
      const response = await axios.put(endpoint, JSON.parse(data), {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      })
      logger.status('UPLOAD_SUCCESS', response.status, `Microservice ${appid} for product ${product}`)
    } catch (err) {
      logger.error('UPLOAD_ERROR', `Microservice ${appid} for product ${product}`, err)
    }
  }
}

export async function importMicrofrontends(
  baseDir: string,
  endpointBase: string,
  port: number,
  uiEntries?: UiEntryMap
) {
  logger.info('IMPORT_MICROFRONTENDS_START')
  const dir = path.join(baseDir, 'microfrontends')
  const files = await readdir(dir)
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const fileName = file.replace('.json', '')
    const [product, appid, mfe] = fileName.split('_')

    logger.info('PROCESSING_FILE', `${file} - Product: ${product}, App: ${appid}, MFE: ${mfe}`)
    const data = await readFile(path.join(dir, file), 'utf-8')
    const mfeData = JSON.parse(data)

    // Transform relative URLs to Docker-network URLs. The MFE assets are served from the UI container
    // directly (no nginx proxy needed for loading), so base and entry resolve against the same host.
    if (appid) {
      resolveRemoteUrls(mfeData, appid, port, uiEntries)
    }

    const endpoint = `${endpointBase}/operator/mfe/v1/${product}/${appid}`
    try {
      const response = await axios.put(endpoint, mfeData, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      })
      logger.status('UPLOAD_SUCCESS', response.status, `MFE ${mfe} for app ${appid} for product ${product}`)
    } catch (err) {
      logger.error('UPLOAD_ERROR', `MFE ${mfe} for app ${appid} for product ${product}`, err)
    }
  }
}

/**
 * Rewrite a relative `remoteEntry` / `remoteBaseUrl` into absolute Docker-network URLs.
 *
 * Both fields are relative to the same UI container, so they share one host. When the service
 * declared an explicit `remoteEntry` in its config (`uiEntries[appid].entry`), that value is
 * authoritative: it names the path the entry is served under and is built against the recorded UI
 * container host, and the base URL becomes the folder containing the entry so assets stay on the
 * same prefix. When no explicit entry is configured, the transform is intentionally byte-identical
 * to the legacy behaviour (entry file name at the container root on the `appid` host, base at the
 * root) so the existing product-store data is unaffected. Absolute (`http://`) values are left
 * unchanged.
 *
 * Module-private: only called from {@link importMicrofrontends}.
 */
function resolveRemoteUrls(
  mfeData: { remoteEntry?: string; remoteBaseUrl?: string },
  appid: string,
  port: number,
  uiEntries: UiEntryMap | undefined
): void {
  const dataEntry = mfeData.remoteEntry
  const hasRelativeEntry = typeof dataEntry === 'string' && dataEntry.length > 0 && !dataEntry.startsWith('http')

  // An explicit configured entry is authoritative and also selects the real UI container host;
  // otherwise fall back to the appid host at the product-store port (legacy behaviour).
  const configured = uiEntries?.[appid]
  const configuredEntry = configured?.entry
  const useConfigured = typeof configuredEntry === 'string' && configuredEntry.length > 0
  const alias = useConfigured ? configured!.alias : appid
  const hostPort = useConfigured ? configured!.port : port
  // Entry path: the configured value when present, else the entry file name at the container root.
  let entryPath = ''
  if (useConfigured) {
    entryPath = configuredEntry
  } else if (hasRelativeEntry) {
    entryPath = `/${path.posix.basename(dataEntry)}`
  }

  if (hasRelativeEntry) {
    const absoluteEntry = `http://${alias}:${hostPort}${entryPath}`
    logger.info('PROCESSING_FILE', `URL Transform - Entry: ${dataEntry} -> ${absoluteEntry}`)
    mfeData.remoteEntry = absoluteEntry
  }

  if (mfeData.remoteBaseUrl && !mfeData.remoteBaseUrl.startsWith('http')) {
    // The base URL is the folder containing the entry file; for the legacy root entry that is the
    // container root, matching the previous transform.
    const baseDir = entryPath.length > 0 ? path.posix.dirname(entryPath) : '/'
    const normalizedBase = baseDir.endsWith('/') ? baseDir : `${baseDir}/`
    const absoluteBase = `http://${alias}:${hostPort}${normalizedBase}`
    logger.info('PROCESSING_FILE', `URL Transform - BaseURL: ${mfeData.remoteBaseUrl} -> ${absoluteBase}`)
    mfeData.remoteBaseUrl = absoluteBase
  }
}
