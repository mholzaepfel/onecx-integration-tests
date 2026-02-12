import * as fs from 'fs'
import * as path from 'path'
import { LogLevel } from '../types/logging.type'

export class RunnerLogger {
  private logFilePath?: string
  private writer?: fs.WriteStream

  constructor(logFilePath?: string) {
    this.logFilePath = logFilePath
    if (logFilePath) {
      fs.mkdirSync(path.dirname(logFilePath), { recursive: true })
      this.writer = fs.createWriteStream(logFilePath, { flags: 'a' })
    }
  }

  log(level: LogLevel, message: string): void {
    const prefix = this.formatPrefix(level)
    const line = `${prefix} ${message}`
    console.log(line)
    if (this.writer) {
      this.writer.write(`${line}\n`)
    }
  }

  close(): Promise<void> {
    if (!this.writer) return Promise.resolve()
    return new Promise((resolve) => {
      this.writer?.end(resolve)
      this.writer = undefined
    })
  }

  private formatPrefix(level: LogLevel): string {
    switch (level) {
      case 'info':
        return 'INFO:'
      case 'success':
        return 'SUCCESS:'
      case 'warn':
        return 'WARN:'
      case 'error':
        return 'ERROR:'
      default:
        return 'LOG:'
    }
  }
}
