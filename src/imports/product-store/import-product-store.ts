import { readdir, readFile } from 'fs/promises'
import path from 'path'
import axios from 'axios'
import { Logger } from '../utils/imports-logger'

const logger = new Logger('ImportProductStore')

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

export async function importMicrofrontends(baseDir: string, endpointBase: string, port: number) {
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

    // Transform relative URLs to Docker-network URLs using appId from filename as hostname.
    // The MFE assets are served from the UI container directly (no nginx proxy needed for loading).
    if (appid && mfeData.remoteBaseUrl && !mfeData.remoteBaseUrl.startsWith('http')) {
      const originalBaseUrl = mfeData.remoteBaseUrl
      mfeData.remoteBaseUrl = `http://${appid}:${port}/`
      logger.info('PROCESSING_FILE', `URL Transform - BaseURL: ${originalBaseUrl} -> ${mfeData.remoteBaseUrl}`)
    }

    if (appid && mfeData.remoteEntry && !mfeData.remoteEntry.startsWith('http')) {
      const originalEntry = mfeData.remoteEntry
      mfeData.remoteEntry = `http://${appid}:${port}/remoteEntry.js`
      logger.info('PROCESSING_FILE', `URL Transform - Entry: ${originalEntry} -> ${mfeData.remoteEntry}`)
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
