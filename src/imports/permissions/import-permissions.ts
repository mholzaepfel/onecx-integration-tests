import { readdir, readFile } from 'fs/promises'
import path from 'path'
import axios from 'axios'
import { Logger } from '../utils/imports-logger'

const logger = new Logger('ImportPermissions')

export async function importPermissions(permissionsDir: string, endpointBase: string) {
  logger.info('IMPORT_PERMISSIONS_START')
  const files = await readdir(permissionsDir)
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const fileName = file.replace('.json', '')
    const [product, appid] = fileName.split('_')

    logger.info('PROCESSING_FILE', `${file} - Product: ${product}, App: ${appid}`)
    const data = await readFile(path.join(permissionsDir, file), 'utf-8')
    const endpoint = `${endpointBase}/operator/v1/${product}/${appid}`

    try {
      const response = await axios.put(endpoint, JSON.parse(data), {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      })
      logger.status('UPLOAD_SUCCESS', response.status, `Permissions for app ${appid} and product ${product}`)
    } catch (err) {
      logger.error('UPLOAD_ERROR', `Permissions for app ${appid} and product ${product}`, err)
    }
  }
}
