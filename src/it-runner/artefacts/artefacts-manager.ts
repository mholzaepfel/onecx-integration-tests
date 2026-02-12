import * as fs from 'fs'
import * as path from 'path'
import { RunSummary } from '../types/run-summary.interface'
import { getE2eOutputPath } from '../../lib/config/e2e-constants'
import { resolveArtefactsRoot, resolveRunArtefactsDir, resolveLocalArtefactsDir } from '../../lib/config/artefacts'

export class ArtefactsManager {
  private artifactsRoot: string
  private runDir: string
  private logsDir: string
  private runnerLogPath: string
  private localDir: string

  constructor(baseDir: string | undefined, runId: string) {
    this.artifactsRoot = resolveArtefactsRoot(baseDir)
    this.runDir = resolveRunArtefactsDir(this.artifactsRoot, runId)
    this.localDir = resolveLocalArtefactsDir(this.artifactsRoot)
    this.logsDir = path.join(this.runDir, 'logs')
    this.runnerLogPath = path.join(this.logsDir, 'runner-output.log')
  }

  ensureDirectories(): void {
    fs.mkdirSync(this.runDir, { recursive: true })
    fs.mkdirSync(this.logsDir, { recursive: true })
    fs.mkdirSync(path.join(this.runDir, 'reports'), { recursive: true })
    fs.mkdirSync(path.join(this.runDir, 'results-e2e'), { recursive: true })
    fs.mkdirSync(this.localDir, { recursive: true })
  }

  getRunDir(): string {
    return this.runDir
  }

  getArtefactsRoot(): string {
    return this.artifactsRoot
  }

  getLocalDir(): string {
    return this.localDir
  }

  getLogsDir(): string {
    return this.logsDir
  }

  getRunnerLogPath(): string {
    return this.runnerLogPath
  }

  writeLogLine(message: string): void {
    const timestamp = new Date().toISOString()
    const line = `[${timestamp}] ${message}\n`
    fs.appendFileSync(this.runnerLogPath, line)
  }

  writeSummary(summary: RunSummary): void {
    const summaryPath = path.join(this.runDir, 'summary.json')
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  }

  copyE2eResults(): void {
    const e2eResultsDir = getE2eOutputPath()
    const targetDir = path.join(this.runDir, 'e2e-results')

    if (path.resolve(e2eResultsDir) === path.resolve(targetDir)) {
      return
    }

    if (fs.existsSync(e2eResultsDir)) {
      fs.cpSync(e2eResultsDir, targetDir, { recursive: true })
    }
  }
}
