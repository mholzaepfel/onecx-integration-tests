import { readdir, readFile } from 'fs/promises'
import path from 'path'
import axios from 'axios'
import { Logger } from '../utils/imports-logger'

const logger = new Logger('ImportAssignments')

export async function importAssignments(assignmentsDir: string, endpoint: string) {
  logger.info('IMPORT_ASSIGNMENTS_START')
  const files = await readdir(assignmentsDir)
  for (const file of files) {
    if (!file.endsWith('.json')) continue

    const product = file.replace(/\.json$/, '')
    logger.info('PROCESSING_FILE', `${file} - Product: ${product}`)
    const data = await readFile(path.join(assignmentsDir, file), 'utf-8')

    try {
      const response = await axios.post(endpoint, JSON.parse(data), {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
      })
      logger.status('UPLOAD_SUCCESS', response.status, `Assignments for product ${product}`)
    } catch (err) {
      logger.error('UPLOAD_ERROR', `Assignments for product ${product}`, err)
    }
  }
}
